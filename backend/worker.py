import dramatiq
import httpx
import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

# Import database models
from .db import get_db
from .models import KbImportJob, KbSource

# Mock LLM client for MVP (replace with OpenAI/Anthropic in production)
class MockLLMClient:
    def extract_outcome(self, transcript: str, template_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Mock LLM outcome extraction based on template schema"""
        # Simulate AI processing
        fields = {}
        for field in template_schema.get('fields', []):
            field_key = field.get('key', '')
            field_type = field.get('type', 'text')
            
            if field_type == 'boolean':
                fields[field_key] = True  # Mock positive outcome
            elif field_type == 'select':
                options = field.get('options', [])
                fields[field_key] = options[0] if options else 'Unknown'
            elif field_type == 'number':
                fields[field_key] = 5000  # Mock budget
            else:
                fields[field_key] = f"Mock {field_key}"
        
        return {
            'fields_json': fields,
            'ai_summary_short': f"Qualified lead: {fields.get('need', 'Unknown need')}",
            'ai_summary_long': f"Spoke with contact about {fields.get('need', 'Unknown')}. Budget: {fields.get('budget', 'Unknown')}. Timeline: {fields.get('timeline', 'Unknown')}.",
            'action_items_json': [
                "Send quote by Friday",
                "Schedule follow-up call",
                "Prepare datasheet"
            ],
            'sentiment': 0.6,
            'score_lead': 78,
            'next_step': fields.get('next_step', 'Follow-up call')
        }

# Initialize mock LLM
mock_llm = MockLLMClient()

@dramatiq.actor(queue_name='q:outcome_extract')
def outcome_extract_job(call_id: str, agent_id: str, lang: str, template_id: str, transcript_url: Optional[str] = None):
    """Extract structured outcomes from call using LLM and template schema"""
    try:
        # In production, this would:
        # 1. Fetch transcript/audio from Retell API
        # 2. Call real LLM (OpenAI/Anthropic) with template schema
        # 3. Validate response against JSON schema
        # 4. Store in database
        # 5. Trigger CRM sync if auto-sync enabled
        
        print(f"Processing outcome extraction for call {call_id}")
        
        # Mock template schema (in production, fetch from database)
        template_schema = {
            "name": "B2B Qualification",
            "fields": [
                {"key": "need", "label": "Need", "type": "text", "required": True},
                {"key": "budget", "label": "Budget", "type": "number", "min": 0},
                {"key": "timeline", "label": "Timeline", "type": "select", "options": ["<1m", "1–3m", "3–6m", "6m+"], "required": True},
                {"key": "decision_maker", "label": "Decision maker", "type": "text"},
                {"key": "next_step", "label": "Next step", "type": "select", "options": ["Send quote", "Book demo", "Follow‑up call", "Disqualify"], "required": True}
            ]
        }
        
        # Mock transcript (in production, fetch from Retell)
        mock_transcript = f"Mock transcript for call {call_id} in {lang}"
        
        # Extract outcome using LLM
        outcome_data = mock_llm.extract_outcome(mock_transcript, template_schema)
        
        # Validate extracted data
        if not outcome_data.get('fields_json'):
            raise ValueError("LLM failed to extract fields")
        
        # In production, save to database here
        print(f"Outcome extracted for call {call_id}: {outcome_data.get('next_step')}")
        
        # Trigger CRM sync if enabled
        crm_sync_job.send(call_id, outcome_data)
        
        return {
            "success": True,
            "call_id": call_id,
            "outcome": outcome_data
        }
        
    except Exception as e:
        print(f"Outcome extraction failed for call {call_id}: {e}")
        # In production, retry with exponential backoff
        raise dramatiq.Retry(delay=60000)  # Retry in 1 minute

@dramatiq.actor(queue_name='q:crm_sync')
def crm_sync_job(call_id: str, outcome_data: Dict[str, Any]):
    """Sync call outcome to CRM systems"""
    try:
        print(f"Syncing outcome to CRM for call {call_id}")
        
        # In production, this would:
        # 1. Check CRM connections for the workspace
        # 2. Map outcome fields to CRM schema
        # 3. Create/update Lead/Company/Deal
        # 4. Create Task with due date
        # 5. Log Call activity
        
        # Mock CRM sync
        crm_providers = ['hubspot', 'zoho', 'odoo']
        
        for provider in crm_providers:
            try:
                # Mock API call to CRM
                print(f"Syncing to {provider}...")
                
                # Simulate API delay
                import time
                time.sleep(0.1)
                
                print(f"Successfully synced to {provider}")
                
            except Exception as e:
                print(f"Failed to sync to {provider}: {e}")
                # Continue with other providers
        
        return {
            "success": True,
            "call_id": call_id,
            "crm_sync": "completed"
        }
        
    except Exception as e:
        print(f"CRM sync failed for call {call_id}: {e}")
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes

@dramatiq.actor(queue_name='q:notify')
def send_notification_job(notification_id: str, target_user_id: str, kind: str, subject: str, body_md: str, locale: str):
    """Send notification (email or in-app) to user"""
    try:
        print(f"Sending {kind} notification to user {target_user_id}")
        
        if kind == 'email':
            # Email sending logic
            email_provider = os.getenv('EMAIL_PROVIDER', 'postmark')
            
            if email_provider == 'postmark':
                # Postmark integration
                postmark_token = os.getenv('POSTMARK_TOKEN')
                if postmark_token:
                    with httpx.Client() as client:
                        response = client.post(
                            'https://api.postmarkapp.com/email',
                            headers={
                                'X-Postmark-Server-Token': postmark_token,
                                'Content-Type': 'application/json'
                            },
                            json={
                                'From': 'noreply@agoralia.ai',
                                'To': target_user_id,  # In production, fetch user email
                                'Subject': subject,
                                'HtmlBody': body_md,  # In production, convert MD to HTML
                                'MessageStream': 'outbound'
                            }
                        )
                        if response.status_code == 200:
                            print(f"Email sent via Postmark to {target_user_id}")
                        else:
                            print(f"Postmark failed: {response.status_code}")
                else:
                    print("Postmark token not configured")
            
            elif email_provider == 'sendgrid':
                # SendGrid integration
                sendgrid_key = os.getenv('SENDGRID_API_KEY')
                if sendgrid_key:
                    with httpx.Client() as client:
                        response = client.post(
                            'https://api.sendgrid.com/v3/mail/send',
                            headers={
                                'Authorization': f'Bearer {sendgrid_key}',
                                'Content-Type': 'application/json'
                            },
                            json={
                                'personalizations': [{
                                    'to': [{'email': target_user_id}]  # In production, fetch user email
                                }],
                                'from': {'email': 'noreply@agoralia.ai'},
                                'subject': subject,
                                'content': [{
                                    'type': 'text/html',
                                    'value': body_md  # In production, convert MD to HTML
                                }]
                            }
                        )
                        if response.status_code == 202:
                            print(f"Email sent via SendGrid to {target_user_id}")
                        else:
                            print(f"SendGrid failed: {response.status_code}")
                else:
                    print("SendGrid API key not configured")
        
        elif kind == 'in_app':
            # In-app notification logic
            # In production, save to database and trigger real-time update
            print(f"In-app notification saved for user {target_user_id}")
        
        # Mark notification as delivered
        # In production, update notification_targets table
        
        return {
            "success": True,
            "notification_id": notification_id,
            "delivered_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        print(f"Notification sending failed: {e}")
        raise dramatiq.Retry(delay=60000)  # Retry in 1 minute


# ===================== Knowledge Base Import Jobs =====================

def _is_job_cancelled(job_id: str) -> bool:
    """Check if job was cancelled via Redis key"""
    try:
        import redis
        r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        return r.exists(f"kb:job:{job_id}:cancelled")
    except:
        return False

def _set_job_cancelled(job_id: str) -> None:
    """Mark job as cancelled in Redis"""
    try:
        import redis
        r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        r.setex(f"kb:job:{job_id}:cancelled", 3600, "1")  # 1 hour TTL
    except:
        pass

@dramatiq.actor(queue_name='q:kb:import')
def kb_import_job(job_id: str):
    """Process knowledge base import job (CSV, file, or URL)"""
    try:
        print(f"Starting KB import job {job_id}")
        
        # Check if job was cancelled
        if _is_job_cancelled(job_id):
            print(f"Job {job_id} was cancelled, exiting")
            return {"job_id": job_id, "status": "cancelled"}
        
        # Get job details from database
        with next(get_db()) as db:
            job = db.query(KbImportJob).filter(KbImportJob.id == job_id).first()
            if not job:
                raise ValueError(f"Import job {job_id} not found")
            
            # Update status to running
            job.status = "running"
            job.progress_pct = 10
            db.commit()
            
            # Get source details
            source = db.query(KbSource).filter(KbSource.id == job.source_id).first()
            if not source:
                raise ValueError(f"Source {job.source_id} not found")
            
            # Process based on source type
            if source.kind == "csv":
                result = _process_csv_import(db, job, source)
            elif source.kind == "file":
                result = _process_file_import(db, job, source)
            elif source.kind == "url":
                result = _process_url_import(db, job, source)
            else:
                raise ValueError(f"Unsupported source type: {source.kind}")
            
            # Update job status
            job.status = "completed"
            job.progress_pct = 100
            job.completed_at = datetime.utcnow()
            db.commit()
            
            print(f"KB import job {job_id} completed successfully")
            return result
            
    except Exception as e:
        print(f"KB import job {job_id} failed: {e}")
        
        # Update job status to failed
        with next(get_db()) as db:
            job = db.query(KbImportJob).filter(KbImportJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.completed_at = datetime.utcnow()
                db.commit()
        
        # Retry with exponential backoff and max retries
        max_retries = 3
        current_retries = getattr(job, 'retry_count', 0) or 0
        
        if current_retries >= max_retries:
            job.status = "failed_permanent"
            job.error_message = f"Job failed permanently after {max_retries} retries: {str(e)}"
            db.commit()
            return {"job_id": job_id, "status": "failed_permanent"}
        
        # Exponential backoff with jitter
        delay = min(300000 * (2 ** current_retries), 3600000)  # Max 1 hour
        jitter = random.randint(0, 10000)  # 0-10 seconds
        raise dramatiq.Retry(delay=delay + jitter)


def _process_csv_import(db: Session, job: KbImportJob, source: KbSource) -> dict:
    """Process CSV import for knowledge base"""
    print(f"Processing CSV import for job {job.id}")
    
    # Update progress
    job.progress_pct = 20
    db.commit()
    
    # TODO: Implement CSV processing
    # 1. Parse CSV with streaming
    # 2. Detect headers and suggest mapping
    # 3. Create chunks for AI processing
    # 4. Estimate costs
    
    # Mock processing for now
    import time
    time.sleep(2)
    
    # Update source status
    source.status = "completed"
    db.commit()
    
    # Track AI usage costs
    usage = AiUsage(
        id=f"usage_{secrets.token_urlsafe(8)}",
        workspace_id=job.workspace_id,
        kind="kb_extraction",
        tokens_in=100,  # Mock for now
        tokens_out=50,
        cost_micros=5000,  # $0.00005
        job_id=job.id
    )
    db.add(usage)
    db.commit()
    
    return {
        "job_id": job.id,
        "source_type": "csv",
        "chunks_created": 0,
        "estimated_cost_cents": 50,
        "tokens_used": 150
    }


def _process_file_import(db: Session, job: KbImportJob, source: KbSource) -> dict:
    """Process file import (PDF, DOCX, TXT, MD) for knowledge base"""
    print(f"Processing file import for job {job.id}")
    
    # Update progress
    job.progress_pct = 30
    db.commit()
    
    # TODO: Implement file processing
    # 1. Extract text from file
    # 2. Split into chunks (800-1200 tokens)
    # 3. Generate embeddings
    # 4. Extract structured data with AI
    
    # Mock processing for now
    import time
    time.sleep(3)
    
    # Update source status
    source.status = "completed"
    db.commit()
    
    return {
        "job_id": job.id,
        "source_type": "file",
        "chunks_created": 0,
        "estimated_cost_cents": 150
    }


def _process_url_import(db: Session, job: KbImportJob, source: KbSource) -> dict:
    """Process URL import for knowledge base"""
    print(f"Processing URL import for job {job.id}")
    
    # Update progress
    job.progress_pct = 40
    db.commit()
    
    # TODO: Implement URL processing
    # 1. Crawl URL with depth limit
    # 2. Extract text with Readability
    # 3. Split into chunks
    # 4. Generate embeddings
    
    # Mock processing for now
    import time
    time.sleep(2)
    
    # Update source status
    source.status = "completed"
    db.commit()
    
    return {
        "job_id": job.id,
        "source_type": "url",
        "chunks_created": 0,
        "estimated_cost_cents": 100
    }


@dramatiq.actor(queue_name='q:kb:embedding')
def kb_embedding_job(chunk_ids: list[str]):
    """Generate embeddings for knowledge base chunks"""
    try:
        print(f"Generating embeddings for {len(chunk_ids)} chunks")
        
        # TODO: Implement embedding generation
        # 1. Batch chunks (32 at a time)
        # 2. Call OpenAI embedding API
        # 3. Update kb_chunks.embedding
        # 4. Track costs in ai_usage
        
        # Mock processing for now
        import time
        time.sleep(1)
        
        print(f"Embeddings generated for {len(chunk_ids)} chunks")
        return {"success": True, "chunks_processed": len(chunk_ids)}
        
    except Exception as e:
        print(f"Embedding generation failed: {e}")
        raise dramatiq.Retry(delay=60000)  # Retry in 1 minute


@dramatiq.actor(queue_name='q:kb:extraction')
def kb_extraction_job(chunk_ids: list[str], template: str, lang: str = "en-US"):
    """Extract structured data from knowledge base chunks using AI"""
    try:
        print(f"Extracting data from {len(chunk_ids)} chunks using template {template}")
        
        # TODO: Implement AI extraction
        # 1. Get chunks from database
        # 2. Call AI client with template
        # 3. Update kb_fields with extracted data
        # 4. Track costs in ai_usage
        
        # Mock processing for now
        import time
        time.sleep(2)
        
        print(f"Data extraction completed for {len(chunk_ids)} chunks")
        return {"success": True, "chunks_processed": len(chunk_ids)}
        
    except Exception as e:
        print(f"Data extraction failed: {e}")
        raise dramatiq.Retry(delay=120000)  # Retry in 2 minutes


@dramatiq.actor(queue_name='q:kb:metrics')
def kb_metrics_recalculation_job(kb_id: str):
    """Recalculate KB completeness and freshness metrics"""
    try:
        print(f"Recalculating metrics for KB {kb_id}")
        
        # TODO: Implement metrics recalculation
        # 1. Count sections and fields
        # 2. Calculate completeness percentage
        # 3. Calculate freshness score
        # 4. Update knowledge_bases table
        
        # Mock processing for now
        import time
        time.sleep(0.5)
        
        print(f"Metrics recalculated for KB {kb_id}")
        return {"success": True, "kb_id": kb_id}
        
    except Exception as e:
        print(f"Metrics recalculation failed for KB {kb_id}: {e}")
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes


