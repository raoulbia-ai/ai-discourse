'use strict';

const crypto = require('crypto');

/**
 * Delta Detection — determines whether an agent should act this cycle.
 *
 * Change detection via content hashing of signals, interventions,
 * proceedings, and obligations relevant to the agent.
 */

class DeltaDetector {
  /**
   * @param {import('../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Hash a set of records for comparison.
   */
  _hashRecords(records) {
    const hash = crypto.createHash('sha256');
    for (const r of records) {
      hash.update(JSON.stringify(r));
    }
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Check whether an agent has material changes since its last run.
   *
   * @param {string} agentId
   * @param {object} lastRunState - The agent's state from last cycle
   *   { snapshot_hash, last_seen_comms_offset, last_run }
   * @returns {{ changed: boolean, reason: string, snapshot_hash: string, comms_offset: number, mentions: object[], open_obligations: object[] }}
   */
  check(agentId, lastRunState = {}) {
    const reasons = [];

    // 1. Hash all current signals
    const signals = this.store.readSignals();
    const currentSignalHash = this._hashRecords(signals);
    if (currentSignalHash !== (lastRunState.snapshot_hash || 'empty')) {
      reasons.push('signals changed');
    }

    // 2. Check for new interventions since last offset
    const allInterventions = this.store.readInterventions();
    const lastOffset = lastRunState.last_seen_comms_offset || 0;
    const newInterventions = allInterventions.slice(lastOffset);
    if (newInterventions.length > 0) {
      reasons.push(`${newInterventions.length} new intervention(s)`);
    }

    // 3. Check for mentions (interventions referencing this agent)
    const mentions = newInterventions.filter(i =>
      i.agent_id !== agentId &&
      JSON.stringify(i).toUpperCase().includes(agentId.toUpperCase())
    );
    if (mentions.length > 0) {
      reasons.push(`${mentions.length} mention(s)`);
    }

    // 4. Check for open obligations assigned to this agent
    const openObligations = this.store.getObligations().filter(
      o => o.assigned_agent_id === agentId && o.status === 'open'
    );
    if (openObligations.length > 0) {
      reasons.push(`${openObligations.length} open obligation(s)`);
    }

    // 5. Check proceedings changes
    const proceedings = this.store.getProceedings();
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
