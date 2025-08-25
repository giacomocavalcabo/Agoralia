import { api } from './api';

export async function runPreflight({ iso, contact_class, known_contact, local_dt, wants_recording }) {
  try {
    const res = await api.post('/compliance/preflight', {
      iso, contact_class, known_contact, local_dt, wants_recording
    });
    return res.data; // { decision: 'allow'|'delay'|'block', reasons:[], next_window_at }
  } catch {
    return { decision: 'allow', reasons: [] }; // fail-open (evita blocchi falsi)
  }
}
