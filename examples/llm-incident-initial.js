#!/usr/bin/env node
'use strict';

/**
 * Incident Investigation — Part 1: Initial diagnosis.
 *
 * This demo shows framework-level persistence. No CLI or application
 * logic is required — resuming is simply reusing the same proceeding
 * and store.
 *
 * Run this first, then run llm-incident-resume.js to see the system
 * continue the investigation with new evidence.
 *
 * Usage: node examples/llm-incident-initial.js
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

// Shared data dir — llm-incident-resume.js reuses this same path
const DATA_DIR = path.join(os.homedir(), '.ai-discourse-resume-demo');

// ─── Incident ───

const INCIDENT = {
  title: 'Checkout API returning 500 errors for 12% of users',
  symptoms: [
    'HTTP 500 on POST /api/checkout/confirm',
    'Only affects users with saved payment methods',
    'Error rate jumped at 09:08 UTC',
    'Payment provider rotated encryption key at 09:00 UTC',
  ],
};

// ─── Agents ───

const agents = [
  createLLMAgent({
    id: 'backend-eng',
    baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.3,
    systemPrompt: `You are "backend-eng", a backend engineer investigating a new production incident. Form your initial hypothesis based on the available evidence.

RULES:
- Use "interpret" for your hypothesis (requires "grounds")
- Use "challenge" to dispute another agent (requires "targets")
- Include "grounds" with evidence_refs

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
  }),
  createLLMAgent({
    id: 'qa-eng',
    baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.4,
    systemPrompt: `You are "qa-eng", a QA engineer who challenges assumptions during incident investigation.

RULES:
- Use "challenge" to question hypotheses (requires "targets")
- Use "introduce_evidence" to present findings (requires "grounds")
- You MUST challenge at least one hypothesis if you see weak evidence

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
  }),
];

// ─── Main ───

async function main() {
  // Clean start
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const store = createStore(DATA_DIR);
  const institution = createInstitution({ store });
  for (const agent of agents) institution.registerAgent(agent);

  console.log('═══════════════════════════════════════');
  console.log('  Part 1: Initial Investigation');
  console.log('═══════════════════════════════════════');
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log('');
  console.log('--- Incident ---');
  console.log(`  ${INCIDENT.title}`);
  for (const s of INCIDENT.symptoms) console.log(`  - ${s}`);
  console.log('');

  // Ingest and open proceeding
  institution.ingestSignal({
    type: 'incident', source: 'pagerduty',
    timestamp: new Date().toISOString(),
    title: INCIDENT.title,
    summary: INCIDENT.symptoms.join('. '),
    tags: ['incident', 'P1', 'checkout'],
  });

  const proc = institution.openProceeding({
    title: INCIDENT.title,
    framing: {
      primary_question: 'What is the root cause of the checkout 500 errors?',
      posture: 'incident_investigation',
      in_scope: ['root cause', 'blast radius', 'remediation'],
      out_of_scope: ['architecture redesign'],
    },
  });

  console.log(`Proceeding: ${proc.id}`);
  console.log('');

  // Run 2 cycles
  for (let i = 1; i <= 2; i++) {
    console.log(`--- Cycle ${i} ---`);
    const result = await institution.runCycle();
    console.log(`  Interventions: ${result.interventions_submitted}`);
  }

  // Show interventions
  const ints = institution.listInterventions(proc.id);
  console.log(`\n--- Interventions (${ints.length}) ---`);
  for (const int of ints) {
    console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}`);
  }

  // Synthesis v1
  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'incident-commander',
    primary_reading: 'Initial diagnosis: payment provider key rotation is the suspected cause. Investigation ongoing.',
    supporting_points: ints.map(i => `[${i.agent_id}] ${i.summary}`),
    uncertainties: ['Whether the key rotation alone explains the failure pattern'],
  });

  const syn = institution.getSynthesis(proc.id);
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  SYNTHESIS v${syn.version}`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(syn.primary_reading);

  console.log(`\n--- State saved to: ${DATA_DIR} ---`);
  console.log(`\nTo continue with new evidence, run:`);
  console.log(`  node examples/llm-incident-resume.js`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  process.exit(1);
});
