'use strict';

const crypto = require('crypto');
const { assertValid } = require('../validate');

/**
 * Memory Engine — manages precedent links and institutional memory.
 *
 * Memory is lightweight and inspectable: simple links between proceedings,
 * not a sprawling ontology.
 */

const VALID_RELATIONS = ['historical_analog', 'causal_predecessor', 'thematic_overlap', 'contradicts', 'supersedes'];

class MemoryEngine {
  /**
   * @param {import('../../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Create a precedent link between proceedings.
   * @param {{ source_proceeding_id: string, target_proceeding_id: string, relation: string, summary: string, weight?: number, created_by?: string }} data
   */
  createLink(data) {
    if (!data.source_proceeding_id) throw new Error('Missing required field: source_proceeding_id');
    if (!data.target_proceeding_id) throw new Error('Missing required field: target_proceeding_id');
    if (!data.relation) throw new Error('Missing required field: relation');
    if (!data.summary) throw new Error('Missing required field: summary');

    if (!VALID_RELATIONS.includes(data.relation)) {
      throw new Error(`Invalid relation: "${data.relation}". Valid: ${VALID_RELATIONS.join(', ')}`);
    }

    const link = {
      id: 'prec_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      source_proceeding_id: data.source_proceeding_id,
      target_proceeding_id: data.target_proceeding_id,
      relation: data.relation,
      summary: data.summary,
      weight: data.weight !== undefined ? data.weight : null,
      created_at: new Date().toISOString(),
      created_by: data.created_by || null,
    };

    assertValid('precedent_link', link);
    return this.store.savePrecedentLink(link);
  }

  /**
   * Get all precedent links for a proceeding (as source or target).
   */
  forProceeding(proceedingId) {
    return this.store.getPrecedentLinks(proceedingId);
  }

  /**
   * Find precedent links by relation type.
   */
  byRelation(relation) {
    // Read all links and filter
    const allLinks = this.store.getAllPrecedentLinks();
    return allLinks.filter(l => l.relation === relation);
  }
}

module.exports = { MemoryEngine, VALID_RELATIONS };
