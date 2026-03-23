'use strict';

const crypto = require('crypto');
const { assertValid } = require('../validate');

/**
 * Governance Rules — constitutional logic that constrains valid institutional actions.
 */

class GovernanceRules {
  constructor(store) {
    this.store = store;
  }

  addRule(data) {
    if (!data.name) throw new Error('Missing required field: name');
    if (!data.category) throw new Error('Missing required field: category');
    if (!data.description) throw new Error('Missing required field: description');
    if (!data.enforcement) throw new Error('Missing required field: enforcement');

    const rule = {
      id: data.id || 'rule_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      name: data.name,
      category: data.category,
      description: data.description,
      applies_to: data.applies_to || [],
      enforcement: data.enforcement,
      version: data.version || 1,
      created_at: new Date().toISOString(),
      amended_at: null,
    };

    assertValid('governance_rule', rule);
    return this.store.saveRule(rule);
  }

  listRules() {
    return this.store.getRules();
  }

  rulesFor(interventionType) {
    return this.store.getRules().filter(r =>
      r.applies_to.length === 0 || r.applies_to.includes(interventionType)
    );
  }

  checkIntervention(intervention) {
    const rules = this.rulesFor(intervention.type);
    const violations = [];

    for (const rule of rules) {
      if (rule.enforcement.mode === 'hard_block') {
        if (rule.category === 'intervention_validity') {
          const g = intervention.grounds;
          const hasGrounds = g && (
            (g.signal_ids && g.signal_ids.length > 0) ||
            (g.precedent_ids && g.precedent_ids.length > 0) ||
            (g.evidence_refs && g.evidence_refs.length > 0)
          );
          if (!hasGrounds && rule.applies_to.includes(intervention.type)) {
            violations.push({ rule_id: rule.id, message: rule.enforcement.message });
          }
        }
      }
    }

    return violations.length === 0
      ? { allowed: true }
      : { allowed: false, violations };
  }
}

module.exports = { GovernanceRules };
