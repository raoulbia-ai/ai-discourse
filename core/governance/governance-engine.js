'use strict';

const { GovernanceRules } = require('./governance-rules');
const { StewardshipActions, VALID_ACTIONS, DEFAULT_DURATIONS } = require('./stewardship-actions');
const { DiscourseHealth } = require('./discourse-health');

/**
 * Governance Engine — composes rules, stewardship actions, and discourse health.
 *
 * This is a thin delegation layer. Each concern is implemented in its own module:
 * - governance-rules.js — constitutional logic constraining valid actions
 * - stewardship-actions.js — time-bounded governance interventions
 * - discourse-health.js — discourse quality analysis
 */

class GovernanceEngine {
  constructor(store) {
    this.rules = new GovernanceRules(store);
    this.actions = new StewardshipActions(store);
    this.health = new DiscourseHealth(store);
  }

  // --- Rules (delegated) ---
  addRule(data) { return this.rules.addRule(data); }
  listRules() { return this.rules.listRules(); }
  rulesFor(interventionType) { return this.rules.rulesFor(interventionType); }
  checkIntervention(intervention) { return this.rules.checkIntervention(intervention); }

  // --- Stewardship Actions (delegated) ---
  postAction(data) { return this.actions.postAction(data); }
  getActiveActions() { return this.actions.getActiveActions(); }
  expireActions() { return this.actions.expireActions(); }

  // --- Discourse Health (delegated) ---
  analyzeHealth() { return this.health.analyzeHealth(); }
}

module.exports = { GovernanceEngine, VALID_ACTIONS, DEFAULT_DURATIONS };
