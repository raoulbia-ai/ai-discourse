'use strict';

/**
 * AI Discourse Infrastructure — Public Framework Surface
 *
 * This is the ONLY entry point developers should use.
 *
 * The public API is intentionally small and opinionated:
 *   createStore(dataDir)
 *   createInstitution(store)
 *   institution.registerAgent(agent)
 *   institution.openProceeding(opts)
 *   institution.submitIntervention(opts)
 *   institution.getSynthesis(proceedingId)
 *   institution.runCycle()
 *
 * Everything else is internal implementation detail.
 */

const { createStore } = require('./storage');
const { createInstitution: _createEngines } = require('./core');
const { AgentRuntime } = require('./runtime/agent-runtime');
const { CycleRunner, createCycleConfig } = require('./runtime/cycle-runner');
const { StateManager } = require('./runtime/state');

/**
 * Create a discourse institution.
 *
 * @param {object} store - Storage backend from createStore()
 * @param {{ maxParallelAgents?: number }} [opts]
 * @returns {Institution}
 */
function createInstitution(store, opts = {}) {
  return new Institution(store, opts);
}

class Institution {
  constructor(store, opts = {}) {
    this._store = store;
    this._engines = _createEngines(store);
    this._agents = new Map();
    this._maxParallel = opts.maxParallelAgents || 3;
    this._stateManager = new StateManager(store);
  }

  // ─── Core Operations (Public API) ───

  /**
   * Open a new proceeding.
   * @param {{ title: string, framing?: object, signal_ids?: string[], force?: boolean }} opts
   */
  openProceeding(opts) {
    return this._engines.proceedings.open({
      ...opts,
      opened_by: opts.opened_by || 'system',
    });
  }

  /**
   * Get a proceeding by ID.
   */
  getProceeding(id) {
    return this._engines.proceedings.get(id);
  }

  /**
   * List proceedings.
   * @param {{ status?: string, exclude_status?: string|string[] }} [filters]
   */
  listProceedings(filters) {
    return this._engines.proceedings.list(filters);
  }

  /**
   * Submit a typed intervention to a proceeding.
   * @param {{ proceeding_id: string, type: string, agent_id: string, summary: string, content: string, targets?: string[], grounds?: object, confidence?: number }} opts
   */
  submitIntervention(opts) {
    // Check governance rules
    const check = this._engines.governance.checkIntervention(opts);
    if (!check.allowed) {
      const msgs = check.violations.map(v => v.message).join('; ');
      throw new Error(`Governance violation: ${msgs}`);
    }
    return this._engines.interventions.submit(opts);
  }

  /**
   * Create an obligation (unresolved investigative work).
   * @param {{ proceeding_id: string, assigned_agent_id: string, description: string, priority?: number, ttl_hours?: number }} opts
   */
  createObligation(opts) {
    return this._engines.obligations.create(opts);
  }

  /**
   * Resolve an obligation.
   * @param {string} obligationId
   * @param {string} resolutionType - answered, declined, or deferred
   * @param {string} [interventionId] - intervention that resolved it
   */
  resolveObligation(obligationId, resolutionType, interventionId) {
    return this._engines.obligations.resolve(obligationId, resolutionType, interventionId);
  }

  /**
   * Get the latest synthesis for a proceeding.
   */
  getSynthesis(proceedingId) {
    return this._engines.synthesis.latest(proceedingId);
  }

  /**
   * Update the synthesis for a proceeding.
   * @param {{ proceeding_id: string, updated_by: string, primary_reading: string, supporting_points?: string[], uncertainties?: string[], preserved_dissent?: object[] }} opts
   */
  updateSynthesis(opts) {
    return this._engines.synthesis.update(opts);
  }

  /**
   * Get the ranked agenda (proceedings by priority).
   */
  getAgenda() {
    return this._engines.agenda.getRankedProceedings();
  }

  /**
   * Ingest a signal into the institution.
   * @param {{ type: string, source: string, timestamp: string, title: string, summary: string, payload?: object, location?: object, tags?: string[] }} signal
   */
  ingestSignal(signal) {
    return this._store.appendSignal({
      id: signal.id || 'sig_' + Date.now() + '_' + require('crypto').randomBytes(2).toString('hex'),
      ingested_at: new Date().toISOString(),
      ...signal,
    });
  }

