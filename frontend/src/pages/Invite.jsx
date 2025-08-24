import { useEffect, useState } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api.js'
import { useToast } from '../components/ToastProvider.jsx'

export default function Invite(){
  const { t } = useTranslation('pages')
  const { toast } = useToast()
  const loc = useLocation()
  const [done, setDone] = useState(false)
  const token = new URLSearchParams(loc.search).get('token') || ''
  useEffect(()=>{ (async()=>{
    if (!token) return
    try{ await apiFetch('/workspaces/members/accept', { method:'POST', body:{ token } }); toast(t('common.toasts.invite_accepted')||'Invite accepted'); setDone(true) } catch(e){ toast(String(e?.message||e)) }
  })() }, [token])
  if (!token) return <div className="panel"><div className="kpi-title">{t('errors.missing_token')||'Missing token'}</div></div>
  if (done) return <Navigate to="/settings" replace />
  return (
    <div className="panel">
      <div className="kpi-title">{t('settings.workspace.invite')||'Invite'}</div>
      <div className="kpi-title">{t('settings.workspace.accepting')||'Accepting invite…'}</div>
    </div>
  )
}


