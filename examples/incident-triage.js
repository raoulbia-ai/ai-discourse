#!/usr/bin/env node
'use strict';

/**
 * 5-Minute Example: Incident Response Triage
 *
 * Two agents triage a production incident through structured deliberation.
 * Demonstrates: signals, proceedings, interventions with challenge,
 * obligations, synthesis, and discourse health.
 *
 * Uses ONLY the public API surface.
 *
 * Usage: node infra/examples/incident-triage.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'incident-')));
const institution = createInstitution({ store });

// ─── Agents ───

const sre = {
  id: 'sre-oncall',
  async evaluate(context) {
    const interventions = [];
    const obligations = [];

    for (const proc of context.proceedings) {
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'sre-oncall'
      );
      if (mine.length > 0) continue;

      // SRE interprets as infra issue
      interventions.push({
        proceeding_id: proc.id,
        type: 'interpret',
        summary: 'Database connection pool exhaustion causing cascading timeouts',
        content: 'Error rate spike correlates with connection pool metrics hitting ceiling at 14:32. Upstream services are timing out waiting for DB connections. Likely root cause: connection leak in the payment service deployment from this morning.',
        grounds: { evidence_refs: ['grafana_db_pool_14:32', 'deploy_log_payment_v2.3.1'] },
        confidence: 0.75,
      });

      // Create obligation for security review
      obligations.push({
        proceeding_id: proc.id,
        assigned_agent_id: 'security-review',
        description: 'Rule out external cause — check for unusual traffic patterns or attack signatures in the timeframe.',
      });
    }
    return { interventions, obligations };
  },
};

const security = {
  id: 'security-review',
  async evaluate(context) {
    const interventions = [];

    for (const proc of context.proceedings) {
      const srePosts = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'sre-oncall'
      );
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'security-review'
      );
      if (mine.length > 0 || srePosts.length === 0) continue;

      // Security challenges the infra-only interpretation
      interventions.push({
        proceeding_id: proc.id,
        type: 'challenge',
        summary: 'Traffic anomaly detected — external factor cannot be ruled out',
        content: 'WAF logs show a 340% spike in requests to /api/checkout from a single ASN starting at 14:28, four minutes before the pool exhaustion. The connection leak theory may be correct, but it could have been triggered or amplified by this traffic pattern. Recommend treating as potential application-layer attack until ruled out.',
        targets: [srePosts[0].id],
        grounds: { evidence_refs: ['waf_log_14:28', 'asn_analysis_AS13335'] },
        confidence: 0.6,
      });
    }
    return { interventions, obligations: [] };
  },
};

// ─── Register and Run ───

institution.registerAgent(sre);
institution.registerAgent(security);

async function main() {
  console.log('=== Incident Triage ===\n');

  // Signal: alert fires
  institution.ingestSignal({
    type: 'alert',
    source: 'pagerduty',
    timestamp: '2026-03-21T14:35:00Z',
    title: 'CRITICAL: API error rate >5% for 3 minutes',
    summary: 'Production API returning 503s. Error rate 8.2%. Started 14:32 UTC.',
    tags: ['production', 'api', 'critical'],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: 'Production API outage — 2026-03-21 14:32 UTC',
    framing: {
      primary_question: 'What is causing the API error spike and what is the correct remediation?',
      posture: 'incident_response',
      in_scope: ['root cause', 'blast radius', 'immediate remediation'],
      out_of_scope: ['long-term architecture changes', 'post-mortem process'],
      time_horizon: '4h',
    },
  });

  // Cycle 1: both agents post initial assessments
  let result = await institution.runCycle();
  console.log(`Cycle 1: ${result.interventions_submitted} interventions, ${result.obligations_created} obligations`);

  // Cycle 2: security challenges SRE's interpretation
  result = await institution.runCycle();
  console.log(`Cycle 2: ${result.interventions_submitted} interventions`);

  // Review the discourse
  const interventions = institution.listInterventions(proc.id);
  console.log(`\n--- Discourse (${interventions.length} interventions) ---`);
  for (const int of interventions) {
    console.log(`  [${int.agent_id}] ${int.type}: ${int.summary}`);
  }

  // Synthesize
  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'incident-commander',
    primary_reading: 'Connection pool exhaustion is the proximate cause, but a traffic anomaly may have triggered it. Both remediation tracks should proceed in parallel.',
    supporting_points: [
      'DB connection pool hit ceiling at 14:32 (sre-oncall)',
      'WAF shows 340% traffic spike from single ASN at 14:28 (security-review)',
      'Payment service v2.3.1 deployed this morning — connection leak suspected',
    ],
    uncertainties: [
      'Whether the traffic spike is malicious or coincidental',
      'Whether the connection leak existed before today\'s deploy',
    ],
    preserved_dissent: [{
      label: 'External attack vector',
      summary: 'security-review argues external traffic pattern cannot be ruled out as primary cause',
    }],
  });

  const syn = institution.getSynthesis(proc.id);
  console.log(`\n--- Synthesis (v${syn.version}) ---`);
  console.log(syn.primary_reading);

  // Health
  const health = institution.getHealth();
  console.log(`\n--- Health ---`);
  console.log(`Discourse ratio: ${health.discourse_ratio} (${health.discourse_health})`);
  console.log(`Stalled: ${health.stalled_proceedings.length}, Echo chambers: ${health.echo_chambers.length}`);
}

main().catch(console.error);
