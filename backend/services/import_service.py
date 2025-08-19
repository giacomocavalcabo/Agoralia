import asyncio
import time
import logging
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from ..models import ImportJob, Lead, Workspace
from ..utils.phone_utils import normalize_phone_number
from ..utils.csv_utils import parse_csv_safe
import dramatiq
from dramatiq import actor

logger = logging.getLogger(__name__)

# Rate limiting configuration
MAX_ROWS_PER_WORKSPACE = 100000  # 100k rows max per workspace
MAX_FILE_SIZE_MB = 50  # 50MB max file size
MAX_CONCURRENT_JOBS = 3  # Max 3 concurrent import jobs per workspace

class ImportService:
    """Service for handling robust CSV imports with rate limiting and validation"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def create_import_job(
        self, 
        workspace_id: str, 
        user_id: str, 
        file_data: bytes,
        filename: str,
        mapping_config: Dict[str, Any]
    ) -> ImportJob:
        """Create a new import job with validation and rate limiting"""
        
        # Check workspace limits
        if not await self._check_workspace_limits(workspace_id):
            raise ValueError("Workspace import limits exceeded")
        
        # Validate file size
        file_size_mb = len(file_data) / (1024 * 1024)
        if file_size_mb > MAX_FILE_SIZE_MB:
            raise ValueError(f"File too large: {file_size_mb:.1f}MB (max: {MAX_FILE_SIZE_MB}MB)")
        
        # Create import job
        job = ImportJob(
            id=f"import_{int(time.time())}_{workspace_id[:8]}",
            workspace_id=workspace_id,
            user_id=user_id,
            filename=filename,
            file_size_bytes=len(file_data),
            status='pending',
            mapping_config=mapping_config,
            progress=0,
            total_rows=0,
            processed_rows=0,
            errors=[],
            warnings=[]
        )
        
        self.db.add(job)
        self.db.commit()
        
        # Queue the job for processing
        process_import_job.send(job.id)
        
        return job
    
    async def _check_workspace_limits(self, workspace_id: str) -> bool:
        """Check if workspace can start new import job"""
        
        # Check concurrent jobs
        active_jobs = self.db.query(ImportJob).filter(
            ImportJob.workspace_id == workspace_id,
            ImportJob.status.in_(['pending', 'processing'])
        ).count()
        
        if active_jobs >= MAX_CONCURRENT_JOBS:
            logger.warning(f"Workspace {workspace_id} has {active_jobs} active jobs")
            return False
        
        # Check total rows imported this month
        month_start = time.time() - (30 * 24 * 60 * 60)  # 30 days ago
        monthly_imports = self.db.query(ImportJob).filter(
            ImportJob.workspace_id == workspace_id,
            ImportJob.created_at >= month_start,
            ImportJob.status == 'completed'
        ).all()
        
        total_rows_this_month = sum(job.total_rows for job in monthly_imports)
        if total_rows_this_month >= MAX_ROWS_PER_WORKSPACE:
            logger.warning(f"Workspace {workspace_id} imported {total_rows_this_month} rows this month")
            return False
        
        return True
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get current job status and progress"""
        job = self.db.query(ImportJob).filter(ImportJob.id == job_id).first()
        
        if not job:
            return None
        
        return {
            'id': job.id,
            'status': job.status,
            'progress': job.progress,
            'total_rows': job.total_rows,
            'processed_rows': job.processed_rows,
            'errors': job.errors,
            'warnings': job.warnings,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None
        }

@actor(max_retries=3, time_limit=3600000)  # 1 hour max
def process_import_job(job_id: str):
    """Background job processor for CSV imports"""
    
    from ..db import SessionLocal
    
    db = SessionLocal()
    try:
        # Get the job
        job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
        if not job:
            logger.error(f"Import job {job_id} not found")
            return
        
        # Update status to processing
        job.status = 'processing'
        job.started_at = time.time()
        db.commit()
        
        # Process the import
        success, total_rows, errors, warnings = _process_csv_import(job, db)
        
        # Update job with results
        job.status = 'completed' if success else 'failed'
        job.total_rows = total_rows
        job.processed_rows = total_rows - len(errors)
        job.errors = errors
        job.warnings = warnings
        job.completed_at = time.time()
        job.progress = 100
        
        db.commit()
        
        logger.info(f"Import job {job_id} completed: {total_rows} rows, {len(errors)} errors")
        
    except Exception as e:
        logger.error(f"Error processing import job {job_id}: {e}")
        
        # Update job with error
        job.status = 'failed'
        job.errors.append(f"Processing error: {str(e)}")
        job.completed_at = time.time()
        db.commit()
        
    finally:
        db.close()

