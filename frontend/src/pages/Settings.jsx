import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'
import { useToast } from '../components/ToastProvider.jsx'

export default function Settings(){
  const { t } = useI18n()
  const api = useMemo(()=> import.meta.env.VITE_API_BASE_URL, [])
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [invite, setInvite] = useState({ email:'', role:'viewer' })
  const [invites, setInvites] = useState([])
  const [email, setEmail] = useState('owner@example.com')
  const [password, setPassword] = useState('demo1234')
  const [me, setMe] = useState(null)
  const { toast } = useToast()
  useEffect(()=>{ (async()=>{ try{ const m = await apiFetch('/workspaces/members'); setMembers(m.items||[]) } catch{} })() }, [])
  useEffect(()=>{ (async()=>{ try{ const a = await apiFetch('/workspaces/activity'); setActivity(a.items||[]) } catch{} })() }, [])
  useEffect(()=>{ (async()=>{ try{ const i = await apiFetch('/workspaces/invites'); setInvites(i.items||[]) } catch{} })() }, [])
  async function login(){
    try{
      const r = await fetch(`${api}/auth/login`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify({ email, password }) })
      const csrf = r.headers.get('x-csrf-token')
      if (csrf) localStorage.setItem('csrf_token', csrf)
      await meFetch()
      toast('Logged in')
    }catch{ toast('Login failed') }
  }
  async function logout(){
    try{
      await fetch(`${api}/auth/logout`, { method:'POST', credentials:'include' })
      localStorage.removeItem('csrf_token')
      setMe(null)
    }catch{}
  }
  async function meFetch(){
    try{ const r = await fetch(`${api}/auth/me`, { credentials:'include' }); const j = await r.json(); setMe(j) }catch{}
  }
  return (
    <div className="grid gap-3">
      <div className="panel">
        <div className="kpi-title mb-2">{t('settings.auth.title')||'Authentication'}</div>
        <div className="flex items-end gap-2">
          <input className="input" placeholder="email" value={email} onChange={e=> setEmail(e.target.value)} />
          <input className="input" placeholder="password" type="password" value={password} onChange={e=> setPassword(e.target.value)} />
          <button className="btn" onClick={login}>Login</button>
          <button className="btn" onClick={logout}>Logout</button>
          <button className="btn" onClick={meFetch}>Me</button>
        </div>
        <div className="kpi-title mt-2">{me?.authenticated ? (`${me?.claims?.email} ${me?.claims?.is_admin_global ? '(admin)':''}`) : 'Not authenticated'}</div>
      </div>
      <div className="panel">
        <div className="kpi-title mb-2">{t('settings.workspace.members')||'Members'}</div>
        <table role="table" aria-label="Workspace members" className="w-full border-separate" style={{ borderSpacing:0 }}>
          <thead role="rowgroup"><tr role="row"><th role="columnheader" aria-sort="none" className="kpi-title text-left px-3 py-2">{t('settings.workspace.email')||'Email'}</th><th role="columnheader" className="kpi-title text-left px-3 py-2">{t('settings.workspace.role')||'Role'}</th><th role="columnheader" style={{ width:1 }}></th></tr></thead>
          <tbody>
            {invites.map(inv=> (
              <tr role="row" key={inv.id}>
                <td className="px-3 py-2">
                  {inv.email} <span className="kpi-title ml-1.5 rounded-full border border-line px-2 py-0.5">{t('settings.workspace.pending')||'Pending invites'}</span>
                </td>
                <td className="px-3 py-2">{inv.role}</td>
                <td className="px-3 py-2 text-right">
                  <a href={`/invite?token=${encodeURIComponent(inv.token||'')}`} className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5 no-underline">{t('settings.workspace.accept')||'Accept invite'}</a>
                  <button onClick={()=> navigator.clipboard?.writeText(inv.token)} className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5 ml-1.5">Copy token</button>
                </td>
              </tr>
            ))}
            {members.map(m=> (
              <tr role="row" key={m.user_id || m.email}>
                <td className="px-3 py-2">{m.email}</td>
                <td className="px-3 py-2">
                  <select value={m.role} onChange={async (e)=>{
                    const confirmed = window.confirm(t('settings.workspace.confirm_change_role')||'Change role?')
                    if (!confirmed) return
                    try{ await apiFetch(`/workspaces/members/${m.user_id}`, { method:'PATCH', body:{ role: e.target.value } }); setMembers(ms=> ms.map(x=> x.user_id===m.user_id? { ...x, role:e.target.value }: x)); toast(t('toasts.updated')||'Updated') } catch(err){ toast(String(err?.message||err)) }
                  }} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={async ()=>{ const ok = window.confirm(t('settings.workspace.confirm_remove')||'Remove member?'); if (!ok) return; try{ await apiFetch(`/workspaces/members/${m.user_id}`, { method:'DELETE' }); setMembers(ms=> ms.filter(x=> x.user_id!==m.user_id)); toast(t('toasts.removed')||'Removed') } catch(err){ toast(String(err?.message||err)) } }} className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('settings.workspace.remove')||'Remove'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel flex items-end gap-2">
        <div>
          <div className="kpi-title">{t('settings.workspace.invite')||'Invite'}</div>
          <input placeholder="email" value={invite.email} onChange={e=> setInvite({ ...invite, email:e.target.value })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5" />
          <select value={invite.role} onChange={e=> setInvite({ ...invite, role:e.target.value })} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5 ml-2">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button onClick={async ()=>{ try{ await apiFetch('/workspaces/members/invite', { method:'POST', body: invite }); const a = await apiFetch('/workspaces/activity'); setActivity(a.items||[]); const i = await apiFetch('/workspaces/invites'); setInvites(i.items||[]) } catch{} }} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('settings.workspace.send_invite')||'Send invite'}</button>
      </div>
      <div className="panel">
        <div className="kpi-title mb-2">{t('settings.workspace.pending')||'Pending invites'}</div>
        <ul className="m-0 pl-4 grid gap-1.5">
          {invites.map(inv=> (
            <li key={inv.id} className="kpi-title">
              {inv.email} • {inv.role}
              <button onClick={()=> navigator.clipboard?.writeText(inv.token)} className="ml-2 rounded-lg border border-line bg-bg-app px-2 py-1">Copy token</button>
              <button onClick={async ()=>{ try{ await apiFetch('/workspaces/members/accept', { method:'POST', body:{ token: inv.token } }); const m = await apiFetch('/workspaces/members'); setMembers(m.items||[]); const i = await apiFetch('/workspaces/invites'); setInvites(i.items||[]) } catch{} }} className="ml-1.5 rounded-lg border border-line bg-bg-app px-2 py-1">Accept (simulate)</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <div className="kpi-title mb-2">{t('settings.workspace.audit')||'Audit'}</div>
        <ul className="m-0 pl-4">
          {activity.map((e,i)=> (<li key={i} className="kpi-title">{e.created_at} — {e.kind} {e.entity}</li>))}
        </ul>
      </div>
    </div>
  )
}


