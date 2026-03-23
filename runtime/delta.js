'use strict';

const crypto = require('crypto');

/**
 * Delta Detection — determines whether an agent should act this cycle.
 *
 * Change detection via content hashing of signals, interventions,
 * proceedings, and obligations relevant to the agent.
 *
 * Accepts an InstitutionContext (preferred) or raw store (legacy).
 * Uses engine methods where available, falling back to _store for signals.
 */

class DeltaDetector {
  /**
   * @param {import('./institution-context').InstitutionContext|object} contextOrStore
   */
  constructor(contextOrStore) {
    // Accept context (has engines) or raw store (legacy)
    if (contextOrStore._store) {
      this.context = contextOrStore;
    } else {
      // Legacy: raw store passed directly
      this.context = { _store: contextOrStore };
    }
  }

  _hashRecords(records) {
    const hash = crypto.createHash('sha256');
    for (const r of records) {
      hash.update(JSON.stringify(r));
    }
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Check whether an agent has material changes since its last run.
   */
  check(agentId, lastRunState = {}) {
    const reasons = [];
    const ctx = this.context;

    // 1. Hash all current signals (no engine — use store)
    const signals = ctx._store.readSignals();
    const currentSignalHash = this._hashRecords(signals);
    if (currentSignalHash !== (lastRunState.snapshot_hash || 'empty')) {
      reasons.push('signals changed');
    }

    // 2. Check for new interventions since last offset (use engine if available)
    const allInterventions = ctx.interventions
      ? ctx.interventions.list()
      : ctx._store.readInterventions();
    const lastOffset = lastRunState.last_seen_comms_offset || 0;
    const newInterventions = allInterventions.slice(lastOffset);
    if (newInterventions.length > 0) {
      reasons.push(`${newInterventions.length} new intervention(s)`);
    }

    // 3. Check for mentions
    const mentions = newInterventions.filter(i =>
      i.agent_id !== agentId &&
      JSON.stringify(i).toUpperCase().includes(agentId.toUpperCase())
    );
    if (mentions.length > 0) {
      reasons.push(`${mentions.length} mention(s)`);
    }

    // 4. Check for open obligations (use engine if available)
    const openObligations = ctx.obligations
      ? ctx.obligations.forAgent(agentId)
      : ctx._store.getObligations().filter(o => o.assigned_agent_id === agentId && o.status === 'open');
    if (openObligations.length > 0) {
      reasons.push(`${openObligations.length} open obligation(s)`);
    }

    // 5. Check proceedings changes (use engine if available)
    const proceedings = ctx.proceedings
      ? ctx.proceedings.list()
      : ctx._store.getProceedings();
    const procHash = this._hashRecords(proceedings);
    if (procHash !== (lastRunState.proceedings_hash || 'empty')) {
      reasons.push('proceedings changed');
    }

    return {
      changed: reasons.length > 0,
      reason: reasons.length > 0 ? reasons.join('; ') : 'no change',
      snapshot_hash: currentSignalHash,
      comms_offset: allInterventions.length,
      proceedings_hash: procHash,
      mentions,
      open_obligations: openObligations,
    };
  }
}

module.exports = { DeltaDetector };
