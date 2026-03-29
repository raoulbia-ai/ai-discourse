#!/usr/bin/env node
'use strict';

/**
 * ICU Architecture — Condition A: Single Agent
 * 1 agent, 1 cycle. Baseline architectural recommendation.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../../index');
const { createLLMAgent } = require('../../adapters');
const { PROBLEM } = require('./problem');

const BASE_URL    = process.env.BASE_URL || 'http://127.0.0.1:7999';
const MODEL       = process.env.MODEL    || 'MiniMaxAI/MiniMax-M2.5';
const API_KEY     = process.env.API_KEY  || undefined;
const OUTPUT_FILE = path.join(__dirname, 'condition-a-output.json');

const store       = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'icu-a-')));
const institution = createInstitution({ store });

institution.ingestSignal({
  type: 'architectural_decision', source: 'hospital-it',
  timestamp: new Date().toISOString(),
  title: PROBLEM.title, summary: PROBLEM.context.slice(0, 300),
  tags: ['architecture', 'icu', 'patient-monitoring'],
});

const proc = institution.openProceeding({
  title: PROBLEM.title,
  framing: {
    primary_question: PROBLEM.question,
    posture: 'architectural_decision',
    in_scope: ['architecture selection', 'failure mode analysis', 'operational risk', 'clinical safety implications'],
    out_of_scope: ['vendor selection', 'budget estimation', 'staffing plan'],
  },
});

const agent = createLLMAgent({
  id: 'architect',
  baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.3,
  systemPrompt: `You are a senior systems architect with experience in healthcare IT, distributed systems, and clinical safety requirements.

You are advising on an architectural decision for a real-time ICU patient monitoring system.

PROBLEM:
${PROBLEM.context}

REQUIREMENTS:
${PROBLEM.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

QUESTION:
${PROBLEM.question}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

Produce a thorough architectural recommendation. For your recommended architecture, explicitly identify its failure modes and what happens when it fails. Address the question of when the OTHER architecture would be better.

Submit a SINGLE "interpret" intervention.

Output ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "interpret", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["requirements", "architectural_principles"] }, "confidence": 0.0-1.0 }], "obligations": [] }`,
});

institution.registerAgent(agent);

async function main() {
  console.log('\n=== ICU Architecture — Condition A: Single Agent ===');
  console.log(`LLM: ${BASE_URL} / ${MODEL}\n`);

  await institution.runCycle();
  const allInts = institution.listInterventions(proc.id);
  const charCount = allInts.reduce((sum, i) => sum + (i.summary || '').length + (i.content || '').length, 0);

  console.log(`Interventions: ${allInts.length}`);
  console.log(`Total characters: ${charCount}`);
  for (const int of allInts) {
    console.log(`\n[${int.agent_id}] ${int.type}: ${int.summary}`);
    console.log(int.content);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    condition: 'A', mode: 'single-agent', model: MODEL,
    agents: 1, cycles: 1, timestamp: new Date().toISOString(),
    interventions: allInts,
    metrics: { intervention_count: allInts.length, total_chars: charCount },
  }, null, 2));
  console.log(`\nSaved: ${OUTPUT_FILE}`);
}

main().catch(e => {
  console.error(`Failed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) console.error('Start ericaiproxy.');
  process.exit(1);
});
