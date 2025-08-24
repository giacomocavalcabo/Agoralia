// Telemetria per la Knowledge Base
export const KB_EVENTS = {
  VIEW: 'kb_view',
  EDIT_SAVE: 'kb_edit_save',
  IMPORT_START: 'kb_import_start',
  IMPORT_COMMIT: 'kb_import_commit',
  IMPORT_CANCEL: 'kb_import_cancel',
  ASSIGN_SET: 'kb_assign_set',
  PUBLISH: 'kb_publish',
  CREATE: 'kb_create'
};

export function trackKbEvent(event, data = {}) {
  const eventData = {
    event,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...data
  };

  // Log locale per debugging
  if (import.meta.env.DEV) {
    console.log('KB Telemetry:', eventData);
  }

  // Invia a sistema di analytics se disponibile
  if (window.gtag) {
    window.gtag('event', event, {
      event_category: 'knowledge_base',
      event_label: data.kb_id || data.kind || 'unknown',
      ...data
    });
  }

  // Invia a sistema di logging se disponibile
  if (window.logEvent) {
    window.logEvent('kb_event', eventData);
  }
}

export function trackKbView(kbId, kind, viewType = 'overview') {
  trackKbEvent(KB_EVENTS.VIEW, {
    kb_id: kbId,
    kind,
    view_type: viewType
  });
}

export function trackKbEditSave(kbId, fieldKey, value, success = true) {
  trackKbEvent(KB_EVENTS.EDIT_SAVE, {
    kb_id: kbId,
    field_key: fieldKey,
    value_length: value?.length || 0,
    success
  });
}

export function trackKbImportStart(kind, sourceType, targetKbId = null) {
  trackKbEvent(KB_EVENTS.IMPORT_START, {
    import_kind: kind,
    source_type: sourceType,
    target_kb_id: targetKbId
  });
}

export function trackKbImportCommit(jobId, success = true, error = null) {
  trackKbEvent(KB_EVENTS.IMPORT_COMMIT, {
    job_id: jobId,
    success,
    error: error?.message || null
  });
}

export function trackKbImportCancel(jobId, reason = 'user_request') {
  trackKbEvent(KB_EVENTS.IMPORT_CANCEL, {
    job_id: jobId,
    reason
  });
}

export function trackKbAssignSet(scope, scopeId, kbId, previousKbId = null) {
  trackKbEvent(KB_EVENTS.ASSIGN_SET, {
    scope,
    scope_id: scopeId,
    kb_id: kbId,
    previous_kb_id: previousKbId
  });
}

export function trackKbPublish(kbId, success = true) {
  trackKbEvent(KB_EVENTS.PUBLISH, {
    kb_id: kbId,
    success
  });
}

export function trackKbCreate(kind, type, success = true) {
  trackKbEvent(KB_EVENTS.CREATE, {
    kind,
    type,
    success
  });
}
