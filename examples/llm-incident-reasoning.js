#!/usr/bin/env node
'use strict';

/**
 * LLM Incident Reasoning — 3 agents deliberate on a production incident
 * over 4 cycles with evolving synthesis.
 *
 * Agents:
 *   backend-eng   — traces the technical root cause
 *   qa-eng        — challenges assumptions, checks evidence quality
 *   product-mgr   — evaluates user impact and remediation priorities
 *
 * Static incident object — no external integrations.
 * Uses ONLY the public API surface + LLM adapter.
 *
 * Requirements:
 *   - OpenAI-compatible API running (vLLM, Ollama, OpenAI)
 *   - Default: http://127.0.0.1:8000/v1 with model "local-vllm"
 *
 * Usage:
 *   node examples/llm-incident-reasoning.js
 *   BASE_URL=https://api.openai.com/v1 MODEL=gpt-4o API_KEY=sk-... node examples/llm-incident-reasoning.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');
const { createLLMAgent } = require('../adapters');

// ─── Config ───

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/v1';
const MODEL = process.env.MODEL || 'local-vllm';
const API_KEY = process.env.API_KEY || undefined;
const CYCLES = 4;

// ─── Static Incident ───

const INCIDENT = {
  id: 'INC-2847',
  severity: 'P1',
  title: 'Checkout flow returning 500 errors for ~12% of users',
  reported_at: '2026-03-22T09:15:00Z',
  symptoms: [
    'HTTP 500 on POST /api/checkout/confirm',
    'Error rate jumped from 0.1% to 12.3% at 09:08 UTC',
    'Only affects users with saved payment methods',
    'Users with new card entry are unaffected',
    'No deployment in the last 6 hours',
  ],
  timeline: [
    '09:08 — Error rate spike begins',
    '09:10 — PagerDuty alert fires',
    '09:12 — On-call acknowledges',
    '09:15 — Incident declared P1',
    '09:18 — Initial logs show "token decryption failed" in payment-service',
    '09:22 — payment-service memory usage normal, CPU normal',
    '09:25 — Noticed: payment provider rotated their API encryption key at 09:00 UTC per scheduled maintenance window',
  ],
  affected_systems: ['payment-service', 'checkout-api', 'user-wallet-service'],
  recent_changes: [
    'No deployments in 6 hours',
    'Database migration ran at 07:00 (unrelated schema — order history)',
    'Payment provider scheduled key rotation at 09:00 UTC (announced 2 weeks ago)',
  ],
};

// ─── Setup ───

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'incident-reason-')));
const institution = createInstitution({ store });

// ─── Agents ───

const backendEng = createLLMAgent({
  id: 'backend-eng',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "backend-eng", a senior backend engineer investigating a production incident.

You focus on: code paths, error traces, system interactions, deployment history, infrastructure state.
You form technical hypotheses about root cause and propose fixes.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "interpret" for your technical hypothesis (requires "grounds" with evidence_refs)
- Use "challenge" to dispute another agent's analysis (requires "targets" with their intervention ID)
- Use "introduce_evidence" to present new technical findings (requires "grounds")
- Use "agreement" to support another agent's finding with additional evidence (requires "targets")
- Use "revision" to update your own earlier hypothesis based on new information (requires "targets" and "grounds")
- Build on what others have said — don't repeat yourself
- If you've already posted and nothing new has emerged, return empty interventions

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const qaEng = createLLMAgent({
  id: 'qa-eng',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.4,
  systemPrompt: `You are "qa-eng", a QA engineer who challenges assumptions during incident investigation.

You focus on: evidence quality, untested assumptions, alternative explanations, reproduction steps.
You are constructively skeptical — you don't accept hypotheses without evidence.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "challenge" to question another agent's hypothesis (requires "targets" with their intervention ID, and "grounds")
- Use "introduce_evidence" to present findings from your own investigation (requires "grounds")
- Use "interpret" for your own analysis (requires "grounds")
- Use "agreement" when evidence convinces you (requires "targets")
- You MUST challenge at least one hypothesis if you see weak evidence or untested assumptions
- Don't repeat points already made — build on the discourse

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const productMgr = createLLMAgent({
  id: 'product-mgr',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "product-mgr", a product manager evaluating user impact during an incident.

You focus on: user impact scope, business risk, remediation priorities, communication needs.
You translate technical findings into impact assessment and action priorities.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "interpret" for impact assessment (requires "grounds")
- Use "challenge" when you disagree with severity assessment or proposed fix priority (requires "targets" and "grounds")
- Use "introduce_evidence" for user-facing data (requires "grounds")
- Use "agreement" to endorse a remediation approach (requires "targets")
- Don't repeat points already made — build on what the engineers found

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

// ─── Register ───

institution.registerAgent(backendEng);
institution.registerAgent(qaEng);
institution.registerAgent(productMgr);

// ─── Run ───

async function main() {
  console.log(`=== LLM Incident Reasoning: ${INCIDENT.id} ===`);
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}`);
  console.log('');
  console.log('--- Incident Input ---');
  console.log(`  Title: ${INCIDENT.title}`);
  console.log(`  Severity: ${INCIDENT.severity}`);
  console.log(`  Symptoms:`);
  for (const s of INCIDENT.symptoms) console.log(`    - ${s}`);
  console.log(`  Key clue: ${INCIDENT.timeline[INCIDENT.timeline.length - 1]}`);
  console.log('');
  console.log('--- Agents & Roles ---');
  console.log('  backend-eng : traces technical root cause (code paths, error traces, infra state)');
  console.log('  qa-eng      : challenges assumptions, checks evidence quality, proposes alternatives');
  console.log('  product-mgr : evaluates user impact and remediation priorities');
  console.log('');

  // Ingest incident as signal
  institution.ingestSignal({
    type: 'incident',
    source: 'pagerduty',
    timestamp: INCIDENT.reported_at,
    title: INCIDENT.title,
    summary: INCIDENT.symptoms.join('. '),
    tags: ['incident', INCIDENT.severity, ...INCIDENT.affected_systems],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: `${INCIDENT.id}: ${INCIDENT.title}`,
    framing: {
      primary_question: 'What is the root cause and what is the correct remediation path?',
      posture: 'incident_investigation',
      in_scope: [
        'root cause identification',
        'user impact assessment',
        'immediate remediation options',
        'risk of proposed fixes',
      ],
      out_of_scope: [
        'long-term architecture redesign',
        'vendor evaluation',
        'post-mortem process',
      ],
      time_horizon: '4h',
    },
  });

  // Run cycles with synthesis after each
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Cycle ${cycle}/${CYCLES}`);
    console.log(`${'═'.repeat(50)}`);

    try {
      const result = await institution.runCycle();
      const agents = Object.entries(result.agents).map(([id, r]) => `${id}:${r}`).join(', ');
      console.log(`  Agents: ${agents}`);
      console.log(`  Interventions: ${result.interventions_submitted}, Obligations: ${result.obligations_created}`);
      if (result.errors.length > 0) {
        for (const e of result.errors) console.log(`  Error [${e.agent_id}]: ${e.error}`);
      }
    } catch (e) {
      console.log(`  Cycle error: ${e.message}`);
      continue;
    }

    // Show new interventions from this cycle
    const allInts = institution.listInterventions(proc.id);
    const cycleInts = allInts.slice(-10); // last few
    for (const int of cycleInts) {
      const targetInfo = int.targets?.length > 0 ? ` → targets: ${int.targets.length}` : '';
      console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}${targetInfo}`);
    }

    // Evolving synthesis after each cycle
    const prevSyn = institution.getSynthesis(proc.id);
    const allInterventions = institution.listInterventions(proc.id);
    const interpretations = allInterventions.filter(i => i.type === 'interpret');
    const challenges = allInterventions.filter(i => i.type === 'challenge');
    const evidence = allInterventions.filter(i => i.type === 'introduce_evidence');

    const points = allInterventions.map(i => `[${i.agent_id}] ${i.type}: ${i.summary}`);
    const uncertainties = challenges.length > 0
      ? challenges.map(c => c.summary)
      : ['No challenges yet — initial hypotheses untested'];

    institution.updateSynthesis({
      proceeding_id: proc.id,
      updated_by: 'incident-commander',
      state_basis: cycle < CYCLES ? 'provisional' : 'stable',
      primary_reading: cycle === 1
        ? `Initial assessment: ${allInterventions.length} intervention(s) filed. Investigation underway.`
        : `Cycle ${cycle}: ${interpretations.length} hypotheses, ${challenges.length} challenges, ${evidence.length} evidence items. ${prevSyn ? 'Synthesis evolving.' : 'First synthesis.'}`,
      supporting_points: points.slice(-6),
      uncertainties: uncertainties.slice(0, 3),
      preserved_dissent: challenges.length > 0
        ? [{ label: challenges[0].summary.slice(0, 80), summary: challenges[0].content.slice(0, 200) }]
        : [],
    });

    const syn = institution.getSynthesis(proc.id);
    console.log(`  Synthesis v${syn.version}: ${syn.primary_reading.slice(0, 100)}`);
  }

  // ─── Final Output ───

  console.log(`\n${'═'.repeat(50)}`);
  console.log('  FINAL STATE');
  console.log(`${'═'.repeat(50)}`);

  // All interventions
  const allInts = institution.listInterventions(proc.id);
  console.log(`\n--- All Interventions (${allInts.length}) ---`);
  for (const int of allInts) {
    const targetInfo = int.targets?.length > 0 ? ` [responds to ${int.targets.length} prior]` : '';
    console.log(`\n  [${int.agent_id}] ${int.type}${targetInfo}:`);
    console.log(`  ${int.summary}`);
    console.log(`  ${int.content.slice(0, 250)}${int.content.length > 250 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  // Final synthesis
  const finalSyn = institution.getSynthesis(proc.id);
  console.log(`\n--- Final Synthesis (v${finalSyn.version}) ---`);
  console.log(`Reading: ${finalSyn.primary_reading}`);
  console.log(`Supporting: ${finalSyn.supporting_points.length} points`);
  console.log(`Uncertainties: ${finalSyn.uncertainties.length}`);
  console.log(`Dissent: ${finalSyn.preserved_dissent.length}`);

  // Health
  const health = institution.getHealth();
  console.log(`\n--- Health: ${health.discourse_health} (ratio: ${health.discourse_ratio}) ---`);

  // Stats
  const types = {};
  for (const i of allInts) types[i.type] = (types[i.type] || 0) + 1;
  console.log(`Types: ${JSON.stringify(types)}`);
  console.log(`Synthesis versions: ${finalSyn.version}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  process.exit(1);
});
