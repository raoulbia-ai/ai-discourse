'use strict';

/**
 * Agent Runtime — the 3-operation interface for agents.
 *
 * Agents interact with the institution through exactly three operations:
 * 1. readInstitutionState() — get proceedings, synthesis, obligations relevant to this agent
 * 2. submitIntervention(intervention) — typed procedural act with grounds
 * 3. fulfillObligation(obligationId, resolution) — resolve assigned work
 *
 * The runtime also handles delta-gating: checking whether the agent should act.
 */

const { DeltaDetector } = require('./delta');
const { StateManager } = require('./state');
const { InstitutionContext } = require('./institution-context');

class AgentRuntime {
  /**
   * @param {string} agentId
   * @param {InstitutionContext|object} contextOrEngines - InstitutionContext or raw engines object
   * @param {import('../storage/file-store')} [store] - Required if passing raw engines (legacy)
   */
  constructor(agentId, contextOrEngines, store) {
    this.agentId = agentId;

    // Support both: new InstitutionContext form and legacy (engines, store) form
    if (contextOrEngines instanceof InstitutionContext) {
      this.inst = contextOrEngines;
      this.store = contextOrEngines.store;
    } else {
      this.inst = contextOrEngines;
      this.store = store;
    }

    this.delta = new DeltaDetector(this.store);
    this.state = new StateManager(this.store);
  }

  /**
   * Check if this agent should act (delta-gating).
   * Returns { changed, reason, ... } or null if no changes.
   */
  shouldAct() {
    const lastState = this.state.getAgentState(this.agentId) || {};
    return this.delta.check(this.agentId, lastState);
  }

  /**
   * Operation 1: Read institution state relevant to this agent.
   *
   * Returns proceedings, synthesis, obligations, agenda, and governance actions.
   */
  readInstitutionState() {
    // Get agent's watchlist
    const watchlist = this.inst.agenda.getWatchlist(this.agentId);
    const watchedProceedingIds = watchlist.map(w => w.proceeding_id);

    // Get all active proceedings
    const allProceedings = this.inst.proceedings.list({
      exclude_status: ['archived', 'retired'],
    });

    // Get watched proceedings with full data
    const watchedProceedings = allProceedings.filter(p => watchedProceedingIds.includes(p.id));

    // Get latest synthesis for watched proceedings
    const syntheses = {};
    for (const p of watchedProceedings) {
      const syn = this.inst.synthesis.latest(p.id);
      if (syn) syntheses[p.id] = syn;
    }

    // Get open obligations for this agent
    const obligations = this.inst.obligations.forAgent(this.agentId);

    // Get active governance actions
    const governanceActions = this.inst.governance.getActiveActions();

    // Get recent interventions (last offset)
    const lastState = this.state.getAgentState(this.agentId) || {};
    const lastOffset = lastState.last_seen_comms_offset || 0;
    const recentInterventions = this.store.readInterventions({ offset: lastOffset });

    return {
      proceedings: allProceedings,
      watched_proceedings: watchedProceedings,
      syntheses,
      obligations,
      governance_actions: governanceActions,
      recent_interventions: recentInterventions,
      agenda: watchlist,
    };
  }

  /**
   * Operation 2: Submit an intervention.
   */
  submitIntervention(data) {
    return this.inst.interventions.submit({
      ...data,
      agent_id: this.agentId,
    });
  }

  /**
   * Operation 3: Fulfill an obligation.
   */
  fulfillObligation(obligationId, resolutionType, interventionId = null) {
    return this.inst.obligations.resolve(obligationId, resolutionType, interventionId);
  }

  /**
   * Record that this agent has completed its cycle run.
   */
  recordRun(result, deltaResult = null) {
    const update = { result };
    if (deltaResult) {
      update.snapshot_hash = deltaResult.snapshot_hash;
      update.comms_offset = deltaResult.comms_offset;
      update.proceedings_hash = deltaResult.proceedings_hash;
    }
    return this.state.updateAgentState(this.agentId, update);
  }
}

module.exports = { AgentRuntime };
