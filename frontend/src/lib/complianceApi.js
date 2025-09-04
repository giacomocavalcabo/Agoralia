import { apiFetch } from './api.js';

export async function getRequirements({ provider, country, numberType, entity }) {
  const q = new URLSearchParams({ provider, country, type: numberType, entity });
  try {
    return await apiFetch(`/compliance/requirements?${q}`);
  } catch (error) {
    throw new Error('requirements_failed');
  }
}

export async function listSubmissions() {
  try {
    return await apiFetch(`/compliance/submissions`);
  } catch (error) {
    throw new Error('submissions_failed');
  }
}

export async function createSubmission(payload) {
  try {
    return await apiFetch(`/compliance/submissions`, {
      method: 'POST', 
      body: payload
    });
  } catch (error) {
    throw new Error('create_submission_failed');
  }
}

export async function uploadComplianceFile({ submissionId, file, kind }) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', kind);
  try {
    return await apiFetch(`/compliance/submissions/${submissionId}/files`, { 
      method: 'POST', 
      body: fd 
    });
  } catch (error) {
    throw new Error('upload_failed');
  }
}
