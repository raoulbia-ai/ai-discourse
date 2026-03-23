'use strict';

const crypto = require('crypto');

/**
 * Stewardship Actions — time-bounded governance interventions (elevate, cool, preserve_dissent, request_review).
 */

const VALID_ACTIONS = ['elevate', 'cool', 'preserve_dissent', 'request_review'];
const DEFAULT_DURATIONS = {
  elevate: 12,
  cool: 6,
  preserve_dissent: 24,
  request_review: 12,
};

class StewardshipActions {
  constructor(store) {
    this.store = store;
  }

  postAction(data) {
    if (!data.agent_id) throw new Error('Missing required field: agent_id');
    if (!data.action) throw new Error('Missing required field: action');
    if (!data.proceeding_id) throw new Error('Missing required field: proceeding_id');
    if (!data.reason) throw new Error('Missing required field: reason');

    if (!VALID_ACTIONS.includes(data.action)) {
      throw new Error(`Invalid action: "${data.action}". Valid: ${VALID_ACTIONS.join(', ')}`);
    }

    const durationHours = data.duration_hours || DEFAULT_DURATIONS[data.action] || 12;
    const now = new Date();

    const record = {
      id: 'gov_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      agent_id: data.agent_id,
      action: data.action,
      proceeding_id: data.proceeding_id,
      reason: data.reason,
      duration_hours: durationHours,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + durationHours * 3600000).toISOString(),
      expired: false,
    };

    this.store.appendGovernanceAction(record);
    return record;
  }

  getActiveActions() {
    const actions = this.store.readGovernanceActions();
    const now = new Date();
    return actions.filter(a => !a.expired && new Date(a.expires_at) > now);
  }

  expireActions() {
    const actions = this.store.readGovernanceActions();
    const now = new Date();
    let count = 0;

    const updated = actions.map(a => {
      if (!a.expired && new Date(a.expires_at) < now) {
        count++;
        return { ...a, expired: true };
      }
      return a;
    });

    if (count > 0) {
      this.store.writeGovernanceActions(updated);
    }
    return count;
  }
}

module.exports = { StewardshipActions, VALID_ACTIONS, DEFAULT_DURATIONS };
