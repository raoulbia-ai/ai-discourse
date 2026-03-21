#!/usr/bin/env node
'use strict';

/**
 * Bug Triage — 3 agents deliberate on a software bug report.
 *
 * Agents: reproducer (confirms the bug), root-cause analyst (identifies why),
 * risk assessor (evaluates impact). Produces interpret, challenge, and synthesis.
 *
 * Uses ONLY the public API surface.
 *
 * Usage: node examples/bug-triage.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bug-triage-')));
const institution = createInstitution({ store });

// ─── Agents ───

const reproducer = {
  id: 'reproducer',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'reproducer'
      );
      if (mine.length > 0) continue;

      interventions.push({
        proceeding_id: proc.id,
        type: 'introduce_evidence',
        summary: 'Bug reproduced on v3.2.1 — null pointer in user session handler',
        content: 'Reproduced consistently when session expires mid-request. Stack trace shows UserSession.getToken() called on null reference at line 247 of session-manager.js. Affects 2.3% of requests during peak hours.',
        grounds: { evidence_refs: ['stack_trace_247', 'error_rate_dashboard'] },
      });
    }
    return { interventions, obligations: [] };
  },
};

const rootCause = {
  id: 'root-cause',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const reproducerPosts = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'reproducer'
      );
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'root-cause'
      );
      if (mine.length > 0 || reproducerPosts.length === 0) continue;

      interventions.push({
        proceeding_id: proc.id,
        type: 'interpret',
        summary: 'Race condition in session refresh — not a simple null check fix',
        content: 'The null pointer is a symptom, not the cause. The session refresh handler runs async but the request pipeline assumes sync access. Adding a null check would mask the race condition. The fix requires making getToken() await the refresh promise.',
        grounds: { evidence_refs: ['git_blame_session_refresh', 'async_flow_analysis'] },
        confidence: 0.85,
      });
    }
    return { interventions, obligations: [] };
  },
};

const riskAssessor = {
  id: 'risk-assessor',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const rootCausePosts = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'root-cause'
      );
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'risk-assessor'
      );
      if (mine.length > 0 || rootCausePosts.length === 0) continue;

      // Challenge: the async fix has its own risks
      interventions.push({
        proceeding_id: proc.id,
        type: 'challenge',
        summary: 'Async fix may introduce latency regression — needs benchmarking',
        content: 'Making getToken() async changes the hot path for all authenticated requests, not just the 2.3% with expired sessions. If the refresh promise adds >5ms p99 latency, the cure may be worse than the disease for the other 97.7% of requests. Suggest: benchmark both approaches before committing.',
        targets: [rootCausePosts[0].id],
        grounds: { evidence_refs: ['latency_sla_p99_50ms', 'request_volume_12k_rps'] },
        confidence: 0.7,
      });
    }
    return { interventions, obligations: [] };
  },
};

// ─── Register and Run ───

institution.registerAgent(reproducer);
institution.registerAgent(rootCause);
institution.registerAgent(riskAssessor);

async function main() {
  console.log('=== Bug Triage ===\n');

  // Signal: bug report
  institution.ingestSignal({
    type: 'bug_report',
    source: 'jira',
    timestamp: new Date().toISOString(),
    title: 'BUG-4821: NullPointerException in session handler during peak traffic',
    summary: 'Users seeing 500 errors when sessions expire. Error rate 2.3% during peak.',
    tags: ['bug', 'sessions', 'production'],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: 'BUG-4821: Session handler null pointer',
    framing: {
      primary_question: 'What is the root cause and what is the safest fix?',
      posture: 'diagnostic',
      in_scope: ['root cause', 'fix options', 'risk assessment'],
      out_of_scope: ['session architecture redesign', 'load testing infrastructure'],
    },
  });

  // Run cycles — agents build on each other
  for (let i = 1; i <= 3; i++) {
    const result = await institution.runCycle();
    const acted = Object.values(result.agents).filter(r => r === 'acted').length;
    console.log(`Cycle ${i}: ${acted} agents, ${result.interventions_submitted} interventions`);
  }

  // Review discourse
  const interventions = institution.listInterventions(proc.id);
  console.log(`\n--- Discourse (${interventions.length} interventions) ---`);
  for (const int of interventions) {
    console.log(`  [${int.agent_id}] ${int.type}: ${int.summary}`);
  }

  // Synthesize
  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'triage-lead',
    primary_reading: 'Root cause is an async race condition in session refresh. The correct fix (async getToken) needs latency benchmarking before deployment.',
    supporting_points: [
      'Bug reproduces consistently on session expiry (reproducer)',
      'Null pointer is a symptom of async race, not the root cause (root-cause)',
      'Async fix changes hot path — latency impact must be measured (risk-assessor)',
    ],
    uncertainties: ['Whether async overhead exceeds p99 latency SLA'],
    preserved_dissent: [{
      label: 'Ship the null check first',
      summary: 'A null check stops the 500s immediately while the proper async fix is benchmarked',
    }],
  });

  const syn = institution.getSynthesis(proc.id);
  console.log(`\n--- Synthesis (v${syn.version}) ---`);
  console.log(syn.primary_reading);
  console.log(`Uncertainties: ${syn.uncertainties.length}`);
  console.log(`Preserved dissent: ${syn.preserved_dissent.length}`);

  const health = institution.getHealth();
  console.log(`\n--- Health: ${health.discourse_health} (ratio: ${health.discourse_ratio}) ---`);
}

main().catch(console.error);
