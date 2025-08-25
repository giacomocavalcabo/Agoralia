import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from './ConfirmDialog';

export default function LeadsRowActions({ row, onView, onAssign, onDelete }) {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };
  
  return (
    <div className="flex items-center gap-2">
      <button 
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50" 
        onClick={() => navigate(`/leads/${row.original?.id}`)}
      >
        {t('leads.actions.view')}
      </button>
      <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => navigate(`/leads/${row.original?.id}/edit`)}>
        {t('leads.actions.edit')}
      </button>
      <button 
        className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100" 
        onClick={handleDelete}
      >
        {t('leads.actions.delete')}
      </button>
      
      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('leads.delete.title')}
        message={t('leads.delete.message')}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await onDelete?.(row.original);
        }}
      />
    </div>
  );
}
