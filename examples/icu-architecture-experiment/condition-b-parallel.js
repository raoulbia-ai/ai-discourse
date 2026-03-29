#!/usr/bin/env node
'use strict';

/**
 * ICU Architecture — Condition B: Three Independent Agents
 * Same role prompts as C, but each runs isolated. No interaction.
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
const OUTPUT_FILE = path.join(__dirname, 'condition-b-output.json');

const AGENT_CONFIGS = [
  {
    id: 'architect',
    temperature: 0.3,
    prompt: `You are a senior systems architect. Recommend an architecture for the ICU monitoring system. Identify failure modes of your recommendation and when the alternative would be better.`,
  },
  {
    id: 'safety-engineer',
    temperature: 0.5,
    prompt: `You are a clinical safety engineer. Analyse both architectures from a patient safety perspective. What are the failure modes that could harm patients? What happens when each architecture fails at 3am? Which failure mode is more dangerous — silent data loss or delayed alarm? Do not accept "Kafka is better for real-time" as sufficient — press on what happens when Kafka fails.`,
  },
  {
    id: 'ops-realist',
    temperature: 0.4,
    prompt: `You are an IT operations lead at a hospital. Analyse both architectures from an operational reality perspective. Your team is 4 people, none are Kafka specialists. Consider: who maintains this at 3am? What happens when a device firmware update changes data format? What is the regulatory audit burden of each approach? Be specific about what your team can and cannot operate.`,
  },
];

async function main() {
  console.log('\n=== ICU Architecture — Condition B: Three Independent Agents ===');
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log('Mode: 3 agents, each isolated\n');

  const allInterventions = [];

  for (const config of AGENT_CONFIGS) {
    console.log(`--- Running ${config.id} (isolated) ---`);

    const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), `icu-b-${config.id}-`)));
    const inst = createInstitution({ store });

    inst.ingestSignal({
      type: 'architectural_decision', source: 'hospital-it',
      timestamp: new Date().toISOString(),
      title: PROBLEM.title, summary: PROBLEM.context.slice(0, 300),
      tags: ['architecture', 'icu'],
    });

    const proc = inst.openProceeding({
      title: PROBLEM.title,
      framing: {
        primary_question: PROBLEM.question,
        posture: 'architectural_decision',
        in_scope: ['architecture selection', 'failure modes', 'operational risk', 'clinical safety'],
        out_of_scope: ['vendor selection', 'budget'],
      },
    });

    const agent = createLLMAgent({
      id: config.id,
      baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY,
      temperature: config.temperature,
      systemPrompt: `${config.prompt}

PROBLEM:
${PROBLEM.context}

REQUIREMENTS:
${PROBLEM.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

QUESTION:
${PROBLEM.question}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

Submit a SINGLE "interpret" intervention.

Output ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "interpret", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["requirements", "operational_experience"] }, "confidence": 0.0-1.0 }], "obligations": [] }`,
    });

    inst.registerAgent(agent);

    try {
      await inst.runCycle();
      const ints = inst.listInterventions(proc.id);
      for (const int of ints) {
        allInterventions.push({ ...int, condition_agent: config.id });
        console.log(`  [${config.id}] ${int.type}: ${int.summary.slice(0, 100)}`);
      }
      if (ints.length === 0) console.log(`  [${config.id}] No interventions`);
    } catch (e) {
      console.log(`  [${config.id}] Error: ${e.message}`);
    }
    console.log('');
  }

  const charCount = allInterventions.reduce((sum, i) => sum + (i.summary || '').length + (i.content || '').length, 0);
  console.log(`Total interventions: ${allInterventions.length}`);
  console.log(`Total characters: ${charCount}`);

  for (const int of allInterventions) {
    console.log(`\n[${int.condition_agent}] ${int.type}: ${int.summary}`);
    console.log(int.content);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    condition: 'B', mode: 'parallel-independent', model: MODEL,
    agents: 3, cycles: 1, timestamp: new Date().toISOString(),
    interventions: allInterventions,
    metrics: { intervention_count: allInterventions.length, total_chars: charCount },
  }, null, 2));
  console.log(`\nSaved: ${OUTPUT_FILE}`);
}

main().catch(e => {
  console.error(`Failed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) console.error('Start ericaiproxy.');
  process.exit(1);
});
