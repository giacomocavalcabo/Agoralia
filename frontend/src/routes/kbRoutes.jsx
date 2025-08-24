import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

// Lazy imports
const KnowledgeBase = lazy(() => import('../pages/KnowledgeBase'));
const KBEditor = lazy(() => import('../pages/KnowledgeBase/KBEditor'));
const OfferPacks = lazy(() => import('../pages/KnowledgeBase/OfferPacks'));
const OfferPackDetail = lazy(() => import('../pages/KnowledgeBase/OfferPackDetail'));
const Imports = lazy(() => import('../pages/KnowledgeBase/Imports'));
const Assignments = lazy(() => import('../pages/KnowledgeBase/Assignments'));

// Skeleton component
function KBSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded"></div>
        ))}
      </div>
    </div>
  );
}

export const kbRoutes = [
  { 
    path: '/knowledge', 
    element: (
      <Suspense fallback={<KBSkeleton />}>
        <KnowledgeBase />
      </Suspense>
    ) 
  },
  { 
    path: '/knowledge/company/:kbId', 
    element: (
      <Suspense fallback={<KBSkeleton />}>
        <KBEditor kind="company" />
      </Suspense>
    ) 
  },
  { 
    path: '/knowledge/offers', 
    element: (
      <Suspense fallback={<KBSkeleton />}>
        <OfferPacks />
      </Suspense>
    ) 
  },
  { 
    path: '/knowledge/offers/:kbId', 
    element: (
      <Suspense fallback={<KBSkeleton />}>
        <OfferPackDetail />
      </Suspense>
    ) 
  },
  { 
    path: '/knowledge/imports', 
    element: (
      <Suspense fallback={<KBSkeleton />}>
        <Imports />
      </Suspense>
    ) 
  },
  { 
    path: '/knowledge/assignments', 
    element: (
      <Suspense fallback={<KBSkeleton />}>
        <Assignments />
      </Suspense>
    ) 
  },
  { 
    path: '/knowledge/*', 
    element: <Navigate to="/knowledge" replace /> 
  }
];
