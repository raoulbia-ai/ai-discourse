'use strict';

/**
 * Cycle Runner — orchestrates one institutional cycle.
 *
 * Executes phases in order, dispatching agents in configurable waves.
 * Each cycle:
 *   1. Ingest signals
 *   2. Observation waves (analysts interpret)
 *   3. Reaction waves (analysts respond to each other, delta-gated)
 *   4. Synthesis (chronicler writes institutional reading)
 *   5. Executive (stewards adjust governance)
 *   6. Post-cycle assessment
 *   7. Record cycle snapshot
 *
 * The runner is parameterized by a cycle config — wave definitions,
 * timing, and agent assignments are application-specific.
 */

/**
 * @typedef {Object} WaveConfig
 * @property {string} name - Wave identifier
 * @property {string[]} agents - Agent IDs to run in this wave
 * @property {boolean} [deltaGated] - If true, only run agents with changes
 * @property {number} [delayAfterMs] - Delay after wave completes (ms)
 */

/**
 * @typedef {Object} PhaseConfig
 * @property {string} name - Phase name
 * @property {WaveConfig[]} waves - Waves in this phase
 */

/**
 * @typedef {Object} CycleConfig
 * @property {PhaseConfig[]} phases - Ordered phases
 * @property {number} [maxParallel] - Max agents running simultaneously
 */

class CycleRunner {
  /**
   * @param {import('../core').createInstitution} institution
   * @param {import('../storage/file-store')} store
   * @param {CycleConfig} config
   */
  constructor(institution, store, config, factories = {}) {
    this.inst = institution;
    this.store = store;
    this.config = config;
    this.maxParallel = config.maxParallel || 3;
    this._createDelta = factories.createDelta || ((s) => new (require('./delta').DeltaDetector)(s));
    this._createState = factories.createState || ((s) => new (require('./state').StateManager)(s));
  }

  /**
   * Get the next cycle number.
   */
  getNextCycleId() {
    const snapshots = this.store.getCycleSnapshots();
    if (snapshots.length === 0) return 1;
    return Math.max(...snapshots.map(s => s.cycle_id)) + 1;
  }

  /**
   * Execute a single wave of agents.
   *
   * @param {WaveConfig} wave
   * @param {Function} agentExecutor - async (agentId) => result
   * @param {{ dryRun?: boolean, onAgentStart?: Function, onAgentComplete?: Function }} opts
   * @returns {Promise<Object[]>} results per agent
   */
  async executeWave(wave, agentExecutor, opts = {}) {
    const { dryRun, onAgentStart, onAgentComplete } = opts;
    const results = [];

    if (dryRun) {
      for (const agentId of wave.agents) {
        results.push({ agentId, result: 'dry_run', skipped: false });
      }
      return results;
    }

    // Delta-gating: check which agents should act
    let agentsToRun = wave.agents;
    if (wave.deltaGated) {
      const delta = this._createDelta(this.store);
      const state = this._createState(this.store);

      agentsToRun = wave.agents.filter(agentId => {
        const lastState = state.getAgentState(agentId) || {};
        const check = delta.check(agentId, lastState);
        return check.changed;
      });
    }

    // Execute in batches respecting maxParallel
    for (let i = 0; i < agentsToRun.length; i += this.maxParallel) {
      const batch = agentsToRun.slice(i, i + this.maxParallel);
      const batchResults = await Promise.allSettled(
        batch.map(async agentId => {
          if (onAgentStart) onAgentStart(agentId, wave.name);
          const result = await agentExecutor(agentId);
          if (onAgentComplete) onAgentComplete(agentId, wave.name, result);
          return { agentId, result, skipped: false };
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          results.push({
            agentId: 'unknown',
            result: 'error',
            error: r.reason?.message || String(r.reason),
            skipped: false,
          });
        }
      }
    }

    // Add skipped agents
    const skippedAgents = wave.agents.filter(a => !agentsToRun.includes(a));
    for (const agentId of skippedAgents) {
      results.push({ agentId, result: 'skipped', skipped: true });
    }

    return results;
  }

  /**
   * Execute a full cycle.
   *
   * @param {Function} agentExecutor - async (agentId) => result
   * @param {{ dryRun?: boolean, onPhaseStart?: Function, onPhaseEnd?: Function, onAgentStart?: Function, onAgentComplete?: Function }} opts
   * @returns {Promise<Object>} cycle result
   */
  async runCycle(agentExecutor, opts = {}) {
    const cycleId = this.getNextCycleId();
    const startedAt = new Date().toISOString();
    const phaseResults = [];

    for (const phase of this.config.phases) {
      if (opts.onPhaseStart) opts.onPhaseStart(phase.name, cycleId);

      const waveResults = [];
      for (const wave of phase.waves) {
        const results = await this.executeWave(wave, agentExecutor, {
          dryRun: opts.dryRun,
          onAgentStart: opts.onAgentStart,
          onAgentComplete: opts.onAgentComplete,
        });
        waveResults.push({ wave: wave.name, results });

        // Inter-wave delay
        if (wave.delayAfterMs && !opts.dryRun) {
          await new Promise(resolve => setTimeout(resolve, wave.delayAfterMs));
        }
      }

      phaseResults.push({ phase: phase.name, waves: waveResults });
      if (opts.onPhaseEnd) opts.onPhaseEnd(phase.name, cycleId);
    }

    const endedAt = new Date().toISOString();

    // Record cycle snapshot
    const snapshot = {
      cycle_id: cycleId,
      started_at: startedAt,
      ended_at: endedAt,
      new_signal_ids: [],
      updated_proceeding_ids: [],
      new_intervention_ids: [],
      resolved_obligation_ids: [],
      settled_proceeding_ids: [],
      agenda_summary: null,
      institutional_notes: [],
    };

    if (!opts.dryRun) {
      this.store.appendCycleSnapshot(snapshot);
    }

    return {
      cycle_id: cycleId,
      started_at: startedAt,
      ended_at: endedAt,
      phases: phaseResults,
      snapshot,
    };
  }
}

/**
 * Create a default cycle config from a simple wave definition.
 *
 * @param {{ observation: string[][], reaction: string[][], synthesis: string[], executive: string[], assessment?: string[] }} waves
 * @param {{ interWaveDelayMs?: number }} [opts]
 * @returns {CycleConfig}
 */
function createCycleConfig(waves, opts = {}) {
  const delay = opts.interWaveDelayMs || 0;

  const phases = [];

  // Observation phase
  if (waves.observation) {
    phases.push({
      name: 'observation',
      waves: waves.observation.map((agents, i) => ({
        name: `obs_wave_${i + 1}`,
        agents,
        deltaGated: false,
        delayAfterMs: delay,
      })),
    });
  }

  // Reaction phase
  if (waves.reaction) {
    phases.push({
      name: 'reaction',
      waves: waves.reaction.map((agents, i) => ({
        name: `react_wave_${i + 1}`,
        agents,
        deltaGated: true,
        delayAfterMs: delay,
      })),
    });
  }

  // Synthesis phase
  if (waves.synthesis) {
    phases.push({
      name: 'synthesis',
      waves: [{ name: 'synthesis', agents: waves.synthesis, delayAfterMs: delay }],
    });
  }

  // Executive phase
  if (waves.executive) {
    phases.push({
      name: 'executive',
      waves: [{ name: 'executive', agents: waves.executive, delayAfterMs: delay }],
    });
  }

  // Assessment phase
  if (waves.assessment) {
    phases.push({
      name: 'assessment',
      waves: [{ name: 'assessment', agents: waves.assessment }],
    });
  }

  return { phases };
}

module.exports = { CycleRunner, createCycleConfig };
