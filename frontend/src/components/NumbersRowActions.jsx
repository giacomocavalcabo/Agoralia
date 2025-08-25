import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './ToastProvider';

export default function NumbersRowActions({ row, onView, onAssign, onRelease }) {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  
  const releaseMutation = useMutation({
    mutationFn: () => api.delete(`/numbers/${row.original.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] });
      toast.success(t('numbers.dialogs.release.success'));
      setShowReleaseConfirm(false);
    },
    onError: () => {
      toast.error(t('numbers.dialogs.release.error'));
    }
  });
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(row.original.e164);
      toast.success(t('numbers.toast.copied'));
    } catch (err) {
      toast.error('Failed to copy');
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <button 
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1" 
        onClick={() => navigate(`/numbers/${row.original?.id}`)}
        aria-label={t('numbers.actions.view')}
      >
        {t('numbers.actions.view')}
      </button>
      
      <button 
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1" 
        onClick={() => navigate(`/numbers/${row.original?.id}/configure`)}
        aria-label={t('numbers.actions.configure')}
      >
        {t('numbers.actions.configure')}
      </button>
      
      <button 
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1" 
        onClick={copyToClipboard}
        aria-label="Copy number"
      >
        📋
      </button>
      
      <button 
        className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 focus:ring-2 focus:ring-red-500 focus:ring-offset-1" 
        onClick={() => setShowReleaseConfirm(true)}
        aria-label={t('numbers.actions.release')}
      >
        {t('numbers.actions.release')}
      </button>
      
      {/* Release confirmation dialog */}
      <ConfirmDialog
        open={showReleaseConfirm}
        title={t('numbers.dialogs.release.title')}
        body={t('numbers.dialogs.release.body')}
        confirmLabel={t('numbers.dialogs.release.confirm')}
        cancelLabel={t('numbers.dialogs.release.cancel')}
        onConfirm={() => releaseMutation.mutate()}
        onClose={() => setShowReleaseConfirm(false)}
      />
    </div>
  );
}
