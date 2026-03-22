#!/usr/bin/env node
'use strict';

/**
 * LLM-Powered Research Note — two agents evaluate conflicting study evidence.
 *
 * Agents: methodologist (evaluates study design and statistical rigor),
 * domain expert (evaluates claims against prior literature).
 *
 * The studies have deliberately conflicting strengths — Paper A has a
 * larger effect size but weaker design, Paper B has stronger design but
 * used a different measurement instrument. This tension should produce
 * challenge interactions.
 *
 * Uses ONLY the public API surface.
 *
 * Usage:
 *   node examples/llm-research-note.js
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

// ─── Study Data (static — no external calls) ───

const STUDIES = {
  paper_a: {
    title: 'Kovacs et al. (2025) — Novel group-based CBT variant for moderate depression',
    design: 'Randomized controlled trial, waitlist control (no active comparator)',
    sample: 'N=120, single site, university clinic, recruited via flyers',
    population: '18-35 year olds, 68% female, 89% white, all with PHQ-9 >= 10',
    intervention: 'Modified 12-week group CBT with mindfulness component (3 sessions/week)',
    outcome_measure: 'PHQ-9 (self-report)',
    result: '42% mean improvement on PHQ-9 at 12 weeks (d=0.83)',
    attrition: '28% dropout, completers-only analysis (no ITT)',
    funding: 'Grant from the intervention developer\'s foundation',
    limitations_noted: 'Authors acknowledge lack of active control and single-site limitation',
    strengths_claimed: 'Large effect size, high session attendance (87% among completers)',
  },
  paper_b: {
    title: 'Rahman et al. (2025) — Standard individual CBT for moderate-to-severe depression',
    design: 'Randomized controlled trial, active control (treatment-as-usual: antidepressants + GP visits)',
    sample: 'N=85, three sites across two countries, referred by GPs',
    population: '25-60 year olds, 54% female, ethnically diverse, PHQ-9 >= 15 AND HDRS-17 >= 14',
    intervention: 'Standard 16-session individual CBT (1 session/week)',
    outcome_measure: 'HDRS-17 (clinician-rated, blinded assessors)',
    result: '23% mean improvement on HDRS-17 at 16 weeks (d=0.42)',
    attrition: '12% dropout, intention-to-treat analysis with multiple imputation',
    funding: 'Government health research council (no industry ties)',
    limitations_noted: 'Smaller sample, longer treatment duration may affect comparability',
    strengths_claimed: 'Active control, blinded assessment, ITT analysis, multi-site, diverse sample',
  },
};

// ─── Setup ───

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'llm-research-')));
const institution = createInstitution({ store });

// ─── Study data as text block for prompts ───

const STUDY_CONTEXT = `
PAPER A: ${STUDIES.paper_a.title}
  Design: ${STUDIES.paper_a.design}
  Sample: ${STUDIES.paper_a.sample}
  Population: ${STUDIES.paper_a.population}
  Intervention: ${STUDIES.paper_a.intervention}
  Outcome: ${STUDIES.paper_a.outcome_measure}
  Result: ${STUDIES.paper_a.result}
  Attrition: ${STUDIES.paper_a.attrition}
  Funding: ${STUDIES.paper_a.funding}
  Limitations noted: ${STUDIES.paper_a.limitations_noted}
  Strengths claimed: ${STUDIES.paper_a.strengths_claimed}

PAPER B: ${STUDIES.paper_b.title}
  Design: ${STUDIES.paper_b.design}
  Sample: ${STUDIES.paper_b.sample}
  Population: ${STUDIES.paper_b.population}
  Intervention: ${STUDIES.paper_b.intervention}
  Outcome: ${STUDIES.paper_b.outcome_measure}
  Result: ${STUDIES.paper_b.result}
  Attrition: ${STUDIES.paper_b.attrition}
  Funding: ${STUDIES.paper_b.funding}
  Limitations noted: ${STUDIES.paper_b.limitations_noted}
  Strengths claimed: ${STUDIES.paper_b.strengths_claimed}
`;

// ─── Agents ───

const methodologist = createLLMAgent({
  id: 'methodologist',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "methodologist", a research methods expert participating in institutional deliberation.

You evaluate study designs, statistical approaches, and evidence quality.
You are skeptical of claims that lack methodological rigor.
You focus on: control conditions, measurement validity, attrition bias, ITT vs completers analysis, funding conflicts, sample representativeness.

STUDY DATA:
${STUDY_CONTEXT}

KEY TENSIONS TO EVALUATE:
- Paper A has a larger effect size (d=0.83) but uses waitlist control — is this inflated by placebo and regression to mean?
- Paper A used completers-only analysis with 28% dropout — how does this bias the result?
- Paper A used self-report (PHQ-9) while Paper B used clinician-rated (HDRS-17) — can these effect sizes be compared directly?
- Paper A was funded by the intervention developer's foundation — conflict of interest?
- Paper B has a smaller effect size (d=0.42) but active control, ITT analysis, and blinded assessment — is this more trustworthy despite looking less impressive?

When another agent makes claims about these studies, challenge them if the methodology doesn't support the claim.

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" for methodological observations
- Use "challenge" when disputing another agent's interpretation (requires "targets" array with the ID of the intervention you're challenging)
- Use "interpret" for your own analysis
- Include "grounds" with evidence_refs for all interpret/challenge types
- Only contribute if you have something substantive to add
- Build on prior discourse — don't repeat what was already said

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

You evaluate intervention studies in the context of the broader CBT research literature.
You know the prior evidence base and can judge whether findings align with or contradict established results.
You value convergent evidence across multiple studies, even when individual studies have limitations.

STUDY DATA:
${STUDY_CONTEXT}

KEY CONTEXT FROM PRIOR LITERATURE:
- Meta-analyses of CBT for depression typically find effect sizes of d=0.5-0.7 vs active controls (Cuijpers et al., 2020)
- Group CBT formats generally show smaller effects than individual CBT (Huntley et al., 2012)
- The PHQ-9 and HDRS-17 often produce discrepant results — self-report measures tend to show larger treatment effects than clinician-rated instruments
- Waitlist-controlled trials consistently produce larger effect sizes than active-controlled trials (Mohr et al., 2014)
- Three prior pilot studies of Paper A's novel group CBT variant showed promising results (Chen 2023 N=30, Nakamura 2024 N=45, Osei 2024 N=38) — convergent evidence despite small samples
- Paper B's standard CBT protocol omits the behavioral activation component that most meta-analyses identify as the active ingredient

When the methodologist focuses purely on design quality, consider whether the broader evidence base changes the picture.

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "interpret" for domain-informed analysis
- Use "challenge" when you disagree with another agent (requires "targets" array)
- Use "introduce_evidence" for bringing in prior literature
- Include "grounds" with evidence_refs
- Only contribute if you have something substantive to add
- Build on prior discourse — don't repeat what was already said

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
  console.log('=== LLM Research Note ===');
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log('');
  console.log('--- Inputs ---');
  console.log(`  Paper A: ${STUDIES.paper_a.title}`);
  console.log(`    ${STUDIES.paper_a.result} | ${STUDIES.paper_a.design} | ${STUDIES.paper_a.outcome_measure}`);
  console.log(`    ${STUDIES.paper_a.attrition} | Funded by: ${STUDIES.paper_a.funding}`);
  console.log(`  Paper B: ${STUDIES.paper_b.title}`);
  console.log(`    ${STUDIES.paper_b.result} | ${STUDIES.paper_b.design} | ${STUDIES.paper_b.outcome_measure}`);
  console.log(`    ${STUDIES.paper_b.attrition} | Funded by: ${STUDIES.paper_b.funding}`);
  console.log('  Question: Which provides stronger evidence, and can their effect sizes be compared?');
  console.log('');
  console.log('--- Agents & Roles ---');
  console.log('  methodologist  : skeptic — evaluates design quality, statistical rigor, bias');
  console.log('  domain-expert  : contextualist — evaluates claims against prior CBT literature');
  console.log('');

  // Ingest signals
  institution.ingestSignal({
    type: 'publication',
    source: 'pubmed',
    timestamp: new Date().toISOString(),
    title: STUDIES.paper_a.title,
    summary: `${STUDIES.paper_a.design}. ${STUDIES.paper_a.result}. ${STUDIES.paper_a.attrition}.`,
    tags: ['rct', 'mental_health', 'cbt', 'waitlist_control'],
  });

  institution.ingestSignal({
    type: 'publication',
    source: 'pubmed',
    timestamp: new Date().toISOString(),
    title: STUDIES.paper_b.title,
    summary: `${STUDIES.paper_b.design}. ${STUDIES.paper_b.result}. ${STUDIES.paper_b.attrition}.`,
    tags: ['rct', 'mental_health', 'cbt', 'active_control'],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: 'Evidence comparison: Novel group CBT vs. standard individual CBT for depression',
    framing: {
      primary_question: 'Which paper provides stronger evidence for intervention efficacy, and can their effect sizes be directly compared?',
      posture: 'comparative_review',
      in_scope: ['study design quality', 'effect size interpretation', 'measurement validity', 'attrition bias', 'external validity', 'convergent evidence'],
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
    const targetInfo = int.targets?.length > 0 ? ` [responds to ${int.targets.length} prior]` : '';
    console.log(`\n  [${int.agent_id}] ${int.type}${targetInfo}:`);
    console.log(`  Summary: ${int.summary}`);
    console.log(`  ${int.content.slice(0, 300)}${int.content.length > 300 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  // Synthesize
  if (interventions.length > 0) {
    const challenges = interventions.filter(i => i.type === 'challenge');
    const points = interventions.map(i => `[${i.agent_id}] ${i.summary}`);
    institution.updateSynthesis({
      proceeding_id: proc.id,
      updated_by: 'system',
      primary_reading: `${interventions.length} interventions examined the comparative efficacy question across ${3} cycles.`,
      supporting_points: points,
      uncertainties: ['Whether effect sizes from different instruments (PHQ-9 vs HDRS-17) can be compared directly'],
      preserved_dissent: challenges.length > 0
        ? [{ label: challenges[0].summary.slice(0, 80), summary: challenges[0].content.slice(0, 200) }]
        : [],
    });

    const syn = institution.getSynthesis(proc.id);
    console.log(`\n--- Synthesis (v${syn.version}) ---`);
    console.log(syn.primary_reading);
    if (syn.preserved_dissent.length > 0) {
      console.log(`Preserved dissent: ${syn.preserved_dissent[0].label}`);
    }
  }

  // Health
  const health = institution.getHealth();
  console.log(`\n--- Health: ${health.discourse_health} (ratio: ${health.discourse_ratio}) ---`);

  // Type counts
  const types = {};
  for (const i of interventions) types[i.type] = (types[i.type] || 0) + 1;
  console.log(`Types: ${JSON.stringify(types)}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`\nNo LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  process.exit(1);
});
