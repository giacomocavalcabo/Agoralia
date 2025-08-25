import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import ConfirmDialog from './ConfirmDialog';

export default function LeadsRowActions({ row, onView, onAssign, onDelete }) {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  
  const del = useMutation({
    mutationFn: () => api.delete(`/leads/${row.original.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      // TODO: Add toast when toast system is available
    }
  });
  
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
        onClick={() => setOpen(true)}
      >
        {t('leads.actions.delete')}
      </button>
      
      <ConfirmDialog
        open={open}
        title={t('leads.dialogs.delete.title')}
        body={t('leads.dialogs.delete.body')}
        confirmLabel={t('leads.dialogs.delete.confirm')}
        cancelLabel={t('leads.dialogs.delete.cancel')}
        onConfirm={() => del.mutate()}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
