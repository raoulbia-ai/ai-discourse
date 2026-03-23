'use strict';

/**
 * State Manager — tracks per-agent run state across cycles.
 *
 * Each agent has a state record with its last run time, snapshot hash,
 * comms offset, and result. This enables delta-gating: agents only
 * act when there's material change since their last run.
 */

class StateManager {
  /**
   * @param {import('../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Get the current state for an agent.
   */
  getAgentState(agentId) {
    const allState = this.store.getAgentStates();
    return allState[agentId] || null;
  }

  /**
   * Get state for all agents.
   */
  getAllStates() {
    return this.store.getAgentStates();
  }

  /**
   * Update an agent's state after a cycle run.
   *
   * @param {string} agentId
   * @param {{ result: string, snapshot_hash?: string, comms_offset?: number, proceedings_hash?: string }} update
   */
  updateAgentState(agentId, update) {
    const allState = this.store.getAgentStates();
    const prev = allState[agentId] || {};
    const now = new Date().toISOString();

    allState[agentId] = {
      last_run: now,
      snapshot_hash: update.snapshot_hash || prev.snapshot_hash || null,
      last_seen_comms_offset: update.comms_offset !== undefined ? update.comms_offset : (prev.last_seen_comms_offset || 0),
      proceedings_hash: update.proceedings_hash || prev.proceedings_hash || null,
      last_substantive_output_at: update.result === 'acted' ? now : (prev.last_substantive_output_at || null),
      result: update.result,
    };

    this.store.saveAgentStates(allState);

    // Append to run audit log
    this.store.appendAgentRun({
      timestamp: now,
      agent: agentId,
      result: update.result,
    });

    return allState[agentId];
  }

  /**
   * Get the audit log of all agent runs.
   */
  getRunLog() {
    return this.store.readAgentRuns();
  }
}

module.exports = { StateManager };
