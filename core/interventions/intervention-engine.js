'use strict';

const crypto = require('crypto');
const { assertValid } = require('../validate');

/**
 * Intervention Engine — manages typed procedural acts within proceedings.
 *
 * Agents do not communicate directly. They submit interventions.
 * Each intervention is validated, recorded, and may trigger obligations.
 */

const VALID_TYPES = [
  'interpret', 'challenge', 'introduce_evidence', 'request_verification',
  'propose_framing', 'narrow_scope', 'widen_scope', 'split_proceeding',
  'merge_proceedings', 'escalate', 'defer', 'synthesize',
  'propose_settlement', 'reopen', 'agreement', 'revision',
];

// Types that require grounds (signal_ids, precedent_ids, or evidence_refs)
const GROUNDED_TYPES = ['interpret', 'challenge', 'introduce_evidence', 'escalate', 'revision'];

// Types that require targets (references to prior interventions)
const RESPONSE_TYPES = ['challenge', 'agreement', 'revision'];

class InterventionEngine {
  /**
   * @param {import('../../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Submit a new intervention.
   * @param {{ proceeding_id: string, type: string, agent_id: string, summary: string, content: string, targets?: string[], grounds?: object, confidence?: number }} data
   */
  submit(data) {
    if (!data.proceeding_id) throw new Error('Missing required field: proceeding_id');
    if (!data.type) throw new Error('Missing required field: type');
    if (!data.agent_id) throw new Error('Missing required field: agent_id');
    if (!data.summary) throw new Error('Missing required field: summary');
    if (!data.content) throw new Error('Missing required field: content');

    if (!VALID_TYPES.includes(data.type)) {
      throw new Error(`Invalid intervention type: "${data.type}". Valid: ${VALID_TYPES.join(', ')}`);
    }

    // Validate grounds requirement
    if (GROUNDED_TYPES.includes(data.type)) {
      const g = data.grounds;
      const hasGrounds = g && (
        (g.signal_ids && g.signal_ids.length > 0) ||
        (g.precedent_ids && g.precedent_ids.length > 0) ||
        (g.evidence_refs && g.evidence_refs.length > 0)
      );
      if (!hasGrounds) {
        throw new Error(`Intervention type "${data.type}" requires grounds (signal_ids, precedent_ids, or evidence_refs)`);
      }
    }

    // Validate response types have targets
    if (RESPONSE_TYPES.includes(data.type)) {
      if (!data.targets || data.targets.length === 0) {
        throw new Error(`Intervention type "${data.type}" requires targets (references to prior interventions)`);
      }
    }

    const now = new Date().toISOString();
    const intervention = {
      id: 'int_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      proceeding_id: data.proceeding_id,
      type: data.type,
      agent_id: data.agent_id,
      created_at: now,
      summary: data.summary,
      content: data.content,
      targets: data.targets || [],
      grounds: data.grounds || null,
      confidence: data.confidence !== undefined ? data.confidence : null,
      legitimacy: {
        grounded: GROUNDED_TYPES.includes(data.type) ? true : null,
        corroboration_state: 'unverified',
        procedural_validity: 'valid',
      },
      effects: {
        proposed_state_change: data.proposed_state_change || null,
        proposed_attention_change: data.proposed_attention_change || null,
        proposed_obligation_ids: [],
      },
    };

    assertValid('intervention', intervention);
    return this.store.appendIntervention(intervention);
  }

  /**
   * Read interventions with filters.
   */
  list(filters = {}) {
    return this.store.readInterventions(filters);
  }

  /**
   * Get interventions for a specific proceeding.
   */
  forProceeding(proceedingId) {
    return this.store.readInterventions({ proceeding_id: proceedingId });
  }

  /**
   * Get interventions by a specific agent.
   */
  byAgent(agentId) {
    return this.store.readInterventions({ agent_id: agentId });
  }

  /**
   * Count interventions by type for a proceeding.
   */
  typeCounts(proceedingId) {
    const interventions = this.forProceeding(proceedingId);
    const counts = {};
    for (const i of interventions) {
      counts[i.type] = (counts[i.type] || 0) + 1;
    }
    return counts;
  }
}

module.exports = { InterventionEngine, VALID_TYPES, GROUNDED_TYPES, RESPONSE_TYPES };
