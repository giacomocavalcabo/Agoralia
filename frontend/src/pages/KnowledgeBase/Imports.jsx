import { useState } from 'react';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';
import { ImportManager } from '../../components/kb/ImportManager';

export default function Imports() {
  const [showImportManager, setShowImportManager] = useState(false);
  const canEdit = useCanEdit();

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Imports</h1>
          <Button onClick={() => setShowImportManager(true)}>
            Nuovo Import
          </Button>
        </div>
        
        <Card title="Import Jobs">
          <div className="text-center py-12">
            <p className="text-gray-500">Gestione import in fase di sviluppo</p>
          </div>
        </Card>

        {showImportManager && (
          <ImportManager 
            isOpen={showImportManager}
            onClose={() => setShowImportManager(false)}
            onSuccess={(jobId) => {
              console.log('Import success:', jobId);
              setShowImportManager(false);
            }}
          />
        )}
      </div>
    </RequireRole>
  );
}
