#!/usr/bin/env node
'use strict';

/**
 * LLM-Powered Research Note — same scenario as research-note.js,
 * but agents are backed by a real LLM via the OpenAI-compatible adapter.
 *
 * Demonstrates:
 *   - createLLMAgent() with custom system prompts
 *   - LLM-generated interventions flowing through the institutional machinery
 *   - The same public API as deterministic examples
 *
 * Requirements:
 *   - An OpenAI-compatible API running (vLLM, Ollama, OpenAI, etc.)
 *   - Default: http://127.0.0.1:8000/v1 with model "local-vllm"
 *
 * Usage:
 *   node examples/llm-research-note.js
 *   BASE_URL=http://127.0.0.1:11434/v1 MODEL=qwen3.5:122b-a10b node examples/llm-research-note.js
 *   BASE_URL=https://api.openai.com/v1 MODEL=gpt-4o API_KEY=sk-... node examples/llm-research-note.js
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

console.log(`LLM: ${BASE_URL} / ${MODEL}\n`);

// ─── Setup ───

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'llm-research-')));
const institution = createInstitution({ store });

// ─── Create LLM-Powered Agents ───

const methodologist = createLLMAgent({
  id: 'methodologist',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "methodologist", a research methods expert participating in institutional deliberation.

You evaluate study designs, statistical approaches, and evidence quality.
You are skeptical of claims that lack methodological rigor.
You focus on: sample sizes, control conditions, measurement validity, confounders.

When another agent makes a claim about study results, challenge it if the methodology is weak.

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" for methodological observations
- Use "challenge" when disputing another agent's interpretation (requires "targets" array with the ID of the intervention you're challenging)
- Use "interpret" for your own analysis
- Include "grounds" with evidence_refs for all interpret/challenge types
- Only contribute if you have something substantive to add

OUTPUT FORMAT:
Return ONLY a JSON object:
{
  "interventions": [
    {
      "proceeding_id": "...",
      "type": "interpret|challenge|introduce_evidence",
      "summary": "one-line summary",
      "content": "detailed reasoning",
      "grounds": { "evidence_refs": ["..."] },
      "targets": ["int_id..."],
      "confidence": 0.0-1.0
    }
  ],
  "obligations": []
}`,
});

const domainExpert = createLLMAgent({
  id: 'domain-expert',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.4,
  systemPrompt: `You are "domain-expert", a clinical psychology researcher participating in institutional deliberation.

You evaluate intervention studies in the context of the broader research landscape.
You know the prior literature and can judge whether findings align with or contradict the evidence base.
You value convergent evidence across multiple studies even when individual studies have limitations.

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "interpret" for domain-informed analysis
- Use "challenge" when you disagree with another agent (requires "targets" array)
- Use "introduce_evidence" for bringing in prior literature
- Include "grounds" with evidence_refs
- Only contribute if you have something substantive to add

OUTPUT FORMAT:
Return ONLY a JSON object:
{
  "interventions": [
    {
      "proceeding_id": "...",
      "type": "interpret|challenge|introduce_evidence",
      "summary": "one-line summary",
      "content": "detailed reasoning",
      "grounds": { "evidence_refs": ["..."] },
      "targets": ["int_id..."],
      "confidence": 0.0-1.0
    }
  ],
  "obligations": []
}`,
});

// ─── Register and Run ───

institution.registerAgent(methodologist);
institution.registerAgent(domainExpert);

async function main() {
  console.log('=== LLM Research Note ===\n');

  // Ingest signals
  institution.ingestSignal({
    type: 'publication',
    source: 'pubmed',
    timestamp: new Date().toISOString(),
    title: 'Paper A: Novel CBT variant shows 42% improvement (waitlist-controlled, N=120, PHQ-9)',
    summary: 'RCT with waitlist control. 42% improvement on PHQ-9 self-report scale. No active control condition.',
    tags: ['rct', 'mental_health', 'cbt'],
  });

  institution.ingestSignal({
    type: 'publication',
    source: 'pubmed',
    timestamp: new Date().toISOString(),
    title: 'Paper B: Standard CBT protocol shows 23% improvement (active-controlled, N=85, HDRS-17)',
    summary: 'RCT with treatment-as-usual active control. 23% improvement on clinician-rated HDRS-17. Uses shortened protocol.',
    tags: ['rct', 'mental_health', 'cbt', 'active_control'],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: 'Comparison: Novel vs. standard CBT for depression treatment efficacy',
    framing: {
      primary_question: 'Which paper provides stronger evidence for intervention efficacy, and can we compare their effect sizes?',
      posture: 'comparative_review',
      in_scope: ['study design quality', 'effect sizes', 'measurement validity', 'external validity'],
      out_of_scope: ['cost-effectiveness', 'implementation logistics', 'patient preference'],
    },
  });

  console.log(`Proceeding: ${proc.title}\n`);

  // Run cycles
  for (let i = 1; i <= 3; i++) {
    console.log(`--- Cycle ${i} ---`);
    try {
      const result = await institution.runCycle();
      const acted = Object.values(result.agents).filter(r => r === 'acted').length;
      console.log(`  ${acted} agents acted, ${result.interventions_submitted} interventions`);
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.log(`  Error [${e.agent_id}]: ${e.error}`);
        }
      }
    } catch (e) {
      console.log(`  Cycle error: ${e.message}`);
    }
    console.log('');
  }

  // Review discourse
  const interventions = institution.listInterventions(proc.id);
  console.log(`\n--- Discourse (${interventions.length} interventions) ---`);
  for (const int of interventions) {
    console.log(`\n  [${int.agent_id}] ${int.type}:`);
    console.log(`  Summary: ${int.summary}`);
    console.log(`  ${int.content.slice(0, 300)}${int.content.length > 300 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  // Synthesize (still explicit — synthesis is a deliberate act)
  if (interventions.length > 0) {
    const points = interventions.map(i => `[${i.agent_id}] ${i.summary}`);
    institution.updateSynthesis({
      proceeding_id: proc.id,
      updated_by: 'system',
      primary_reading: `${interventions.length} interventions from LLM-powered agents examined the comparative efficacy question.`,
      supporting_points: points,
      uncertainties: ['LLM-generated reasoning requires human review for accuracy'],
    });

    const syn = institution.getSynthesis(proc.id);
    console.log(`\n--- Synthesis (v${syn.version}) ---`);
    console.log(syn.primary_reading);
  }

  // Health
  const health = institution.getHealth();
  console.log(`\n--- Health: ${health.discourse_health} (ratio: ${health.discourse_ratio}) ---`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`\nNo LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  process.exit(1);
});
