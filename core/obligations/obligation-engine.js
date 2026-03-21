'use strict';

const crypto = require('crypto');
const { assertValid } = require('../validate');

/**
 * Obligation Engine — manages unresolved investigative work.
 *
 * Obligations turn discourse into forward motion.
 * They are created by interventions and resolved by further interventions.
 */

const VALID_STATUSES = ['open', 'answered', 'declined', 'deferred', 'expired'];
const VALID_RESOLUTIONS = ['answered', 'declined', 'deferred'];
const DEFAULT_TTL_HOURS = 4;

class ObligationEngine {
  /**
   * @param {import('../../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Create a new obligation.
   * @param {{ proceeding_id: string, assigned_agent_id: string, description: string, created_by_intervention_id?: string, priority?: number, ttl_hours?: number, due_cycle?: number }} data
   */
  create(data) {
    if (!data.proceeding_id) throw new Error('Missing required field: proceeding_id');
    if (!data.assigned_agent_id) throw new Error('Missing required field: assigned_agent_id');
    if (!data.description) throw new Error('Missing required field: description');

    const ttl = (typeof data.ttl_hours === 'number' && data.ttl_hours > 0) ? data.ttl_hours : DEFAULT_TTL_HOURS;
    const now = new Date();
    const due = new Date(now.getTime() + ttl * 60 * 60 * 1000);

    const obligation = {
      id: 'obl_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      proceeding_id: data.proceeding_id,
      created_by_intervention_id: data.created_by_intervention_id || null,
      assigned_agent_id: data.assigned_agent_id,
      status: 'open',
      priority: data.priority !== undefined ? data.priority : null,
      description: data.description,
      due_cycle: data.due_cycle || null,
      ttl_hours: ttl,
      created_at: now.toISOString(),
      due_at: due.toISOString(),
      resolved_at: null,
      resolution_intervention_id: null,
      resolution_type: null,
    };

    assertValid('obligation', obligation);
    return this.store.saveObligation(obligation);
  }

  /**
   * Resolve an open obligation.
   */
  resolve(id, resolutionType, resolutionInterventionId = null) {
    if (!VALID_RESOLUTIONS.includes(resolutionType)) {
      throw new Error(`Invalid resolution type: "${resolutionType}". Valid: ${VALID_RESOLUTIONS.join(', ')}`);
    }

    const obligations = this.store.getObligations();
    const obl = obligations.find(o => o.id === id);
    if (!obl) throw new Error(`Obligation not found: ${id}`);
    if (obl.status !== 'open') throw new Error(`Obligation ${id} is already ${obl.status}`);

    obl.status = resolutionType;
    obl.resolved_at = new Date().toISOString();
    obl.resolution_intervention_id = resolutionInterventionId;
    obl.resolution_type = resolutionType;

    return this.store.saveObligation(obl);
  }

  /**
   * Expire all open obligations past their due_at.
   */
  expireOverdue() {
    const obligations = this.store.getObligations();
    const now = new Date();
    let count = 0;

    for (const obl of obligations) {
      if (obl.status === 'open' && obl.due_at && new Date(obl.due_at) < now) {
        obl.status = 'expired';
        obl.resolution_type = 'expired';
        obl.resolved_at = now.toISOString();
        this.store.saveObligation(obl);
        count++;
      }
    }
    return count;
  }

  /**
   * Get open obligations for a specific agent.
   */
  forAgent(agentId) {
    return this.store.getObligations().filter(
      o => o.assigned_agent_id === agentId && o.status === 'open'
    );
  }

  /**
   * List obligations with filters.
   */
  list(filters = {}) {
    let obligations = this.store.getObligations();
    if (filters.status) obligations = obligations.filter(o => o.status === filters.status);
    if (filters.proceeding_id) obligations = obligations.filter(o => o.proceeding_id === filters.proceeding_id);
    if (filters.assigned_agent_id) obligations = obligations.filter(o => o.assigned_agent_id === filters.assigned_agent_id);
    return obligations;
  }

  /**
   * Get obligation stats by status.
   */
  stats() {
    const obligations = this.store.getObligations();
    const stats = { open: 0, answered: 0, declined: 0, deferred: 0, expired: 0 };
    for (const o of obligations) {
      if (stats[o.status] !== undefined) stats[o.status]++;
    }
    return stats;
  }
}

module.exports = { ObligationEngine, VALID_STATUSES, DEFAULT_TTL_HOURS };
