import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';
import { PrecedenceBanner } from '../../components/kb/PrecedenceBanner';

export default function Assignments() {
  const canEdit = useCanEdit();

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Assignments</h1>
        </div>
        
        <PrecedenceBanner />
        
        <Card title="Assegnazioni KB">
          <div className="text-center py-12">
            <p className="text-gray-500">Gestione assegnazioni in fase di sviluppo</p>
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}
