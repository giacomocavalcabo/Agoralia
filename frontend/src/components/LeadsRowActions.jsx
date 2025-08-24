import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function LeadsRowActions({ row, onView, onAssign, onDelete }) {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center gap-2">
      <button 
        className="rounded border px-2 py-1 text-xs" 
        onClick={() => navigate(`/leads/${row.id}`)}
      >
        {t('leads.row_actions.view')}
      </button>
      <button className="rounded border px-2 py-1 text-xs" onClick={() => onAssign?.(row)}>{t('leads.row_actions.assign')}</button>
      <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={() => onDelete?.(row)}>{t('leads.row_actions.delete')}</button>
    </div>
  );
}
