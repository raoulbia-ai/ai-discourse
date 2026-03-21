#!/usr/bin/env node
'use strict';

/**
 * Research Note — 2 agents compare two papers on the same topic.
 *
 * Agents: methodologist (evaluates study design), domain expert
 * (evaluates claims against field knowledge). Produces interpret,
 * challenge, and synthesis with preserved dissent.
 *
 * Uses ONLY the public API surface.
 *
 * Usage: node examples/research-note.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'research-')));
const institution = createInstitution({ store });

// ─── Agents ───

const methodologist = {
  id: 'methodologist',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const myChallenges = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'methodologist' && i.type === 'challenge'
      );
      const myEvidence = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'methodologist' && i.type === 'introduce_evidence'
      );

      // Check if domain expert has posted — respond with challenge
      const expertPosts = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'domain-expert'
      );

      if (expertPosts.length > 0 && myChallenges.length === 0) {
        interventions.push({
          proceeding_id: proc.id,
          type: 'challenge',
          summary: 'Effect size claims cannot be compared — different measurement instruments',
          content: 'Paper A uses self-report scales (PHQ-9) while Paper B uses clinician-rated instruments (HDRS-17). The domain expert\'s conclusion that Paper A shows stronger effects conflates different measurement constructs. A valid comparison requires converting to a common metric (e.g., standardized mean difference) or acknowledging the measures are not directly comparable.',
          targets: [expertPosts[0].id],
          grounds: { evidence_refs: ['cochrane_handbook_ch10', 'cuijpers_2010_measurement'] },
          confidence: 0.8,
        });
      } else if (myEvidence.length === 0) {
        interventions.push({
          proceeding_id: proc.id,
          type: 'introduce_evidence',
          summary: 'Paper A has significant methodological limitations — no active control',
          content: 'Paper A reports a 42% improvement rate but uses waitlist control only. Without an active control (e.g., treatment-as-usual), the effect cannot be distinguished from placebo, regression to mean, or natural recovery. Paper B uses active control (standard treatment) and reports a smaller but more credible 23% improvement. The raw numbers favor Paper A, but the evidence quality favors Paper B.',
          grounds: { evidence_refs: ['paper_a_methods_s2.1', 'paper_b_methods_s2.3', 'jadad_scale_assessment'] },
        });
      }
    }
    return { interventions, obligations: [] };
  },
};

const domainExpert = {
  id: 'domain-expert',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'domain-expert'
      );
      if (mine.length > 0) continue;

      interventions.push({
        proceeding_id: proc.id,
        type: 'interpret',
        summary: 'Paper A aligns with emerging consensus — intervention shows promise despite design limitations',
        content: 'Paper A\'s 42% improvement rate, while from a waitlist-controlled study, is consistent with three prior pilot studies (Chen 2023, Nakamura 2024, Osei 2024) that used different designs and populations. The convergent evidence across studies strengthens the case even though each individual study has limitations. Paper B\'s active-controlled 23% improvement is solid but the intervention differs meaningfully — it uses a shortened protocol that omits the component most studies identify as the active ingredient.',
        grounds: { evidence_refs: ['chen_2023_pilot', 'nakamura_2024_rct', 'osei_2024_cohort', 'paper_b_protocol_appendix'] },
        confidence: 0.65,
      });
    }
    return { interventions, obligations: [] };
  },
};

// ─── Register and Run ───

institution.registerAgent(methodologist);
institution.registerAgent(domainExpert);

async function main() {
  console.log('=== Research Note ===\n');

  // Signals: two papers
  institution.ingestSignal({
    type: 'publication',
    source: 'pubmed',
    timestamp: new Date().toISOString(),
    title: 'Paper A: Novel intervention shows 42% improvement (waitlist-controlled)',
    summary: 'RCT with waitlist control, N=120, 42% improvement on PHQ-9.',
    tags: ['rct', 'mental_health', 'intervention'],
  });

  institution.ingestSignal({
    type: 'publication',
    source: 'pubmed',
    timestamp: new Date().toISOString(),
    title: 'Paper B: Standard protocol shows 23% improvement (active-controlled)',
    summary: 'RCT with active control, N=85, 23% improvement on HDRS-17.',
    tags: ['rct', 'mental_health', 'active_control'],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: 'Comparison: Novel vs. standard intervention for treatment efficacy',
    framing: {
      primary_question: 'Which paper provides stronger evidence for intervention efficacy?',
      posture: 'comparative_review',
      in_scope: ['study design quality', 'effect sizes', 'external validity'],
      out_of_scope: ['cost-effectiveness', 'implementation logistics'],
    },
  });

  // Run cycles
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
    updated_by: 'review-chair',
    primary_reading: 'Neither paper alone is conclusive. Paper B has stronger internal validity (active control) but Paper A\'s results converge with prior studies. Direct comparison of effect sizes is invalid due to different measurement instruments.',
    supporting_points: [
      'Paper A lacks active control — effect may include placebo (methodologist)',
      'Paper A converges with 3 independent prior studies (domain-expert)',
      'PHQ-9 vs HDRS-17 makes effect size comparison invalid (methodologist challenge)',
      'Paper B uses shortened protocol missing the hypothesized active ingredient (domain-expert)',
    ],
    uncertainties: [
      'Whether convergent evidence from weaker designs outweighs a single stronger design',
      'Whether the omitted protocol component in Paper B matters',
    ],
    preserved_dissent: [{
      label: 'Convergent evidence argument',
      summary: 'Domain expert argues that multiple converging studies across different designs provide stronger evidence than a single well-controlled study',
    }],
  });

  const syn = institution.getSynthesis(proc.id);
  console.log(`\n--- Synthesis (v${syn.version}) ---`);
  console.log(syn.primary_reading);
  console.log(`Supporting points: ${syn.supporting_points.length}`);
  console.log(`Uncertainties: ${syn.uncertainties.length}`);
  console.log(`Preserved dissent: ${syn.preserved_dissent.length}`);

  const health = institution.getHealth();
  console.log(`\n--- Health: ${health.discourse_health} (ratio: ${health.discourse_ratio}) ---`);
}

main().catch(console.error);