def _process_csv_import(job: ImportJob, db: Session) -> tuple[bool, int, List[str], List[str]]:
    """Process CSV import with error handling and progress tracking"""
    
    try:
        # Parse CSV
        csv_data = job.file_data.decode('utf-8')
        parsed_data = parse_csv_safe(csv_data)
        
        if not parsed_data or not parsed_data.get('data'):
            return False, 0, ["No data found in CSV"], []
        
        data = parsed_data['data']
        total_rows = len(data)
        errors = []
        warnings = []
        
        # Process rows in batches
        batch_size = 1000
        processed_count = 0
        
        for i in range(0, total_rows, batch_size):
            batch = data[i:i + batch_size]
            
            # Process batch
            batch_errors, batch_warnings = _process_batch(batch, job.mapping_config, db)
            errors.extend(batch_errors)
            warnings.extend(batch_warnings)
            
            processed_count += len(batch)
            job.progress = int((processed_count / total_rows) * 100)
            db.commit()
            
            # Small delay to prevent overwhelming the database
            time.sleep(0.1)
        
        success = len(errors) == 0 or len(errors) < total_rows * 0.1  # Allow 10% error rate
        
        return success, total_rows, errors, warnings
        
    except Exception as e:
        logger.error(f"Error in CSV processing: {e}")
        return False, 0, [f"Processing error: {str(e)}"], []

def _process_batch(
    batch: List[Dict], 
    mapping_config: Dict[str, Any], 
    db: Session
) -> tuple[List[str], List[str]]:
    """Process a batch of CSV rows"""
    
    errors = []
    warnings = []
    
    for row_index, row in enumerate(batch):
        try:
            # Normalize phone number
            phone_field = mapping_config.get('phone_field', 'phone')
            if phone_field in row and row[phone_field]:
                normalized = normalize_phone_number(row[phone_field])
                
                if not normalized['is_valid']:
                    errors.append(f"Row {row_index + 1}: Invalid phone number '{row[phone_field]}'")
                    continue
                
                # Create lead with normalized phone
                lead_data = {
                    'workspace_id': mapping_config['workspace_id'],
                    'phone_e164': normalized['e164'],
                    'phone_country': normalized['country'],
                    'phone_type': normalized['type']
                }
                
                # Map other fields
                for csv_field, app_field in mapping_config['field_mappings'].items():
                    if csv_field in row and row[csv_field]:
                        lead_data[app_field] = row[csv_field]
                
                # Check for duplicates
                existing_lead = db.query(Lead).filter(
                    Lead.workspace_id == mapping_config['workspace_id'],
                    Lead.phone_e164 == normalized['e164']
                ).first()
                
                if existing_lead:
                    if mapping_config.get('duplicate_strategy') == 'merge':
                        # Update existing lead
                        for key, value in lead_data.items():
                            if key not in ['workspace_id', 'phone_e164']:
                                setattr(existing_lead, key, value)
                        existing_lead.updated_at = time.time()
                    else:
                        # Skip duplicate
                        warnings.append(f"Row {row_index + 1}: Duplicate phone number '{normalized['e164']}'")
                        continue
                else:
                    # Create new lead
                    lead = Lead(**lead_data)
                    db.add(lead)
                
            else:
                errors.append(f"Row {row_index + 1}: Missing required phone number")
                
        except Exception as e:
            errors.append(f"Row {row_index + 1}: Processing error - {str(e)}")
    
    # Commit batch
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        errors.append(f"Batch commit failed: {str(e)}")
    
    return errors, warnings
