import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const CANONICAL_OBJECTS = ['company','contact','lead','deal','activity','owner']

export default function CrmMapping() {
  const [provider, setProvider] = useState('hubspot')
  const [providers, setProviders] = useState(['hubspot','zoho','pipedrive'])
  const [connections, setConnections] = useState([])
  const [enabled, setEnabled] = useState(true)
  const [objectType, setObjectType] = useState('company')
  const [fieldMap, setFieldMap] = useState('{}')
  const [suggested, setSuggested] = useState({})
  const [testResult, setTestResult] = useState(null)
  const [testSource, setTestSource] = useState('{"name":"ACME Spa","domain":"acme.it"}')
  const [testTransform, setTestTransform] = useState(null)
  const [canonicalKeys, setCanonicalKeys] = useState([])
  const [validation, setValidation] = useState(null)
  const [canonicalExample, setCanonicalExample] = useState('{}')
  const [presetApplied, setPresetApplied] = useState('')
  const [redirectUri, setRedirectUri] = useState(`${window.location.origin}/hubspot/callback`)
  const [entitlements, setEntitlements] = useState({ integrations: ['csv'] })

  async function loadConnections() {
    const res = await apiFetch('/crm/connections')
    setConnections(await res.json())
  }

  async function loadProviders() {
    const res = await apiFetch('/crm/providers')
    setProviders(await res.json())
  }

  async function saveConnection() {
    await apiFetch('/crm/connections', { method: 'POST', body: { provider, enabled, auth: {} } })
    await loadConnections()
    alert('Connection saved')
  }

  async function loadMapping() {
    const res = await apiFetch(`/crm/mappings?provider=${encodeURIComponent(provider)}&object_type=${encodeURIComponent(objectType)}`)
    const arr = await res.json()
    const fm = arr[0]?.field_map || {}
    setFieldMap(JSON.stringify(fm, null, 2))
  }

  async function loadSuggestions() {
    const res = await apiFetch(`/crm/suggest_mapping?provider=${encodeURIComponent(provider)}&object_type=${encodeURIComponent(objectType)}`)
    setSuggested(await res.json())
  }

  async function loadCanonical() {
    const res = await apiFetch(`/crm/canonical_schema?object_type=${encodeURIComponent(objectType)}`)
    const { keys } = await res.json()
    setCanonicalKeys(keys || [])
  }

  async function validateMapping() {
    let parsed = {}
    try { parsed = JSON.parse(fieldMap || '{}') } catch { parsed = {} }
    const res = await apiFetch('/crm/validate_mapping', { method: 'POST', body: { provider, object_type: objectType, field_map: parsed } })
    setValidation(await res.json())
  }

  async function applyPreset(objs) {
    await apiFetch('/crm/mappings/apply_preset', { method: 'POST', body: { provider, object_types: objs } })
    setPresetApplied(`Applied preset for ${provider}: ${objs && objs.length ? objs.join(', ') : 'all'}`)
    await loadMapping()
  }

  async function loadCanonicalExample() {
    const res = await apiFetch(`/crm/canonical_example?object_type=${encodeURIComponent(objectType)}`)
    const { example } = await res.json()
    setCanonicalExample(JSON.stringify(example || {}, null, 2))
  }

  async function saveMapping() {
    let parsed = {}
    try { parsed = JSON.parse(fieldMap || '{}') } catch { parsed = {} }
    await apiFetch('/crm/mappings', { method: 'PUT', body: { provider, object_type: objectType, field_map: parsed } })
    alert('Mapping salvato')
  }

  async function testPush() {
    const res = await apiFetch('/crm/test_push_activity', { method: 'POST', body: { provider, object_type: 'activity', use_last_call: true } })
    setTestResult(await res.json())
  }

  async function testGenericTransform() {
    let src = {}
    try { src = JSON.parse(testSource || '{}') } catch { src = {} }
    const res = await apiFetch('/crm/test_transform', { method: 'POST', body: { provider, object_type: objectType, source: src } })
    setTestTransform(await res.json())
  }

  useEffect(() => { loadConnections(); loadProviders() }, [])
  useEffect(() => { apiFetch('/billing/entitlements').then(r=>r.json()).then(setEntitlements).catch(()=>{}) }, [])
  useEffect(() => { loadMapping(); loadSuggestions(); loadCanonical(); loadCanonicalExample() }, [provider, objectType])

  return (
    <div>
      <h3>CRM Mapping {(!entitlements.integrations || entitlements.integrations.length<=1) && <span className="badge" style={{ marginLeft:8, background:'#fff7ed' }}>Free: CSV only</span>}</h3>
      <div className="panel" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 12, alignItems: 'center' }}>
          <label>Provider</label>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {providers.map(p => (
              <option key={p} value={p} disabled={!entitlements.integrations?.includes(p) && p!=='csv'}>{p}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable
            </label>
            <button className="btn" onClick={saveConnection}>Save connection</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'start' }}>
          <label>Object</label>
          <select className="input" value={objectType} onChange={(e) => setObjectType(e.target.value)}>
            {CANONICAL_OBJECTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
          <label>Field map (JSON)</label>
          <textarea className="input" rows={12} value={fieldMap} onChange={(e) => setFieldMap(e.target.value)} placeholder='{"company_id":"id","name":"name"}' />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={saveMapping}>Save mapping</button>
          <button className="btn" onClick={loadMapping}>Reload</button>
          <button className="btn" onClick={() => setFieldMap(JSON.stringify(suggested, null, 2))}>Auto-fill</button>
          <button className="btn" onClick={validateMapping}>Validate</button>
          <button className="btn" onClick={testPush}>Test push Activity</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => applyPreset(null)}>Apply preset (all)</button>
          {CANONICAL_OBJECTS.map(o => (
            <button key={o} className="btn" onClick={() => applyPreset([o])}>{`Apply ${o}`}</button>
          ))}
          {presetApplied && <span className="badge">{presetApplied}</span>}
        </div>

        <div className="kpi-card" style={{ marginTop: 8 }}>
          <div className="kpi-title">Connections</div>
          <div className="kpi-value">{connections.length}</div>
        </div>
        <div className="panel" style={{ marginTop: 8 }}>
          <div className="kpi-title">Suggested mapping</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(suggested, null, 2)}</pre>
        </div>
        {provider === 'hubspot' && (
          <div className="panel" style={{ marginTop: 8 }}>
            <div className="kpi-title">Connect HubSpot</div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 140px', gap: 12, alignItems: 'center' }}>
              <label>Redirect URI</label>
              <input className="input" value={redirectUri} onChange={(e)=>setRedirectUri(e.target.value)} />
              <button className="btn" onClick={async ()=>{
                const res = await apiFetch('/crm/hubspot/auth/start', { method: 'POST', body: { redirect_uri: redirectUri } })
                const data = await res.json(); window.location.href = data.auth_url
              }}>Connect</button>
            </div>
          </div>
        )}
        <div className="panel" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <div className="kpi-title">Test upsert (Company/Contact/Deal)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
            <label>Source JSON</label>
            <textarea className="input" rows={6} value={testSource} onChange={(e) => setTestSource(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['company','contact','deal'].map(o => (
              <button key={o} className="btn" onClick={async () => {
                let src = {}; try { src = JSON.parse(testSource||'{}') } catch { src = {} }
                const res = await apiFetch('/crm/test_upsert', { method: 'POST', body: { provider, object_type: o, source: src } })
                setTestTransform(await res.json())
              }}>{`Upsert ${o}`}</button>
            ))}
          </div>
          {testTransform && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(testTransform, null, 2)}</pre>}
        </div>
        <div className="panel" style={{ marginTop: 8 }}>
          <div className="kpi-title">Canonical keys</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {canonicalKeys.map(k => <span key={k} className="badge">{k}</span>)}
          </div>
        </div>
        <div className="panel" style={{ marginTop: 8 }}>
          <div className="kpi-title">Canonical example</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{canonicalExample}</pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setTestSource(canonicalExample)}>Load into Test Source</button>
          </div>
        </div>
        {validation && (
          <div className="panel" style={{ marginTop: 8 }}>
            <div className="kpi-title">Validation</div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(validation, null, 2)}</pre>
          </div>
        )}
        {testResult && (
          <div className="panel" style={{ marginTop: 8 }}>
            <div className="kpi-title">Test result</div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
        <div className="panel" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <div className="kpi-title">Test transform (generic)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
            <label>Source JSON</label>
            <textarea className="input" rows={6} value={testSource} onChange={(e) => setTestSource(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={testGenericTransform}>Transform</button>
          </div>
          {testTransform && (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(testTransform, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  )
}


