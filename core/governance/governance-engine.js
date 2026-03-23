'use strict';

const crypto = require('crypto');
const { assertValid } = require('../validate');

/**
 * Governance Engine — manages constitutional rules, stewardship actions, and discourse health.
 *
 * Governance should not remain implicit in prompts only.
 * Rules constrain valid actions. Stewardship actions (elevate, cool, preserve_dissent)
 * have time-to-live and expire automatically.
 */

const VALID_ACTIONS = ['elevate', 'cool', 'preserve_dissent', 'request_review'];
const DEFAULT_DURATIONS = {
  elevate: 12,
  cool: 6,
  preserve_dissent: 24,
  request_review: 12,
};

const DISCOURSE_TYPES = new Set(['interpret', 'challenge', 'agreement', 'revision', 'introduce_evidence']);
const ENGAGEMENT_TYPES = new Set(['challenge', 'agreement', 'revision']);

class GovernanceEngine {
  /**
   * @param {import('../../storage/file-store')} store
   */
  constructor(store) {
    this.store = store;
  }

  // --- Rules ---

  /**
   * Add a governance rule.
   */
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

  /**
   * List all governance rules.
   */
  listRules() {
    return this.store.getRules();
  }

  /**
   * Get rules that apply to a specific intervention type.
   */
  rulesFor(interventionType) {
    return this.store.getRules().filter(r =>
      r.applies_to.length === 0 || r.applies_to.includes(interventionType)
    );
  }

  /**
   * Check an intervention against applicable rules.
   * Returns { allowed: true } or { allowed: false, violations: [] }.
   */
  checkIntervention(intervention) {
    const rules = this.rulesFor(intervention.type);
    const violations = [];

    for (const rule of rules) {
      if (rule.enforcement.mode === 'hard_block') {
        // Currently checks grounds requirement for escalation-type rules
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

  // --- Stewardship Actions ---

  /**
   * Post a stewardship action (elevate, cool, preserve_dissent, request_review).
   * Actions have TTL and expire automatically.
   */
  postAction(data) {
    if (!data.agent_id) throw new Error('Missing required field: agent_id');
    if (!data.action) throw new Error('Missing required field: action');
    if (!data.proceeding_id) throw new Error('Missing required field: proceeding_id');
    if (!data.reason) throw new Error('Missing required field: reason');

    if (!VALID_ACTIONS.includes(data.action)) {
      throw new Error(`Invalid action: "${data.action}". Valid: ${VALID_ACTIONS.join(', ')}`);
    }

    const durationHours = data.duration_hours || DEFAULT_DURATIONS[data.action] || 12;
    const now = new Date();

    const record = {
      id: 'gov_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'),
      agent_id: data.agent_id,
      action: data.action,
      proceeding_id: data.proceeding_id,
      reason: data.reason,
      duration_hours: durationHours,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + durationHours * 3600000).toISOString(),
      expired: false,
    };

    this.store.appendGovernanceAction(record);
    return record;
  }

  /**
   * Get active (non-expired) governance actions.
   */
  getActiveActions() {
    const actions = this.store.readGovernanceActions();
    const now = new Date();
    return actions.filter(a => !a.expired && new Date(a.expires_at) > now);
  }

  /**
   * Expire past-due governance actions.
   */
  expireActions() {
    const actions = this.store.readGovernanceActions();
    const now = new Date();
    let count = 0;

    const updated = actions.map(a => {
      if (!a.expired && new Date(a.expires_at) < now) {
        count++;
        return { ...a, expired: true };
      }
      return a;
    });

    if (count > 0) {
      this.store.writeGovernanceActions(updated);
    }
    return count;
  }

  // --- Discourse Health ---

  /**
   * Analyze discourse health across all proceedings.
   * Detects: stalled proceedings, echo chambers, orphan hypotheses.
   */
  analyzeHealth() {
    const interventions = this.store.readInterventions();
    const discourse = interventions.filter(i => DISCOURSE_TYPES.has(i.type));
    const total = discourse.length;

    const engagements = discourse.filter(i => ENGAGEMENT_TYPES.has(i.type)).length;
    const discourseRatio = total > 0 ? +(engagements / total).toFixed(3) : 0;

    // Group by proceeding
    const byProceeding = {};
    for (const msg of discourse) {
      if (!msg.proceeding_id) continue;
      if (!byProceeding[msg.proceeding_id]) byProceeding[msg.proceeding_id] = [];
      byProceeding[msg.proceeding_id].push(msg);
    }

    const stalledProceedings = [];
    const echoChambers = [];
    const orphanHypotheses = [];

    for (const [procId, msgs] of Object.entries(byProceeding)) {
      const types = new Set(msgs.map(m => m.type));
      const hasEngagement = types.has('challenge') || types.has('revision');

      if (!hasEngagement && !types.has('agreement') && (types.has('interpret') || types.has('introduce_evidence'))) {
        stalledProceedings.push(procId);
      }

      if (types.has('agreement') && !types.has('challenge') && !types.has('revision')) {
        echoChambers.push(procId);
      }

      const hypotheses = msgs.filter(m => m.type === 'interpret');
      for (const h of hypotheses) {
        const responses = msgs.filter(m =>
          ENGAGEMENT_TYPES.has(m.type) &&
          new Date(m.created_at) > new Date(h.created_at)
        );
        if (responses.length === 0) {
          orphanHypotheses.push({
            proceeding_id: procId,
            agent_id: h.agent_id,
            summary: (h.summary || '').slice(0, 100),
          });
        }
      }
    }

    const proceedingCount = Object.keys(byProceeding).length;

    return {
      total_discourse: total,
      engagement_count: engagements,
      discourse_ratio: discourseRatio,
      discourse_health: discourseRatio >= 0.3 ? 'healthy' : discourseRatio >= 0.15 ? 'weak' : 'very_weak',
      proceeding_count: proceedingCount,
      stalled_proceedings: stalledProceedings,
      echo_chambers: echoChambers,
      orphan_hypotheses: orphanHypotheses.slice(0, 10),
    };
  }
}

module.exports = { GovernanceEngine, VALID_ACTIONS, DEFAULT_DURATIONS };
