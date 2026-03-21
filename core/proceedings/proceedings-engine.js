'use strict';

const crypto = require('crypto');
const { assertValid } = require('../validate');

/**
 * Proceeding Engine — manages the lifecycle of proceedings.
 *
 * Proceedings are the central unit of institutional inquiry.
 * They move through a state machine and anchor all other records.
 */

const VALID_STATES = [
  'noticed', 'opened', 'framed', 'under_examination', 'contested',
  'awaiting_evidence', 'provisionally_synthesized', 'stable',
  'dormant', 'settled', 'archived', 'reopened', 'retired',
];

// Valid state transitions
const TRANSITIONS = {
  noticed:                    ['opened', 'retired'],
  opened:                     ['framed', 'under_examination', 'retired'],
  framed:                     ['under_examination', 'retired'],
  under_examination:          ['contested', 'awaiting_evidence', 'provisionally_synthesized', 'dormant'],
  contested:                  ['under_examination', 'awaiting_evidence', 'provisionally_synthesized'],
  awaiting_evidence:          ['under_examination', 'contested', 'provisionally_synthesized', 'dormant'],
  provisionally_synthesized:  ['stable', 'contested', 'under_examination'],
  stable:                     ['settled', 'dormant', 'contested', 'reopened'],
  dormant:                    ['reopened', 'archived', 'retired'],
  settled:                    ['archived', 'reopened'],
  archived:                   ['reopened'],
  reopened:                   ['under_examination', 'framed'],
  retired:                    [],
};

function similarity(a, b) {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la.includes(lb) || lb.includes(la)) return 1.0;
  const shorter = la.length <= lb.length ? la : lb;
  const longer = la.length > lb.length ? la : lb;
  let matches = 0;
  const used = new Array(longer.length).fill(false);
  for (const ch of shorter) {
    const idx = longer.split('').findIndex((c, i) => c === ch && !used[i]);
    if (idx !== -1) { matches++; used[idx] = true; }
  }
  return matches / longer.length;
}

class ProceedingEngine {
  /**
   * @param {import('../../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  list(filters = {}) {
    let proceedings = this.store.getProceedings();
    if (filters.status) {
      proceedings = proceedings.filter(p => p.status === filters.status);
    }
    if (filters.exclude_status) {
      const exclude = Array.isArray(filters.exclude_status) ? filters.exclude_status : [filters.exclude_status];
      proceedings = proceedings.filter(p => !exclude.includes(p.status));
    }
    return proceedings;
  }

  get(id) {
    return this.store.getProceeding(id);
  }

  /**
   * Open a new proceeding.
   * @param {{ title: string, opened_by: string, framing?: object, signal_ids?: string[], force?: boolean }} data
   */
  open(data) {
    if (!data.title) throw new Error('Missing required field: title');
    if (!data.opened_by) throw new Error('Missing required field: opened_by');

    // Similarity check against active proceedings
    if (!data.force) {
      const active = this.list({ exclude_status: ['archived', 'retired'] });
      for (const existing of active) {
        if (similarity(data.title, existing.title) > 0.8) {
          throw new Error(
            `Proceeding too similar to existing "${existing.title}" (${existing.id}). Pass force:true to override.`
          );
        }
      }
    }

    const now = new Date().toISOString();
    const proceeding = {
      id: 'proc_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      title: data.title,
      status: 'opened',
      created_at: now,
      updated_at: now,
      opened_by: data.opened_by,
      framing: data.framing || null,
      signal_ids: data.signal_ids || [],
      current_synthesis_id: null,
      active_obligation_ids: [],
      precedent_links: [],
      attention: null,
      dissent_status: 'none',
      closure_record_id: null,
      meta: { split_from: null, merged_from: [] },
    };

    assertValid('proceeding', proceeding);
    return this.store.saveProceeding(proceeding);
  }

  /**
   * Transition a proceeding to a new state.
   */
  transition(id, newStatus) {
    if (!VALID_STATES.includes(newStatus)) {
      throw new Error(`Invalid status: "${newStatus}". Valid: ${VALID_STATES.join(', ')}`);
    }

    const proc = this.store.getProceeding(id);
    const allowed = TRANSITIONS[proc.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Cannot transition from "${proc.status}" to "${newStatus}". Allowed: ${(allowed || []).join(', ')}`
      );
    }

    proc.status = newStatus;
    proc.updated_at = new Date().toISOString();
    return this.store.saveProceeding(proc);
  }

  /**
   * Update a proceeding's framing.
   */
  updateFraming(id, framing) {
    const proc = this.store.getProceeding(id);
    proc.framing = { ...(proc.framing || {}), ...framing };
    proc.updated_at = new Date().toISOString();
    return this.store.saveProceeding(proc);
  }

  /**
   * Update a proceeding's attention scores.
   */
  updateAttention(id, attention) {
    const proc = this.store.getProceeding(id);
    proc.attention = { ...(proc.attention || {}), ...attention };
    proc.updated_at = new Date().toISOString();
    return this.store.saveProceeding(proc);
  }

  /**
   * Link a signal to a proceeding.
   */
  addSignal(id, signalId) {
    const proc = this.store.getProceeding(id);
    if (!proc.signal_ids.includes(signalId)) {
      proc.signal_ids.push(signalId);
      proc.updated_at = new Date().toISOString();
      this.store.saveProceeding(proc);
    }
    return proc;
  }

  /**
   * Archive a proceeding.
   */
  archive(id) {
    return this.transition(id, 'archived');
  }
}

module.exports = { ProceedingEngine, VALID_STATES, TRANSITIONS };
