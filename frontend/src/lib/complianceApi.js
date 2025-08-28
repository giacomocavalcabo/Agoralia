// minimal, senza fetch wrapper se già ne hai uno: adatta a apiFetch se serve
export async function getRequirements({ provider, country, numberType, entity }) {
  const q = new URLSearchParams({ provider, country, type: numberType, entity });
  const r = await fetch(`/api/compliance/requirements?${q}`);
  if (!r.ok) throw new Error('requirements_failed');
  return r.json();
}

export async function listSubmissions() {
  const r = await fetch(`/api/compliance/submissions`);
  if (!r.ok) throw new Error('submissions_failed');
  return r.json();
}

export async function createSubmission(payload) {
  const r = await fetch(`/api/compliance/submissions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('create_submission_failed');
  return r.json();
}

export async function uploadComplianceFile({ submissionId, file, kind }) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', kind);
  const r = await fetch(`/api/compliance/submissions/${submissionId}/files`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error('upload_failed');
  return r.json();
}
