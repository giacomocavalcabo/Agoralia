from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import User, Workspace, WorkspaceMember, KnowledgeBase, KbSection, KbField, KbSource, KbImportJob
from typing import Optional, Callable
import logging

logger = logging.getLogger(__name__)

class WorkspaceOwnershipMiddleware:
    """Middleware to ensure workspace ownership for KB operations"""
    
    def __init__(self):
        self.kb_models = {
            'kb_id': KnowledgeBase,
            'section_id': KbSection,
            'field_id': KbField,
            'source_id': KbSource,
            'job_id': KbImportJob
        }
    
    async def verify_workspace_ownership(
        self,
        request: Request,
        db: Session,
        user: User,
        required_role: str = 'viewer'
    ) -> Workspace:
        """Verify user has access to workspace and required role"""
        
        # Extract workspace ID from various sources
        workspace_id = self._extract_workspace_id(request)
        if not workspace_id:
            raise HTTPException(status_code=400, detail="Workspace ID required")
        
        # Verify workspace exists
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Check user membership and role
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id
        ).first()
        
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied to workspace")
        
        # Check role permissions
        if required_role == 'admin' and membership.role not in ['admin']:
            raise HTTPException(status_code=403, detail="Admin role required")
        elif required_role == 'editor' and membership.role not in ['admin', 'editor']:
            raise HTTPException(status_code=403, detail="Editor or admin role required")
        
        return workspace
    
    async def verify_resource_ownership(
        self,
        request: Request,
        db: Session,
        user: User,
        resource_type: str,
        resource_id: str,
        required_role: str = 'viewer'
    ) -> tuple[Workspace, object]:
        """Verify user owns the specific resource and has required role"""
        
        # First verify workspace access
        workspace = await self.verify_workspace_ownership(request, db, user, required_role)
        
        # Get the resource model
        model_class = self.kb_models.get(resource_type)
        if not model_class:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
        
        # Query resource and verify ownership
        resource = db.query(model_class).filter(
            model_class.id == resource_id,
            model_class.workspace_id == workspace.id
        ).first()
        
        if not resource:
            raise HTTPException(status_code=404, detail=f"{resource_type} not found")
        
        return workspace, resource
    
    def _extract_workspace_id(self, request: Request) -> Optional[str]:
        """Extract workspace ID from various request sources"""
        
        # Path parameters
        if hasattr(request, 'path_params'):
            workspace_id = request.path_params.get('workspace_id')
            if workspace_id:
                return workspace_id
        
        # Query parameters
        workspace_id = request.query_params.get('workspace_id')
        if workspace_id:
            return workspace_id
        
        # Body parameters (for POST/PUT requests)
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                body = request.json()
                if body and 'workspace_id' in body:
                    return body['workspace_id']
            except:
                pass
        
        # Headers (fallback)
        workspace_id = request.headers.get('x-workspace-id')
        if workspace_id:
            return workspace_id
        
        return None

# Dependency functions for common ownership checks
async def require_workspace_access(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_with_rbac)
) -> Workspace:
    """Require basic workspace access (viewer role)"""
    middleware = WorkspaceOwnershipMiddleware()
    return await middleware.verify_workspace_ownership(request, db, user, 'viewer')

async def require_workspace_editor(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_with_rbac)
) -> Workspace:
    """Require editor or admin role in workspace"""
    middleware = WorkspaceOwnershipMiddleware()
    return await middleware.verify_workspace_ownership(request, db, user, 'editor')

async def require_workspace_admin(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_with_rbac)
) -> Workspace:
    """Require admin role in workspace"""
    middleware = WorkspaceOwnershipMiddleware()
    return await middleware.verify_workspace_ownership(request, db, user, 'admin')

async def require_resource_ownership(
    request: Request,
    resource_type: str,
    resource_id: str,
    required_role: str = 'viewer',
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_with_rbac)
) -> tuple[Workspace, object]:
    """Require ownership of specific resource"""
    middleware = WorkspaceOwnershipMiddleware()
    return await middleware.verify_resource_ownership(
        request, db, user, resource_type, resource_id, required_role
    )
