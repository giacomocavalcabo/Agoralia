import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function LeadsRowActions({ row, onView, onAssign, onDelete }) {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const handleDelete = () => {
    // TODO: Implementare ConfirmDialog per delete
    onDelete?.(row);
  };
  
  return (
    <div className="flex items-center gap-2">
      <button 
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50" 
        onClick={() => navigate(`/leads/${row.id}`)}
      >
        {t('leads.actions.view')}
      </button>
      <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => onAssign?.(row)}>
        {t('leads.actions.edit')}
      </button>
      <button 
        className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100" 
        onClick={handleDelete}
      >
        {t('leads.actions.delete')}
      </button>
    </div>
  );
}
