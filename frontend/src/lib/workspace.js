import { createContext, useContext } from 'react';

export const WorkspaceCtx = createContext({ 
  id: null, 
  role: 'viewer', 
  locale: 'it-IT' 
});

export const useWorkspace = () => useContext(WorkspaceCtx);

export function RequireRole({ role, children, fallback = null }) {
  const { role: userRole } = useWorkspace();
  const order = ['viewer', 'editor', 'admin'];
  const hasAccess = order.indexOf(userRole) >= order.indexOf(role);
  
  if (!hasAccess) {
    return fallback || null; // Fallback semplice senza JSX
  }
  
  return children;
}

export function useCanEdit() {
  const { role } = useWorkspace();
  return ['editor', 'admin'].includes(role);
}

export function useCanAdmin() {
  const { role } = useWorkspace();
  return role === 'admin';
}

export function useWorkspaceId() {
  const { id } = useWorkspace();
  return id;
}
