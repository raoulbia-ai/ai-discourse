'use strict';

const crypto = require('crypto');
const { assertValid } = require('../validate');

/**
 * Synthesis Engine — manages versioned institutional readings per proceeding.
 *
 * Each proceeding maintains a current synthesis that represents the institution's
 * interpretation. Syntheses are versioned — each update creates a new version.
 *
 * Also provides discourse metrics: chain depth, convergence measurement.
 */

const CHAIN_TYPES = new Set(['challenge', 'agreement', 'revision']);
const DISCOURSE_TYPES = new Set(['interpret', 'challenge', 'agreement', 'revision', 'introduce_evidence']);

class SynthesisEngine {
  /**
   * @param {import('../../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Create or update a synthesis for a proceeding.
   * @param {{ proceeding_id: string, updated_by: string, primary_reading: string, state_basis?: string, supporting_points?: string[], uncertainties?: string[], preserved_dissent?: object[], recommended_attention?: string, recommended_state?: string }} data
   */
  update(data) {
    if (!data.proceeding_id) throw new Error('Missing required field: proceeding_id');
    if (!data.updated_by) throw new Error('Missing required field: updated_by');
    if (!data.primary_reading) throw new Error('Missing required field: primary_reading');

    // Get current version
    const existing = this.store.getSyntheses(data.proceeding_id);
    const version = existing.length > 0 ? Math.max(...existing.map(s => s.version)) + 1 : 1;

    const synthesis = {
      id: 'syn_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      proceeding_id: data.proceeding_id,
      version,
      created_at: new Date().toISOString(),
      updated_by: data.updated_by,
      state_basis: data.state_basis || 'provisional',
      primary_reading: data.primary_reading,
      supporting_points: data.supporting_points || [],
      uncertainties: data.uncertainties || [],
      preserved_dissent: data.preserved_dissent || [],
      recommended_attention: data.recommended_attention || null,
      recommended_state: data.recommended_state || null,
    };

    assertValid('synthesis', synthesis);
    return this.store.appendSynthesis(synthesis);
  }

  /**
   * Get the latest synthesis for a proceeding.
   */
  latest(proceedingId) {
    const syntheses = this.store.getSyntheses(proceedingId);
    if (syntheses.length === 0) return null;
    return syntheses.reduce((a, b) => a.version > b.version ? a : b);
  }

  /**
   * Get all synthesis versions for a proceeding.
   */
  history(proceedingId) {
    return this.store.getSyntheses(proceedingId).sort((a, b) => a.version - b.version);
  }

  /**
   * Measure discourse chain depth and convergence for a proceeding.
   *
   * A chain is a sequence where agents respond to each other
   * (interpret → challenge → agreement → revision).
   */
  measureChains(proceedingId) {
    const interventions = this.store.readInterventions({ proceeding_id: proceedingId });
    const discourse = interventions.filter(i => DISCOURSE_TYPES.has(i.type));

    if (discourse.length === 0) {
      return {
        proceeding_id: proceedingId,
        total_discourse: 0,
        chains_detected: 0,
        average_chain_depth: 0,
        max_chain_depth: 0,
        average_agents_per_chain: 0,
        interpretation: 'no_activity',
      };
    }

    // Sort by time
    discourse.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Build chains
    const chains = [];
    let currentChain = null;

    for (const msg of discourse) {
      if (msg.type === 'interpret' || msg.type === 'introduce_evidence') {
        // Start new chain
        if (currentChain && currentChain.depth > 0) chains.push(currentChain);
        currentChain = {
          depth: 1,
          agents: new Set([msg.agent_id]),
          types: [msg.type],
        };
      } else if (CHAIN_TYPES.has(msg.type)) {
        if (currentChain) {
          currentChain.depth++;
          currentChain.agents.add(msg.agent_id);
          currentChain.types.push(msg.type);
        } else {
          currentChain = {
            depth: 1,
            agents: new Set([msg.agent_id]),
            types: [msg.type],
          };
        }
      }
    }
    if (currentChain && currentChain.depth > 0) chains.push(currentChain);

    const depths = chains.map(c => c.depth);
    const agentCounts = chains.map(c => c.agents.size);
    const totalDepth = depths.reduce((a, b) => a + b, 0);
    const avgDepth = chains.length > 0 ? +(totalDepth / chains.length).toFixed(2) : 0;
    const maxDepth = chains.length > 0 ? Math.max(...depths) : 0;
    const avgAgents = chains.length > 0
      ? +(agentCounts.reduce((a, b) => a + b, 0) / chains.length).toFixed(2)
      : 0;

    let interpretation;
    if (avgDepth >= 2.5) interpretation = 'emergent_reasoning';
    else if (avgDepth >= 1.8) interpretation = 'meaningful_discourse';
    else if (avgDepth >= 1.3) interpretation = 'early_interaction';
    else interpretation = 'parallel_posting';

    return {
      proceeding_id: proceedingId,
      total_discourse: discourse.length,
      chains_detected: chains.length,
      average_chain_depth: avgDepth,
      max_chain_depth: maxDepth,
      average_agents_per_chain: avgAgents,
      interpretation,
    };
  }
}

module.exports = { SynthesisEngine };
