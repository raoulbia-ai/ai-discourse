#!/usr/bin/env node
'use strict';

/**
 * ICU Architecture — Condition C: Full Deliberation
 * 4 agents, 4 cycles. Full ai-discourse institutional chain.
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
const CYCLES      = 4;
const OUTPUT_FILE = path.join(__dirname, 'condition-c-output.json');

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'icu-c-')));
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
    in_scope: ['architecture selection', 'failure mode analysis', 'operational risk', 'clinical safety', 'regulatory requirements'],
    out_of_scope: ['vendor selection', 'budget estimation'],
  },
});

// ─── Agents ───

const architect = createLLMAgent({
  id: 'architect', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.3,
  systemPrompt: `You are a senior systems architect with healthcare IT experience.

Your role: PRIMARY ARCHITECT. Recommend an architecture and justify it. Identify failure modes of your recommendation. Be prepared to revise when challenged.

PROBLEM:
${PROBLEM.context}

REQUIREMENTS:
${PROBLEM.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

QUESTION: ${PROBLEM.question}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

RULES:
- Use "interpret" for your recommendation (requires "grounds")
- Use "revision" to update when challenged (requires "targets" and "grounds")
- Use "introduce_evidence" for technical findings (requires "grounds")
- Be specific about failure modes. "Kafka is highly available" is not acceptable. "Kafka with replication factor 3 survives single broker failure, but if two brokers fail simultaneously, unacknowledged messages in the ISR may be lost" is acceptable.

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const safetyEngineer = createLLMAgent({
  id: 'safety-engineer', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.5,
  systemPrompt: `You are a clinical safety engineer and designated Devil's Advocate.

Your role: CHALLENGER. You attack the recommended architecture's safety assumptions. You do NOT accept that either architecture is "better for real-time" without examining its failure modes under clinical conditions.

Key questions you MUST press on:
- What happens when the recommended architecture fails at 3am with one junior IT person on call?
- Which failure mode is more dangerous: silent data loss (alarm never generated) or delayed alarm (alarm generated late)?
- What happens when 50 beds alarm simultaneously?
- How does each architecture handle alarm fatigue?
- What are the regulatory audit implications?

PROBLEM:
${PROBLEM.context}

REQUIREMENTS:
${PROBLEM.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

RULES:
- Use "challenge" to attack assumptions (ALWAYS include "targets" and "grounds")
- Use "introduce_evidence" for safety-specific findings (requires "grounds")
- You MUST challenge at least one claim per cycle
- Name the specific 3am failure scenario for the recommended architecture

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const opsRealist = createLLMAgent({
  id: 'ops-realist', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.4,
  systemPrompt: `You are an IT operations lead at a hospital with a 4-person team.

Your role: OPERATIONS REALIST. You surface the operational reality that architectural diagrams ignore. Your team maintains this system 24/7. None of you are Kafka specialists. You challenge recommendations that assume operational capabilities your team does not have.

Key concerns:
- Operational complexity and who maintains it at 3am
- What happens when device firmware updates change data formats
- Schema evolution and backward compatibility
- Regulatory audit burden (FDA/CE medical device requirements)
- Your team's ability to diagnose and recover from failures
- The difference between what works in a demo and what works in production for 5 years

PROBLEM:
${PROBLEM.context}

REQUIREMENTS:
${PROBLEM.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

RULES:
- Use "introduce_evidence" for operational reality (requires "grounds")
- Use "challenge" to push back on operationally unrealistic recommendations (requires "targets" and "grounds")
- Use "interpret" for your operational assessment (requires "grounds")
- Be specific: "Kafka requires operational expertise" is not acceptable. "At 3am when consumer lag exceeds 30 seconds, my team needs to identify which consumer group is behind, check whether the issue is partition reassignment or slow processing, and decide whether to reset offsets — none of which they have trained for" is acceptable.

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const synthesizer = createLLMAgent({
  id: 'synthesizer', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.2,
  systemPrompt: `You are the institutional recorder for this architectural decision.

Produce a structured synthesis after each cycle covering:
1. CURRENT RECOMMENDATION and its justification
2. IDENTIFIED RISKS of the recommended architecture (with specific mechanisms)
3. CONTESTED CLAIMS — where agents disagree and why
4. CONDITIONS UNDER WHICH THE OTHER ARCHITECTURE WINS
5. AMBIGUITIES IN THE PROBLEM that affect the recommendation
6. OPEN QUESTIONS the decision-makers should resolve before committing

You do NOT recommend. You record what the deliberation has established.

PROBLEM:
${PROBLEM.context}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "synthesize", "summary": "...", "content": "...", "confidence": 0.0-1.0 }], "obligations": [] }`,
});

institution.registerAgent(architect);
institution.registerAgent(safetyEngineer);
institution.registerAgent(opsRealist);
institution.registerAgent(synthesizer);

async function main() {
  console.log('\n=== ICU Architecture — Condition C: Full Deliberation ===');
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}\n`);

  console.log('--- Agents ---');
  console.log('  architect       : Systems architect — recommends and defends');
  console.log('  safety-engineer : Clinical safety — challenges safety assumptions');
  console.log('  ops-realist     : Hospital IT ops — surfaces operational reality');
  console.log('  synthesizer     : Institutional recorder — versioned synthesis');
  console.log('');

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Cycle ${cycle}/${CYCLES}`);
    console.log(`${'═'.repeat(50)}`);

    try {
      const result = await institution.runCycle();
      const agents = Object.entries(result.agents).map(([id, r]) => `${id}:${r}`).join(', ');
      console.log(`  Agents: ${agents}`);
      console.log(`  Interventions: ${result.interventions_submitted}`);
      if (result.errors.length > 0) {
        for (const e of result.errors) console.log(`  Error [${e.agent_id}]: ${e.error}`);
      }
    } catch (e) {
      console.log(`  Cycle error: ${e.message}`);
      continue;
    }

    const allInts = institution.listInterventions(proc.id);
    const recent = allInts.slice(-10);
    for (const int of recent) {
      const t = int.targets?.length > 0 ? ` → targets: ${int.targets.length}` : '';
      console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}${t}`);
    }

    // Synthesizer-driven synthesis
    const synthInts = allInts.filter(i => i.type === 'synthesize');
    const latestSynth = synthInts[synthInts.length - 1];
    const challenges = allInts.filter(i => i.type === 'challenge');

    if (latestSynth) {
      institution.updateSynthesis({
        proceeding_id: proc.id, updated_by: 'synthesizer',
        state_basis: cycle < CYCLES ? 'provisional' : 'stable',
        primary_reading: latestSynth.summary,
        supporting_points: latestSynth.content.split('\n').filter(l => l.trim()).slice(0, 8),
        uncertainties: challenges.slice(-3).map(c => c.summary),
        preserved_dissent: challenges.slice(-2).map(c => ({ label: c.summary.slice(0, 80), summary: c.content.slice(0, 250) })),
      });
    } else {
      institution.updateSynthesis({
        proceeding_id: proc.id, updated_by: 'fallback',
        state_basis: cycle < CYCLES ? 'provisional' : 'stable',
        primary_reading: `Cycle ${cycle}: synthesizer produced no reading.`,
        supporting_points: [], uncertainties: [], preserved_dissent: [],
      });
    }

    const syn = institution.getSynthesis(proc.id);
    console.log(`\n  Synthesis v${syn.version}: ${syn.primary_reading.slice(0, 150)}`);
  }

  // ─── Final output ───

  const allInts = institution.listInterventions(proc.id);
  const charCount = allInts.reduce((sum, i) => sum + (i.summary || '').length + (i.content || '').length, 0);
  const challenges = allInts.filter(i => i.type === 'challenge');
  const revisions = allInts.filter(i => i.type === 'revision');
  const finalSyn = institution.getSynthesis(proc.id);
  const health = institution.getHealth();

  console.log(`\n${'═'.repeat(50)}`);
  console.log('  FINAL STATE');
  console.log(`${'═'.repeat(50)}`);
  console.log(`\nInterventions: ${allInts.length}`);
  console.log(`Total characters: ${charCount}`);
  console.log(`Challenges: ${challenges.length}`);
  console.log(`Revisions: ${revisions.length}`);
  console.log(`Discourse health: ${health.discourse_health} (${health.discourse_ratio})`);
  console.log(`Synthesis versions: ${finalSyn.version}`);

  const types = {};
  for (const i of allInts) types[i.type] = (types[i.type] || 0) + 1;
  console.log(`Types: ${JSON.stringify(types)}`);

  console.log(`\n--- All Interventions ---`);
  for (const int of allInts) {
    const t = int.targets?.length > 0 ? ` [responds to ${int.targets.length}]` : '';
    console.log(`\n  [${int.agent_id}] ${int.type}${t}:`);
    console.log(`  ${int.summary}`);
    console.log(`  ${int.content.slice(0, 400)}${int.content.length > 400 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  // Save output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    condition: 'C', mode: 'deliberation', model: MODEL,
    agents: 4, cycles: CYCLES, timestamp: new Date().toISOString(),
    interventions: allInts, final_synthesis: finalSyn,
    metrics: {
      intervention_count: allInts.length, total_chars: charCount,
      challenges: challenges.length, revisions: revisions.length,
      discourse_health: health.discourse_ratio,
    },
  }, null, 2));
  console.log(`\nSaved: ${OUTPUT_FILE}`);
}

main().catch(e => {
  console.error(`Failed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) console.error('Start ericaiproxy.');
  process.exit(1);
});