  /**
   * Add a governance rule.
   */
  addRule(rule) {
    return this._engines.governance.addRule(rule);
  }

  /**
   * Get discourse health analysis.
   */
  getHealth() {
    return this._engines.governance.analyzeHealth();
  }

  /**
   * List interventions for a proceeding.
   * @param {string} proceedingId
   * @param {{ agent_id?: string, type?: string, limit?: number }} [filters]
   */
  listInterventions(proceedingId, filters = {}) {
    return this._engines.interventions.list({
      proceeding_id: proceedingId,
      ...filters,
    });
  }

  /**
   * Update attention scores for a proceeding.
   * @param {string} proceedingId
   * @param {{ priority?: number, urgency?: number, novelty?: number }} attention
   */
  updateAttention(proceedingId, attention) {
    return this._engines.proceedings.updateAttention(proceedingId, attention);
  }

  /**
   * Transition a proceeding to a new state.
   * @param {string} proceedingId
   * @param {string} newStatus
   */
  transitionProceeding(proceedingId, newStatus) {
    return this._engines.proceedings.transition(proceedingId, newStatus);
  }

  // ─── Agent Registration ───

  /**
   * Register an agent.
   *
   * Agents must implement:
   *   { id: string, evaluate: async (context) => { interventions: [], obligations: [] } }
   *
   * @param {{ id: string, evaluate: Function }} agent
   */
  registerAgent(agent) {
    if (!agent.id) throw new Error('Agent must have an id');
    if (typeof agent.evaluate !== 'function') throw new Error('Agent must implement evaluate(context)');
    this._agents.set(agent.id, agent);
  }

  /**
   * Get registered agent IDs.
   */
  getAgentIds() {
    return [...this._agents.keys()];
  }

  // ─── Cycle Execution ───

  /**
   * Run one deliberation cycle.
   *
   * Executes all registered agents: each receives institution state,
   * returns interventions and obligations, which are applied.
   *
   * @param {{ dryRun?: boolean }} [opts]
   */
  async runCycle(opts = {}) {
    const agentIds = this.getAgentIds();
    if (agentIds.length === 0) {
      throw new Error('No agents registered. Call registerAgent() first.');
    }

    const config = createCycleConfig({
      observation: [agentIds],
    });
    config.maxParallel = this._maxParallel;

    const runner = new CycleRunner(this._engines, this._store, config);

    const agentResults = {};
    let interventionCount = 0;
    let obligationCount = 0;
    const errors = [];

    const result = await runner.runCycle(async (agentId) => {
      const agent = this._agents.get(agentId);
      if (!agent) {
        agentResults[agentId] = 'unknown_agent';
        return 'unknown_agent';
      }

      // Build context for agent
      const rt = new AgentRuntime(agentId, this._engines, this._store);
      const context = rt.readInstitutionState();

      // Let agent evaluate
      const response = await agent.evaluate(context);

      // Apply interventions
      if (response.interventions) {
        for (const int of response.interventions) {
          try {
            this.submitIntervention({ ...int, agent_id: agentId });
            interventionCount++;
          } catch (e) {
            errors.push({ agent_id: agentId, error: e.message });
          }
        }
      }

      // Apply obligations
      if (response.obligations) {
        for (const obl of response.obligations) {
          try {
            this.createObligation({ ...obl });
            obligationCount++;
          } catch (e) {
            errors.push({ agent_id: agentId, error: e.message });
          }
        }
      }

      // Record run
      rt.recordRun('acted');
      agentResults[agentId] = 'acted';
      return 'acted';
    }, opts);

    // Return stable public summary — no internal phases/waves structure
    return {
      cycle_id: result.cycle_id,
      started_at: result.started_at,
      ended_at: result.ended_at,
      agents: agentResults,
      interventions_submitted: interventionCount,
      obligations_created: obligationCount,
      errors,
    };
  }
}

module.exports = { createStore, createInstitution, Institution };
