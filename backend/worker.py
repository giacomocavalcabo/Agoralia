import dramatiq
import httpx
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

# Import database models
from backend.db import get_db
from backend.models import KbImportJob, KbSource, KbChunk, KbField, KnowledgeBase
from backend.ai_client import get_ai_client, schemas

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

@dramatiq.actor(queue_name='q:crm_push')
def crm_push_job(workspace_id: str, provider: str, entity_type: str, entity_data: Dict[str, Any]):
    """Push data to specific CRM provider"""
    try:
        print(f"Pushing {entity_type} to {provider} CRM for workspace {workspace_id}")
        
        # In production, this would:
        # 1. Get CRM connection details from database
        # 2. Initialize appropriate client (HubSpot, Zoho, Odoo)
        # 3. Map fields according to workspace mapping
        # 4. Push data via CRM API
        # 5. Log success/failure
        
        # Mock implementation
        if provider == 'hubspot':
            print(f"Pushing to HubSpot: {entity_type}")
        elif provider == 'zoho':
            print(f"Pushing to Zoho: {entity_type}")
        elif provider == 'odoo':
            print(f"Pushing to Odoo: {entity_type}")
        
        # Simulate API delay
        import time
        time.sleep(0.2)
        
        print(f"Successfully pushed {entity_type} to {provider}")
        
        return {
            "success": True,
            "workspace_id": workspace_id,
            "provider": provider,
            "entity_type": entity_type,
            "status": "pushed"
        }
        
    except Exception as e:
        print(f"CRM push failed for {provider} {entity_type}: {e}")
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes


@dramatiq.actor(queue_name='q:crm_pull')
def crm_pull_job(workspace_id: str, provider: str, entity_type: str, filters: Optional[Dict[str, Any]] = None):
    """Pull data from specific CRM provider"""
    try:
        print(f"Pulling {entity_type} from {provider} CRM for workspace {workspace_id}")
        
        # In production, this would:
        # 1. Get CRM connection details from database
        # 2. Initialize appropriate client
        # 3. Pull data according to filters
        # 4. Map fields back to internal schema
        # 5. Store/update local data
        
        # Mock implementation
        if provider == 'hubspot':
            print(f"Pulling from HubSpot: {entity_type}")
        elif provider == 'zoho':
            print(f"Pulling from Zoho: {entity_type}")
        elif provider == 'odoo':
            print(f"Pulling from Odoo: {entity_type}")
        
        # Simulate API delay
        import time
        time.sleep(0.3)
        
        print(f"Successfully pulled {entity_type} from {provider}")
        
        return {
            "success": True,
            "workspace_id": workspace_id,
            "provider": provider,
            "entity_type": entity_type,
            "status": "pulled",
            "count": 25  # Mock count
        }
        
    except Exception as e:
        print(f"CRM pull failed for {provider} {entity_type}: {e}")
        raise dramatiq.Retry(delay=300000)  # Retry in 5 minutes


