import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/Card';
import RichTextEditor from './RichTextEditor';
import { useAutosave } from '../../lib/useAutosave';
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry';
import ConfirmDialog from '../ConfirmDialog';
import { 
  DocumentTextIcon, EyeIcon, EyeSlashIcon, 
  CheckIcon, ClockIcon, ArchiveBoxIcon 
} from '@heroicons/react/24/outline';

export default function SectionEditor({ 
  section, 
  onSave, 
  onDelete, 
  onStatusChange,
  disabled = false 
}) {
  const [title, setTitle] = useState(section?.title || '');
  const [content, setContent] = useState(section?.content || '');
  const [isEditing, setIsEditing] = useState(!section?.id);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Autosave per titolo e contenuto
  const titleAutosave = useAutosave(section?.id, 'title', title);
  const contentAutosave = useAutosave(section?.id, 'content', content);

  useEffect(() => {
    if (section) {
      setTitle(section.title || '');
      setContent(section.content || '');
    }
  }, [section]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Il titolo è obbligatorio');
      return;
    }

    try {
      const updatedSection = {
        ...section,
        title: title.trim(),
        content: content.trim(),
        last_updated: new Date().toISOString()
      };

      await onSave(updatedSection);
      setIsEditing(false);
      
      trackKbEvent(KB_EVENTS.SECTION_UPDATE, {
        section_id: section?.id,
        success: true
      });
    } catch (error) {
      console.error('Error saving section:', error);
      trackKbEvent(KB_EVENTS.SECTION_UPDATE, {
        section_id: section?.id,
        success: false,
        error: error.message
      });
    }
  };

  const handleDelete = async () => {
    if (!section?.id) return;
    
    try {
      await onDelete(section.id);
      trackKbEvent(KB_EVENTS.SECTION_DELETE, {
        section_id: section.id,
        success: true
      });
    } catch (error) {
      console.error('Error deleting section:', error);
      trackKbEvent(KB_EVENTS.SECTION_DELETE, {
        section_id: section.id,
        success: false,
        error: error.message
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published': return <CheckIcon className="h-4 w-4 text-green-600" />;
      case 'draft': return <ClockIcon className="h-4 w-4 text-yellow-600" />;
      case 'archived': return <ArchiveBoxIcon className="h-4 w-4 text-gray-600" />;
      default: return <ClockIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded ? (
                <EyeIcon className="h-4 w-4 text-gray-600" />
              ) : (
                <EyeSlashIcon className="h-4 w-4 text-gray-600" />
              )}
            </button>
            
            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
            
            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titolo sezione"
                className="text-lg font-medium border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                disabled={disabled}
              />
            ) : (
              <h3 className="text-lg font-medium">{title}</h3>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(section?.status || 'draft')}`}>
              {getStatusIcon(section?.status || 'draft')}
              <span className="ml-1">{section?.status || 'draft'}</span>
            </span>

            {/* Actions */}
            {!disabled && (
              <div className="flex gap-1">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={handleSave}>
                      Salva
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                    >
                      Annulla
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setIsEditing(true)}
                    >
                      Modifica
                    </Button>
                    {section?.id && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="space-y-3">
            {isEditing ? (
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Inizia a scrivere il contenuto della sezione..."
                disabled={disabled}
              />
            ) : (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}

            {/* Autosave indicators */}
            {(titleAutosave.isSaving || contentAutosave.isSaving) && (
              <div className="text-xs text-blue-600 flex items-center gap-2">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
                Salvando...
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
              <div>
                {section?.last_updated && (
                  <span>
                    Aggiornato: {new Date(section.last_updated).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div>
                {section?.completeness && (
                  <span>
                    Completeness: {section.completeness}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Elimina sezione"
        body="Sei sicuro di voler eliminare questa sezione? Questa azione non può essere annullata."
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDelete();
        }}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </Card>
  );
}
