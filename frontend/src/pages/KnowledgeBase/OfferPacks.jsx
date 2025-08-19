import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';

export default function OfferPacks() {
  const navigate = useNavigate();
  const canEdit = useCanEdit();

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Offer Packs</h1>
          <Button onClick={() => navigate('/knowledge/offers?new=true')}>
            Nuovo Offer Pack
          </Button>
        </div>
        
        <Card title="Lista Offer Pack">
          <div className="text-center py-12">
            <p className="text-gray-500">Gestione offer pack in fase di sviluppo</p>
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}
