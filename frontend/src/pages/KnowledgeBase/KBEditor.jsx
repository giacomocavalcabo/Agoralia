import { useParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useKbDetail, useUpdateKb } from '../../lib/kbApi';
import { CompletenessMeter } from '../../components/kb/CompletenessMeter';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';

export default function KBEditor({ kind = 'company' }) {
  const { kbId } = useParams();
  const canEdit = useCanEdit();

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">KB Editor - {kind}</h1>
        </div>
        
        <Card title="Editor in Sviluppo">
          <div className="text-center py-12">
            <p className="text-gray-500">Editor KB in fase di sviluppo</p>
            <p className="text-sm text-gray-400 mt-2">ID: {kbId}</p>
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}