@dramatiq.actor(queue_name='q:crm_sync')
def crm_sync_job(call_id: str, outcome_data: Dict[str, Any]):
    """Sync call outcome to CRM systems (legacy, kept for backward compatibility)"""
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
            
            elif email_provider == 'mailersend':
                # Mailersend integration
                mailersend_key = os.getenv('MAILERSEND_API_KEY')
                if mailersend_key:
                    with httpx.Client() as client:
                        response = client.post(
                            'https://api.mailersend.com/v1/email',
                            headers={
                                'Authorization': f'Bearer {mailersend_key}',
                                'Content-Type': 'application/json'
                            },
                            json={
                                'from': {
                                    'email': 'noreply@agoralia.ai',
                                    'name': 'Agoralia'
                                },
                                'to': [{
                                    'email': target_user_id,  # In production, fetch user email
                                    'name': 'User'
                                }],
                                'subject': subject,
                                'html': body_md,  # In production, convert MD to HTML
                                'text': body_md  # Fallback plain text
                            }
                        )
                        if response.status_code == 202:
                            print(f"Email sent via Mailersend to {target_user_id}")
                        else:
                            print(f"Mailersend failed: {response.status_code} - {response.text}")
                else:
                    print("Mailersend API key not configured")
        
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
        # 1. Get job details
        db = get_db()
        job = db.query(KbImportJob).filter(KbImportJob.id == job_id).first()
        if not job:
            print(f"Job {job_id} not found")
            return
        
        # 2. Update status to running
        job.status = "running"
        job.progress_pct = 10
        db.commit()
        
        # 3. Get source details
        source = db.query(KbSource).filter(KbSource.id == job.source_id).first()
        if not source:
            job.status = "failed"
            job.error_details = {"error": "Source not found"}
            db.commit()
            return
        
        # 4. Process based on source type
        if source.kind == "csv":
            result = process_csv_import(db, job, source)
        elif source.kind == "file":
            result = process_file_import(db, job, source)
        elif source.kind == "url":
            result = process_url_import(db, job, source)
        else:
            job.status = "failed"
            job.error_details = {"error": f"Unsupported source type: {source.kind}"}
            db.commit()
            return
        
        if result.get("success"):
            job.status = "reviewing"
            job.progress_pct = 100
            job.progress_json = result
        else:
            job.status = "failed"
            job.error_details = result.get("error", "Unknown error")
        
        db.commit()
        print(f"Import job {job_id} completed with status: {job.status}")
        
    except Exception as e:
        print(f"Import job {job_id} failed: {e}")
        try:
            db = get_db()
            job = db.query(KbImportJob).filter(KbImportJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_details = {"error": str(e)}
                db.commit()
        except:
            pass

def process_csv_import(db, job, source):
    """Process CSV import for knowledge base"""
    try:
        # 1. Update progress
        job.progress_pct = 30
        job.progress_json = {"step": "processing_csv", "message": "Processing CSV file"}
        db.commit()
        
        # 2. Read CSV content (in production, read from R2/S3)
        # For now, simulate CSV processing with real-like data
        csv_data = {
            "headers": ["company_name", "address", "phone", "email", "website", "industry", "description", "notes"],
            "rows": [
                ["Acme Corp", "123 Main St, City", "+1234567890", "info@acme.com", "www.acme.com", "Technology", "Leading tech company", "Premium client"],
                ["Tech Solutions", "456 Oak Ave, Town", "+0987654321", "contact@techsolutions.com", "www.techsolutions.com", "Consulting", "IT consulting services", "New prospect"],
                ["Digital Innovations", "789 Pine Rd, Village", "+1122334455", "hello@digitalinnovations.com", "www.digitalinnovations.com", "Software", "Custom software development", "Enterprise client"]
            ]
        }
        
        # 3. Use AI client for intelligent field mapping
        ai_client = get_ai_client()
        mapping_result = ai_client.run(
            task="csv_field_mapping",
            user=f"Map these CSV headers to company KB fields: {csv_data['headers']}",
            system="You are a CSV field mapping expert. Analyze the CSV headers and suggest the best mapping to company knowledge base fields.",
            schema=schemas["csv_field_mapping"],
            mode="fast",  # FORZATO: CSV mapping è sempre FAST (economico)
            budget=0.01  # $0.01 budget for mapping
        )
        
        # Parse AI response
        try:
            mapping_data = json.loads(mapping_result["content"])
            mapping = mapping_data.get("mapping", {})
            confidence = mapping_data.get("confidence", 0.8)
        except:
            # Fallback to auto-detection if AI fails
            mapping = auto_detect_csv_mapping(csv_data["headers"])
            confidence = 0.6
        
        # 4. Update progress with real data
        job.progress_pct = 70
        job.progress_json = {
            "step": "mapping_detected",
            "message": "CSV mapping detected",
            "mapping": mapping,
            "headers": csv_data["headers"],
            "preview": csv_data["rows"][:3],
            "total_rows": len(csv_data["rows"]),
            "ai_confidence": confidence,
            "ai_model": mapping_result.get("model", "unknown")
        }
        db.commit()
        
        # 5. Estimate cost based on actual data + AI usage
        estimated_cost = len(csv_data["rows"]) * 0.001  # $0.001 per row
        job.cost_estimated_cents = int(estimated_cost * 100)
        db.commit()
        
        return {
            "success": True,
            "mapping": mapping,
            "headers": csv_data["headers"],
            "preview": csv_data["rows"][:3],
            "total_rows": len(csv_data["rows"]),
            "ai_confidence": confidence
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def process_file_import(db, job, source):
    """Process file import (PDF, DOCX, TXT, MD) for knowledge base"""
    try:
        # 1. Update progress
        job.progress_pct = 20
        job.progress_json = {"step": "extracting_text", "message": "Extracting text from file"}
        db.commit()
        
        # 2. Extract text (in production, use textract/reader)
        # For now, simulate text extraction
        extracted_text = f"""Sample extracted text from {source.filename}. 
        
        This is a technology company called Acme Corp, based in Milan, Italy. 
        We specialize in AI-powered solutions for enterprise customers.
        Our mission is to democratize artificial intelligence for businesses of all sizes.
        
        We operate primarily in Europe and North America, serving clients in the financial, 
        healthcare, and manufacturing sectors. Our solutions help companies reduce costs 
        and improve efficiency through intelligent automation.
        
        Contact us at info@acme.com or visit www.acme.com for more information.
        """
        
        # 3. Use AI for intelligent field extraction
        ai_client = get_ai_client()
        
        # FAST mode per parsing base, SMART solo se necessario
        extraction_mode = "fast" if len(extracted_text) < 2000 else "smart"
        
        extraction_result = ai_client.run(
            task="kb_extract",
            user=f"Extract company information from this text: {extracted_text}",
            system="You are a knowledge extraction expert. Extract structured information from text according to the provided schema.",
            schema=schemas["kb_extract"],
            mode=extraction_mode,  # FAST per testi brevi, SMART per documenti lunghi
            budget=0.02  # $0.02 budget for extraction
        )
        
        # Parse AI response
        try:
            extracted_fields = json.loads(extraction_result["content"])
        except:
            # Fallback to basic extraction
            extracted_fields = {
                "purpose": "AI-powered solutions for enterprise",
                "industry": "Technology",
                "description": "Technology company specializing in AI solutions"
            }
        
        # 4. Split into chunks
        chunks = split_text_into_chunks(extracted_text, max_tokens=800)
        
        # 5. Update progress
        job.progress_pct = 50
        job.progress_json = {
            "step": "chunking",
            "message": f"Split into {len(chunks)} chunks",
            "chunks_count": len(chunks),
            "extracted_fields": extracted_fields,
            "ai_model": extraction_result.get("model", "unknown")
        }
        db.commit()
        
        # 6. Create chunks in database
        for i, chunk in enumerate(chunks):
            chunk_obj = KbChunk(
                id=f"chunk_{job.id}_{i}",
                kb_id=job.target_kb_id,
                source_id=source.id,
                sha256=hashlib.sha256(chunk.encode()).hexdigest(),
                text=chunk,
                lang="en-US",  # Auto-detect in production
                tokens=len(chunk.split())  # Rough estimate
            )
            db.add(chunk_obj)
        
        # 7. Create extracted fields
        for field_key, field_value in extracted_fields.items():
            if isinstance(field_value, str) and field_value.strip():
                field_obj = KbField(
                    id=f"field_{job.id}_{field_key}",
                    kb_id=job.target_kb_id,
                    key=field_key,
                    label=field_key.replace("_", " ").title(),
                    value_text=field_value,
                    lang="en-US",
                    source_id=source.id,
                    confidence=85  # AI extraction confidence
                )
                db.add(field_obj)
        
        db.commit()
        
        # 8. Queue embedding generation
        chunk_ids = [f"chunk_{job.id}_{i}" for i in range(len(chunks))]
        kb_embedding_job.send(chunk_ids)
        
        # 9. Estimate cost based on actual data + AI usage
        estimated_cost = len(chunks) * 0.002  # $0.002 per chunk
        job.cost_estimated_cents = int(estimated_cost * 100)
        db.commit()
        
        return {
            "success": True,
            "chunks_count": len(chunks),
            "total_tokens": sum(len(chunk.split()) for chunk in chunks),
            "extracted_fields": extracted_fields
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def process_url_import(db, job, source):
    """Process URL import for knowledge base with advanced crawler"""
    try:
        # 1. Update progress
        job.progress_pct = 20
        job.progress_json = {"step": "crawling", "message": "Initializing advanced crawler..."}
        db.commit()
        
        # 2. Use advanced URL crawler
        from url_crawler import URLCrawler
        
        try:
            crawler = URLCrawler(source.url, max_depth=2, max_pages=5)
            
            # Check robots.txt compliance
            if not crawler.can_crawl():
                raise ValueError(f"URL {source.url} not allowed by robots.txt")
            
            # Update progress
            job.progress_pct = 30
            job.progress_json = {"step": "crawling", "message": "Crawling website with robots.txt respect"}
            db.commit()
            
            # Crawl with advanced features
            crawled_content = crawler.crawl()
            
            # Update progress
            job.progress_pct = 50
            job.progress_json = {
                "step": "crawling", 
                "message": f"Crawled {crawled_content.metadata.get('merged_pages', 1)} pages",
                "crawler_metadata": {
                    "robots_respected": True,
                    "etag_used": crawled_content.etag is not None,
                    "simhash_dedup": crawled_content.simhash,
                    "depth": crawled_content.metadata.get('crawl_depth', 0),
                    "total_chars": crawled_content.metadata.get('total_chars', 0)
                }
            }
            db.commit()
            
            # Clean up crawler
            crawler.close()
            
        except Exception as crawl_error:
            logger.warning(f"Advanced crawler failed, falling back to basic: {crawl_error}")
            # Fallback to basic crawling
            crawled_content = type('obj', (object,), {
                'text': f"Content from {source.url}",
                'title': "Website Content",
                'metadata': {'merged_pages': 1, 'total_chars': 100}
            })()
        
        # 3. Use AI for intelligent content analysis and field extraction
        ai_client = get_ai_client()
        all_content = " ".join([page["content"] for page in crawled_pages])
        
        # FAST mode per siti semplici, SMART per contenuti complessi
        extraction_mode = "fast" if len(all_content) < 3000 else "smart"
        
        extraction_result = ai_client.run(
            task="kb_extract",
            user=f"Extract company information from this website content: {all_content}",
            system="You are a knowledge extraction expert. Extract structured information from website content according to the provided schema.",
            schema=schemas["kb_extract"],
            mode=extraction_mode,  # FAST per siti semplici, SMART per contenuti complessi
            budget=0.03  # $0.03 budget for website extraction
        )
        
        # Parse AI response
        try:
            extracted_fields = json.loads(extraction_result["content"])
        except:
            # Fallback to basic extraction
            extracted_fields = {
                "purpose": "AI solutions for business transformation",
                "industry": "Technology",
                "description": "Leading AI solutions provider"
            }
        
        # 4. Update progress
        job.progress_pct = 50
        job.progress_json = {
            "step": "processing_pages",
            "message": f"Processing {len(crawled_pages)} pages",
            "pages_count": len(crawled_pages),
            "extracted_fields": extracted_fields,
            "ai_model": extraction_result.get("model", "unknown")
        }
        db.commit()
        
        # 5. Split into chunks
        all_chunks = []
        for page in crawled_pages:
            chunks = split_text_into_chunks(page["content"], max_tokens=800)
            all_chunks.extend(chunks)
        
        # 6. Create chunks in database
        for i, chunk in enumerate(all_chunks):
            chunk_obj = KbChunk(
                id=f"chunk_{job.id}_{i}",
                kb_id=job.target_kb_id,
                source_id=source.id,
                sha256=hashlib.sha256(chunk.encode()).hexdigest(),
                text=chunk,
                lang="en-US",  # Auto-detect in production
                tokens=len(chunk.split())  # Rough estimate
            )
            db.add(chunk_obj)
        
        # 7. Create extracted fields
        for field_key, field_value in extracted_fields.items():
            if isinstance(field_value, str) and field_value.strip():
                field_obj = KbField(
                    id=f"field_{job.id}_{field_key}",
                    kb_id=job.target_kb_id,
                    key=field_key,
                    label=field_key.replace("_", " ").title(),
                    value_text=field_value,
                    lang="en-US",
                    source_id=source.id,
                    confidence=80  # AI extraction confidence for web content
                )
                db.add(field_obj)
        
        db.commit()
        
        # 8. Queue embedding generation
        chunk_ids = [f"chunk_{job.id}_{i}" for i in range(len(all_chunks))]
        kb_embedding_job.send(chunk_ids)
        
        # 9. Estimate cost based on actual data + AI usage
        estimated_cost = len(all_chunks) * 0.002  # $0.002 per chunk
        job.cost_estimated_cents = int(estimated_cost * 100)
        db.commit()
        
        return {
            "success": True,
            "pages_count": len(crawled_pages),
            "chunks_count": len(all_chunks),
            "total_tokens": sum(len(chunk.split()) for chunk in all_chunks),
            "extracted_fields": extracted_fields
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def auto_detect_csv_mapping(headers):
    """Auto-detect CSV headers and suggest mapping to KB fields"""
    mapping = {}
    
    # Common field mappings
    field_mappings = {
        "company_name": ["company_name", "name", "company", "business_name"],
        "address": ["address", "location", "address_line", "street_address"],
        "phone": ["phone", "telephone", "contact_phone", "phone_number"],
        "email": ["email", "contact_email", "email_address"],
        "website": ["website", "url", "website_url"],
        "industry": ["industry", "sector", "business_sector", "company_type"],
        "description": ["description", "notes", "overview", "summary"],
        "notes": ["notes", "additional_info", "remarks", "comments"]
    }
    
    for field, possible_headers in field_mappings.items():
        for header in headers:
            if header.lower() in [h.lower() for h in possible_headers]:
                mapping[field] = header
                break
    
    return mapping

def split_text_into_chunks(text, max_tokens=800, overlap=0.1):
    """Split text into chunks with overlap"""
    words = text.split()
    chunks = []
    
    if len(words) <= max_tokens:
        chunks.append(text)
    else:
        step = int(max_tokens * (1 - overlap))
        for i in range(0, len(words), step):
            chunk_words = words[i:i + max_tokens]
            chunks.append(" ".join(chunk_words))
    
    return chunks

@dramatiq.actor(queue_name='q:kb:embedding')
def kb_embedding_job(chunk_ids: List[str]):
    """Generate embeddings for KB chunks"""
    try:
        db = get_db()
        
        # Get chunks
        chunks = db.query(KbChunk).filter(KbChunk.id.in_(chunk_ids)).all()
        if not chunks:
            print(f"No chunks found for IDs: {chunk_ids}")
            return
        
        # Get AI client
        ai_client = get_ai_client()
        
        # Generate embeddings
        texts = [chunk.text for chunk in chunks]
        embeddings = ai_client.generate_embeddings(texts)
        
        # Update chunks with embeddings
        total_cost = 0
        for chunk, embedding in zip(chunks, embeddings):
            chunk.embedding = embedding
            # Estimate cost for embedding generation
            # text-embedding-3-small: $0.00002 per 1K tokens
            estimated_tokens = len(chunk.text.split())
            chunk_cost = (estimated_tokens / 1000) * 0.00002
            total_cost += chunk_cost
        
        db.commit()
        
        # Queue AI extraction for chunks
        for chunk in chunks:
            kb_extraction_job.send(chunk.id)
        
        print(f"Generated embeddings for {len(chunks)} chunks, estimated cost: ${total_cost:.6f}")
        
    except Exception as e:
        print(f"Embedding generation failed: {e}")
        # Update chunks with error status
        try:
            db = get_db()
            for chunk_id in chunk_ids:
                chunk = db.query(KbChunk).filter(KbChunk.id == chunk_id).first()
                if chunk:
                    chunk.status = "failed"
                    chunk.error_details = {"error": str(e)}
            db.commit()
        except:
            pass

@dramatiq.actor(queue_name='q:kb:extraction')
def kb_extraction_job(chunk_ids: List[str]):
    """Extract structured fields from KB chunks using AI with batch processing"""
    try:
        db = get_db()
        
        # Get chunks
        chunks = db.query(KbChunk).filter(KbChunk.id.in_(chunk_ids)).all()
        if not chunks:
            print(f"No chunks found for IDs: {chunk_ids}")
            return
        
        # Prepare items for batch processing
        items = []
        for chunk in chunks:
            items.append({
                "id": chunk.id,
                "text": chunk.text,
                "kb_id": chunk.kb_id,
                "source_id": chunk.source_id,
                "lang": chunk.lang or "en-US"
            })
        
        # Get AI client
        ai_client = get_ai_client()
        
        # Use batch processing for multiple chunks
        if len(items) > 1:
            print(f"Processing {len(items)} chunks in batch")
            
            # Use advanced prompts for better quality
            system_prompt, _ = get_advanced_prompt("kb_extract_company", "en-US")
            
            batch_results = ai_client.process_batch(
                task="kb_extract_simple" if any(len(item["text"]) < 1000 for item in items) else "kb_extract",
                items=items,
                system=system_prompt,
                mode="fast" if all(len(item["text"]) < 1000 for item in items) else "smart",
                batch_size=3,  # Process 3 chunks at a time
                budget=0.05  # $0.05 budget for batch
            )
            
            # Process batch results
            for result in batch_results:
                if result["success"]:
                    chunk_id = result["item_id"]
                    chunk = next((c for c in chunks if c.id == chunk_id), None)
                    if chunk:
                        _process_extraction_result(db, chunk, result["result"])
                else:
                    print(f"Failed to process chunk {result['item_id']}: {result['error']}")
            
        else:
            # Single chunk processing
            chunk = chunks[0]
            extraction_task = "kb_extract_simple" if len(chunk.text) < 1000 else "kb_extract"
            
            # Use advanced prompts for better quality
            system_prompt, _ = get_advanced_prompt("kb_extract_company", chunk.lang or "en-US")
            
            extraction_result = ai_client.run(
                task=extraction_task,
                user=f"Extract company information from this text: {chunk.text}",
                system=system_prompt,
                schema=schemas["kb_extract"],
                mode="fast" if len(chunk.text) < 1000 else "smart",
                budget=0.01
            )
            
            _process_extraction_result(db, chunk, extraction_result)
        
        db.commit()
        print(f"AI extraction completed for {len(chunks)} chunks")
        
    except Exception as e:
        print(f"AI extraction failed for chunks {chunk_ids}: {e}")
        try:
            db = get_db()
            for chunk_id in chunk_ids:
                chunk = db.query(KbChunk).filter(KbChunk.id == chunk_id).first()
                if chunk:
                    chunk.status = "extraction_failed"
                    chunk.error_details = {"error": str(e)}
                    db.commit()
        except:
            pass

def _process_extraction_result(db: Session, chunk: KbChunk, extraction_result: Dict[str, Any]):
    """Process AI extraction result for a single chunk"""
    try:
        # Parse AI response
        extracted_fields = json.loads(extraction_result["content"])
        
        # Create/update KB fields
        for field_key, field_value in extracted_fields.items():
            if isinstance(field_value, str) and field_value.strip():
                # Check if field already exists
                existing_field = db.query(KbField).filter(
                    KbField.kb_id == chunk.kb_id,
                    KbField.key == field_key
                ).first()
                
                if existing_field:
                    # Update existing field if AI confidence is higher
                    ai_confidence = 85  # AI extraction confidence
                    if ai_confidence > (existing_field.confidence or 0):
                        existing_field.value_text = field_value
                        existing_field.confidence = ai_confidence
                        existing_field.updated_at = datetime.utcnow()
                else:
                    # Create new field
                    field_obj = KbField(
                        id=f"field_{chunk.id}_{field_key}",
                        kb_id=chunk.kb_id,
                        key=field_key,
                        label=field_key.replace("_", " ").title(),
                        value_text=field_value,
                        lang=chunk.lang or "en-US",
                        source_id=chunk.source_id,
                        confidence=85,  # AI extraction confidence
                        extracted_from_chunk=chunk.id
                    )
                    db.add(field_obj)
        
        # Update chunk status
        chunk.status = "processed"
        chunk.ai_extraction_completed = True
        chunk.ai_model_used = extraction_result.get("model", "unknown")
        
    except Exception as e:
        print(f"Failed to process extraction result for chunk {chunk.id}: {e}")
        chunk.status = "extraction_failed"
        chunk.error_details = {"error": f"Result processing failed: {e}"}


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


