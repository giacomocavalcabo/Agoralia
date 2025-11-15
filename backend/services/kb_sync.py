"""Knowledge Base synchronization service: Agoralia KB → Retell KB (lazy sync)"""
import json
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException

from models.agents import KnowledgeBase, KnowledgeSection
from utils.retell import retell_post_multipart, retell_delete_json, retell_get_json, get_retell_api_key
from config.database import engine

logger = logging.getLogger(__name__)


def _kb_sections_to_retell_texts(sections: List[KnowledgeSection]) -> List[Dict[str, str]]:
    """Convert Agoralia KnowledgeSection objects to Retell knowledge_base_texts format"""
    texts: List[Dict[str, str]] = []
    for sec in sections:
        if sec.content_text:
            # Create title based on kind and content preview
            title = sec.kind.capitalize()
            if sec.content_text:
                preview = sec.content_text[:50].replace("\n", " ")
                title = f"{title}: {preview}..."
            texts.append({
                "text": sec.content_text,
                "title": title
            })
    return texts


async def sync_kb_to_retell(
    kb_id: int,
    session: Session,
    tenant_id: Optional[int] = None,
    force: bool = False
) -> str:
    """Synchronize Agoralia KB to Retell AI (lazy sync)
    
    Creates or updates a Retell KB from Agoralia KB.
    If KB already has retell_kb_id, updates it; otherwise creates new.
    
    Args:
        kb_id: Agoralia KB ID
        session: Database session
        tenant_id: Tenant ID (for BYO Retell account)
        force: Force sync even if retell_kb_id exists (recreates KB)
    
    Returns:
        retell_kb_id: Retell KB ID
    
    Raises:
        HTTPException: If KB not found or sync fails
    """
    # Get KB from database
    kb = session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge Base {kb_id} not found")
    
    if tenant_id is not None and kb.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="KB not found")
    
    # Get all sections for this KB
    sections = (
        session.query(KnowledgeSection)
        .filter(KnowledgeSection.kb_id == kb_id)
        .order_by(KnowledgeSection.id.asc())
        .all()
    )
    
    # Convert sections to Retell format
    knowledge_base_texts = _kb_sections_to_retell_texts(sections)
    
    # Prepare KB name (Retell requires max 40 chars)
    kb_name = f"KB-{kb_id}"
    if kb.lang:
        kb_name = f"{kb.lang}-{kb_name}"
    kb_name = kb_name[:40]  # Retell limit
    
    # If KB already has retell_kb_id and not forcing, update existing
    if kb.retell_kb_id and not force:
        retell_kb_id = kb.retell_kb_id
        logger.info(f"[sync_kb_to_retell] Updating existing Retell KB {retell_kb_id} for Agoralia KB {kb_id}")
        
        # Update sources in Retell KB
        if knowledge_base_texts:
            try:
                form_data = {
                    "knowledge_base_texts": json.dumps(knowledge_base_texts)
                }
                await retell_post_multipart(
                    f"/add-knowledge-base-sources/{retell_kb_id}",
                    data=form_data,
                    tenant_id=tenant_id
                )
                logger.info(f"[sync_kb_to_retell] Updated sources for Retell KB {retell_kb_id}")
            except Exception as e:
                logger.error(f"[sync_kb_to_retell] Error updating sources: {e}")
                raise HTTPException(status_code=500, detail=f"Error updating KB sources: {str(e)}")
        
        return retell_kb_id
    
    # Create new KB in Retell
    logger.info(f"[sync_kb_to_retell] Creating new Retell KB for Agoralia KB {kb_id}")
    
    try:
        form_data: Dict[str, Any] = {
            "knowledge_base_name": kb_name,
        }
        
        if knowledge_base_texts:
            form_data["knowledge_base_texts"] = json.dumps(knowledge_base_texts)
        
        # Create KB in Retell
        response = await retell_post_multipart(
            "/create-knowledge-base",
            data=form_data,
            tenant_id=tenant_id
        )
        
        retell_kb_id = response.get("knowledge_base_id")
        if not retell_kb_id:
            raise HTTPException(status_code=500, detail="Retell API did not return knowledge_base_id")
        
        # Save retell_kb_id to Agoralia KB
        kb.retell_kb_id = retell_kb_id
        session.commit()
        
        logger.info(f"[sync_kb_to_retell] Created Retell KB {retell_kb_id} for Agoralia KB {kb_id}")
        return retell_kb_id
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[sync_kb_to_retell] Error creating Retell KB: {e}")
        raise HTTPException(status_code=500, detail=f"Error syncing KB to Retell: {str(e)}")


async def sync_kb_delete_from_retell(
    kb_id: int,
    session: Session,
    tenant_id: Optional[int] = None
) -> bool:
    """Delete Retell KB when Agoralia KB is deleted
    
    Args:
        kb_id: Agoralia KB ID
        session: Database session
        tenant_id: Tenant ID (for BYO Retell account)
    
    Returns:
        True if deleted, False if no retell_kb_id exists
    
    Raises:
        HTTPException: If KB not found or deletion fails
    """
    kb = session.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge Base {kb_id} not found")
    
    if tenant_id is not None and kb.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="KB not found")
    
    if not kb.retell_kb_id:
        logger.info(f"[sync_kb_delete_from_retell] KB {kb_id} has no retell_kb_id, skipping deletion")
        return False
    
    try:
        retell_kb_id = kb.retell_kb_id
        await retell_delete_json(f"/delete-knowledge-base/{retell_kb_id}", tenant_id=tenant_id)
        logger.info(f"[sync_kb_delete_from_retell] Deleted Retell KB {retell_kb_id} for Agoralia KB {kb_id}")
        return True
    except HTTPException as e:
        # If Retell KB doesn't exist, log warning but don't fail
        if e.status_code == 404:
            logger.warning(f"[sync_kb_delete_from_retell] Retell KB {kb.retell_kb_id} not found, skipping")
            return False
        raise
    except Exception as e:
        logger.error(f"[sync_kb_delete_from_retell] Error deleting Retell KB: {e}")
        # Don't fail deletion of Agoralia KB if Retell deletion fails
        logger.warning(f"[sync_kb_delete_from_retell] Continuing with Agoralia KB deletion despite Retell error")
        return False


async def ensure_kb_synced(
    kb_id: int,
    session: Session,
    tenant_id: Optional[int] = None
) -> Optional[str]:
    """Ensure KB is synced to Retell (lazy sync helper)
    
    If KB has retell_kb_id, returns it.
    If not, syncs KB to Retell and returns new retell_kb_id.
    
    Args:
        kb_id: Agoralia KB ID
        session: Database session
        tenant_id: Tenant ID (for BYO Retell account)
    
    Returns:
        retell_kb_id: Retell KB ID, or None if KB not found
    """
    kb = session.get(KnowledgeBase, kb_id)
    if not kb:
        return None
    
    if kb.retell_kb_id:
        return kb.retell_kb_id
    
    # Lazy sync: create Retell KB on demand
    logger.info(f"[ensure_kb_synced] KB {kb_id} has no retell_kb_id, syncing to Retell...")
    try:
        retell_kb_id = await sync_kb_to_retell(kb_id, session, tenant_id, force=False)
        return retell_kb_id
    except Exception as e:
        logger.error(f"[ensure_kb_synced] Error syncing KB {kb_id}: {e}")
        return None

