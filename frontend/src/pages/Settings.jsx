import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import { useToast } from '../components/ToastProvider.jsx'

export default function Settings(){
  const { t } = useI18n()
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [invite, setInvite] = useState({ email:'', role:'viewer' })
  const { toast } = useToast()
  useEffect(()=>{ (async()=>{ try{ const m = await apiFetch('/workspaces/members'); setMembers(m.items||[]) } catch{} })() }, [])
  useEffect(()=>{ (async()=>{ try{ const a = await apiFetch('/workspaces/activity'); setActivity(a.items||[]) } catch{} })() }, [])
  return (
    <div style={{ display:'grid', gap:12 }}>
      <div className="panel">
        <div className="kpi-title" style={{ marginBottom:8 }}>{t('settings.workspace.members')||'Members'}</div>
        <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
          <thead><tr><th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('settings.workspace.email')||'Email'}</th><th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('settings.workspace.role')||'Role'}</th><th style={{ width:1 }}></th></tr></thead>
          <tbody>
            {members.map(m=> (
              <tr key={m.user_id || m.email}>
                <td style={{ padding:10 }}>{m.email}</td>
                <td style={{ padding:10 }}>
                  <select value={m.role} onChange={async (e)=>{
                    try{ await apiFetch(`/workspaces/members/${m.user_id}`, { method:'PATCH', body:{ role: e.target.value } }); setMembers(ms=> ms.map(x=> x.user_id===m.user_id? { ...x, role:e.target.value }: x)); toast(t('toasts.updated')||'Updated') } catch(err){ toast(String(err?.message||err)) }
                  }} style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td style={{ padding:10, textAlign:'right' }}>
                  <button onClick={async ()=>{ try{ await apiFetch(`/workspaces/members/${m.user_id}`, { method:'DELETE' }); setMembers(ms=> ms.filter(x=> x.user_id!==m.user_id)); toast(t('toasts.removed')||'Removed') } catch(err){ toast(String(err?.message||err)) } }} className="kpi-title" style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('settings.workspace.remove')||'Remove'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ display:'flex', gap:8, alignItems:'end' }}>
        <div>
          <div className="kpi-title">{t('settings.workspace.invite')||'Invite'}</div>
          <input placeholder="email" value={invite.email} onChange={e=> setInvite({ ...invite, email:e.target.value })} style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
          <select value={invite.role} onChange={e=> setInvite({ ...invite, role:e.target.value })} style={{ marginLeft:8, padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button onClick={async ()=>{ try{ await apiFetch('/workspaces/members/invite', { method:'POST', body: invite }); const a = await apiFetch('/workspaces/activity'); setActivity(a.items||[]) } catch{} }} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('settings.workspace.send_invite')||'Send invite'}</button>
      </div>
      <div className="panel">
        <div className="kpi-title" style={{ marginBottom:8 }}>{t('settings.workspace.audit')||'Audit'}</div>
        <ul style={{ margin:0, paddingLeft:16 }}>
          {activity.map((e,i)=> (<li key={i} className="kpi-title">{e.created_at} — {e.kind} {e.entity}</li>))}
        </ul>
      </div>
    </div>
  )
}


