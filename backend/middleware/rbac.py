from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Workspace, WorkspaceMember
from typing import Optional, Callable
import logging

logger = logging.getLogger(__name__)

class RBACMiddleware:
    """Role-Based Access Control middleware"""
    
    def __init__(self):
        self.admin_routes = {
            '/admin': ['admin'],
            '/admin/kpi': ['admin'],
            '/admin/calls/live': ['admin'],
            '/admin/usage': ['admin'],
            '/admin/compliance': ['admin'],
            '/admin/users': ['admin'],
            '/admin/numbers': ['admin']
        }
        
        self.settings_routes = {
            '/settings': ['admin', 'editor'],
            '/settings/workspace': ['admin'],
            '/settings/members': ['admin'],
            '/settings/telephony': ['admin'],
            '/settings/agents': ['admin'],
            '/settings/compliance': ['admin'],
            '/settings/integrations': ['admin'],
            '/settings/security': ['admin']
        }
        
        self.billing_routes = {
            '/billing': ['admin', 'editor'],
            '/billing/payment-methods': ['admin', 'editor'],
            '/billing/auto-recharge': ['admin'],
            '/billing/cap': ['admin']
        }
    
    async def __call__(self, request: Request, call_next):
        """Main middleware function"""
        
        # Skip RBAC for public routes
        if self._is_public_route(request.url.path):
            return await call_next(request)
        
        # Get user from request (assuming JWT token in header)
        user = await self._get_current_user(request)
        if not user:
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"}
            )
        
        # Check permissions for protected routes
        if not self._has_permission(request.url.path, user, request):
            return JSONResponse(
                status_code=403,
                content={"detail": "Insufficient permissions"}
            )
        
        # Add user to request state for downstream use
        request.state.user = user
        
        return await call_next(request)
    
    def _is_public_route(self, path: str) -> bool:
        """Check if route is public (no auth required)"""
        public_routes = [
            '/health',
            '/docs',
            '/openapi.json',
            '/auth/login',
            '/auth/register',
            '/auth/magic/request',
            '/auth/magic/verify',
            '/auth/oauth/google/start',
            '/auth/oauth/google/callback'
        ]
        
        return any(path.startswith(route) for route in public_routes)
    
    async def _get_current_user(self, request: Request) -> Optional[User]:
        """Extract current user from request (JWT token)"""
        # This is a simplified version - in production, you'd verify JWT tokens
        auth_header = request.headers.get('authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        # In production, verify JWT token and get user
        # For now, return a mock user for testing
        return User(
            id="test_user",
            email="test@example.com",
            is_admin_global=False
        )
    
    def _has_permission(self, path: str, user: User, request: Request) -> bool:
        """Check if user has permission for the requested route"""
        
        # Global admin has access to everything
        if user.is_admin_global:
            return True
        
        # Check admin routes
        if any(path.startswith(route) for route in self.admin_routes.keys()):
            return False  # Only global admins can access admin routes
        
        # Check settings routes
        if any(path.startswith(route) for route in self.settings_routes.keys()):
            required_roles = self._get_required_roles(path, self.settings_routes)
            return self._check_workspace_permission(user, request, required_roles)
        
        # Check billing routes
        if any(path.startswith(route) for route in self.billing_routes.keys()):
            required_roles = self._get_required_roles(path, self.billing_routes)
            return self._check_workspace_permission(user, request, required_roles)
        
        # Default: allow access
        return True
    
    def _get_required_roles(self, path: str, route_config: dict) -> list:
        """Get required roles for a specific route"""
        for route, roles in route_config.items():
            if path.startswith(route):
                return roles
        return []
    
    def _check_workspace_permission(self, user: User, request: Request, required_roles: list) -> bool:
        """Check if user has required role in the current workspace"""
        
        # Get workspace ID from request (could be in path, query, or body)
        workspace_id = self._extract_workspace_id(request)
        if not workspace_id:
            return False
        
        # In production, you'd check the database for workspace membership
        # For now, return True for testing
        return True
    
    def _extract_workspace_id(self, request: Request) -> Optional[str]:
        """Extract workspace ID from request"""
        
        # Try to get from path parameters
        if hasattr(request, 'path_params'):
            workspace_id = request.path_params.get('workspace_id')
            if workspace_id:
                return workspace_id
        
        # Try to get from query parameters
        workspace_id = request.query_params.get('workspace_id')
        if workspace_id:
            return workspace_id
        
        # Try to get from body (for POST/PUT requests)
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                body = request.json()
                if body and 'workspace_id' in body:
                    return body['workspace_id']
            except:
                pass
        
        return None

# Dependency for getting current user with RBAC
async def get_current_user_with_rbac(
    request: Request,
    required_roles: list = None,
    db: Session = Depends(get_db)
) -> User:
    """Get current user with RBAC validation"""
    
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check specific role requirements if provided
    if required_roles:
        if not _check_user_roles(user, required_roles, request, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    return user

def _check_user_roles(user: User, required_roles: list, request: Request, db: Session) -> bool:
    """Check if user has required roles in the current workspace"""
    
    # Global admin has all permissions
    if user.is_admin_global:
        return True
    
    # Extract workspace ID
    workspace_id = _extract_workspace_id_from_request(request)
    if not workspace_id:
        return False
    
    # Check workspace membership and role
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id
    ).first()
    
    if not membership:
        return False
    
    return membership.role in required_roles

def _extract_workspace_id_from_request(request: Request) -> Optional[str]:
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
    
    # Body parameters
    if request.method in ['POST', 'PUT', 'PATCH']:
        try:
            body = request.json()
            if body and 'workspace_id' in body:
                return body['workspace_id']
        except:
            pass
    
    return None

# Convenience functions for common permission checks
def require_admin():
    """Require admin role"""
    return lambda user: get_current_user_with_rbac(required_roles=['admin'])

def require_editor():
    """Require editor or admin role"""
    return lambda user: get_current_user_with_rbac(required_roles=['admin', 'editor'])

def require_viewer():
    """Require any authenticated user"""
    return lambda user: get_current_user_with_rbac()
