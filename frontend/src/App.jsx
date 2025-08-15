import './App.css'

function App() {
  async function pingBackend() {
    try {
      const res = await fetch('http://127.0.0.1:8000/health')
      const data = await res.json()
      alert(`Backend: ${data.status}`)
    } catch (e) {
      alert('Backend non raggiungibile')
    }
  }

  return (
    <div>
      <h1>ColdAI — Frontend</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <a href="/">Dashboard</a>
        <a href="/contatti">Contacts</a>
        <a href="/analisi">Analytics</a>
        <a href="/impostazioni">Settings</a>
      </nav>
      <p>Local environment ready. Click to ping the backend.</p>
      <button onClick={pingBackend}>Ping backend</button>
      <div style={{ marginTop: 24 }}>
        <h2>Create call (Retell)</h2>
        <form onSubmit={async (e) => {
          e.preventDefault()
          const form = e.target
          const to = form.to.value
          const from = form.from.value
          const res = await fetch('http://127.0.0.1:8000/calls/retell/outbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, from_number: from })
          })
          const data = await res.json()
          alert(res.ok ? `Call created: ${JSON.stringify(data)}` : `Error: ${data.detail || res.status}`)
        }}>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input name="to" placeholder="Destination E.164 (e.g. +39...)" required />
            <input name="from" placeholder="Caller ID E.164 (optional)" />
            <button type="submit">Call</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
