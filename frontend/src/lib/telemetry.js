// Simple telemetry system for tracking key user actions
// No PII is collected, only action types and metadata

const TELEMETRY_ENABLED = process.env.NODE_ENV === 'production';

// KB Events constants for backward compatibility
export const KB_EVENTS = {
  VIEW: 'kb_view',
  EDIT_SAVE: 'kb_edit_save',
  IMPORT_START: 'kb_import_start',
  IMPORT_COMMIT: 'kb_import_commit',
  IMPORT_CANCEL: 'kb_import_cancel',
  ASSIGN_SET: 'kb_assign_set',
  PUBLISH: 'kb_publish',
  CREATE: 'kb_create',
  SECTION_UPDATE: 'kb_section_update',
  SECTION_DELETE: 'kb_section_delete'
};

// KB tracking functions for backward compatibility
export function trackKbEvent(event, data = {}) {
  telemetry.track(event, data);
}

export function trackKbView(kbId, kind, viewType = 'overview') {
  telemetry.track('kb_view', {
    kb_id: kbId,
    kind,
    view_type: viewType
  });
}

export function trackKbEditSave(kbId, fieldKey, value, success = true) {
  telemetry.track('kb_edit_save', {
    kb_id: kbId,
    field_key: fieldKey,
    value_length: value?.length || 0,
    success
  });
}

export function trackKbImportStart(kind, sourceType, targetKbId = null) {
  telemetry.track('kb_import_start', {
    import_kind: kind,
    source_type: sourceType,
    target_kb_id: targetKbId
  });
}

export function trackKbImportCommit(jobId, success = true, error = null) {
  telemetry.track('kb_import_commit', {
    job_id: jobId,
    success,
    error: error?.message || null
  });
}

export function trackKbImportCancel(jobId, reason = 'user_request') {
  telemetry.track('kb_import_cancel', {
    job_id: jobId,
    reason
  });
}

export function trackKbAssignSet(scope, scopeId, kbId, previousKbId = null) {
  telemetry.track('kb_assign_set', {
    scope,
    scope_id: scopeId,
    kb_id: kbId,
    previous_kb_id: previousKbId
  });
}

export function trackKbPublish(kbId, success = true) {
  telemetry.track('kb_publish', {
    kb_id: kbId,
    success
  });
}

export function trackKbCreate(kind, type, success = true) {
  telemetry.track('kb_create', {
    kind,
    type,
    success
  });
}

class Telemetry {
  constructor() {
    this.events = [];
    this.maxEvents = 100; // Keep only last 100 events
  }

  track(event, metadata = {}) {
    if (!TELEMETRY_ENABLED) return;

    const eventData = {
      event,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        // Remove any potential PII
        user_id: undefined,
        lead_id: undefined,
        phone: undefined,
        email: undefined,
        name: undefined
      }
    };

    this.events.push(eventData);

    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Telemetry:', eventData);
    }

    // In production, you could send to analytics service
    // this.sendToAnalytics(eventData);
  }

  // Campaign events
  trackCampaignCreate(metadata = {}) {
    this.track('campaign.create', metadata);
  }

  trackCampaignStatusChange(metadata = {}) {
    this.track('campaign.status_change', metadata);
  }

  // Lead events
  trackLeadDelete(metadata = {}) {
    this.track('lead.delete', metadata);
  }

  trackLeadBulkAction(metadata = {}) {
    this.track('lead.bulk_action', metadata);
  }

  trackLeadFilter(metadata = {}) {
    this.track('lead.filter', metadata);
  }

  // Calendar events
  trackCalendarEventCreate(metadata = {}) {
    this.track('calendar.event_create', metadata);
  }

  trackCalendarEventView(metadata = {}) {
    this.track('calendar.event_view', metadata);
  }

  // Filter events
  trackFilterSave(metadata = {}) {
    this.track('filter.save', metadata);
  }

  trackFilterLoad(metadata = {}) {
    this.track('filter.load', metadata);
  }

  // Get events for debugging/analytics
  getEvents() {
    return [...this.events];
  }

  // Clear events
  clear() {
    this.events = [];
  }
}

export const telemetry = new Telemetry();
export default telemetry;
