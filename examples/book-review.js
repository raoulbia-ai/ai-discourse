#!/usr/bin/env node
'use strict';

/**
 * Tiny non-WorldLens example: Book Review Deliberation
 *
 * Three agents with different lenses review the same book signal
 * and deliberate through the institutional machinery.
 *
 * Uses ONLY the public API surface — no engine internals.
 *
 * Usage: node infra/examples/book-review.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');

// ─── Setup ───

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-review-'));
const store = createStore(dataDir);
const institution = createInstitution({ store });

// ─── Define Agents ───

// Literary critic — focuses on craft and structure
const critic = {
  id: 'literary-critic',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const existing = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'literary-critic'
      );
      if (existing.length > 0) continue;

      interventions.push({
        proceeding_id: proc.id,
        type: 'interpret',
        summary: 'The narrative structure uses unreliable narration effectively',
        content: 'The fragmented timeline serves the thematic concern with memory and identity. The prose style shifts between chapters mirror the protagonist\'s psychological state.',
        grounds: { evidence_refs: ['chapters_3_7_12'] },
        confidence: 0.8,
      });
    }
    return { interventions, obligations: [] };
  },
};

// Social historian — focuses on context and representation
const historian = {
  id: 'social-historian',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      // Check if critic already posted — then challenge
      const criticPosts = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'literary-critic'
      );
      const myChallenges = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'social-historian' && i.type === 'challenge'
      );
      if (myChallenges.length > 0) continue;

      if (criticPosts.length > 0) {
        interventions.push({
          proceeding_id: proc.id,
          type: 'challenge',
          summary: 'Craft analysis misses the socioeconomic context that shapes the narrative',
          content: 'The "fragmented timeline" is not merely a stylistic choice — it reflects the displacement experience of the immigrant community depicted. Reading it as pure craft obscures the political dimension.',
          targets: [criticPosts[0].id],
          grounds: { evidence_refs: ['historical_context_1970s_migration'] },
          confidence: 0.7,
        });
      } else {
        interventions.push({
          proceeding_id: proc.id,
          type: 'introduce_evidence',
          summary: 'Historical context for the depicted community',
          content: 'The novel is set against the 1970s migration wave. Understanding this context is essential for interpreting the characters\' choices.',
          grounds: { evidence_refs: ['census_data_1975', 'migration_policy_archive'] },
        });
      }
    }
    return { interventions, obligations: [] };
  },
};

// Reader advocate — focuses on accessibility and impact
const reader = {
  id: 'reader-advocate',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const myPosts = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'reader-advocate'
      );
      if (myPosts.length > 0) continue;

      // Check for ongoing debate
      const allPosts = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id
      );

      if (allPosts.length >= 2) {
        interventions.push({
          proceeding_id: proc.id,
          type: 'interpret',
          summary: 'Both craft and context matter, but accessibility determines reach',
          content: 'The critic and historian are both right, but neither addresses whether a general reader can access these layers. The novel\'s difficulty may limit the very audience that needs to hear its message.',
          grounds: { evidence_refs: ['readership_surveys_2024'] },
          confidence: 0.6,
        });
      }
    }
    return { interventions, obligations: [] };
  },
};

// ─── Register Agents ───

institution.registerAgent(critic);
institution.registerAgent(historian);
institution.registerAgent(reader);

// ─── Run Deliberation ───

async function main() {
  console.log('=== Book Review Deliberation ===\n');

  // Ingest a signal
  const signal = institution.ingestSignal({
    type: 'publication',
    source: 'publisher_catalog',
    timestamp: new Date().toISOString(),
    title: 'New novel: "The Displaced" by Maria Vasquez',
    summary: 'Debut novel exploring immigration, memory, and identity through fragmented narrative.',
    tags: ['fiction', 'immigration', 'debut'],
  });
  console.log(`Signal ingested: ${signal.title}`);

  // Open a proceeding
  const proc = institution.openProceeding({
    title: 'Review: "The Displaced" by Maria Vasquez',
    framing: {
      primary_question: 'What is the literary and social significance of this novel?',
      posture: 'critical_review',
      in_scope: ['narrative craft', 'social context', 'reader accessibility'],
      out_of_scope: ['author biography', 'sales projections'],
    },
    signal_ids: [signal.id],
  });
  console.log(`Proceeding opened: ${proc.title} (${proc.id})\n`);

  // Run three cycles — agents build on each other
  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`--- Cycle ${cycle} ---`);
    const result = await institution.runCycle();
    const acted = Object.values(result.agents).filter(r => r === 'acted').length;
    console.log(`  ${acted} agent(s) acted, ${result.interventions_submitted} intervention(s)\n`);
  }

  // Check the discourse — using only public API
  const interventions = institution.listInterventions(proc.id);
  console.log(`Total interventions: ${interventions.length}`);
  for (const int of interventions) {
    console.log(`  [${int.agent_id}] ${int.type}: ${int.summary}`);
  }

  // Produce a synthesis
  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'system',
    primary_reading: 'The novel succeeds as both literary craft and social document, though accessibility remains a concern.',
    supporting_points: [
      'Narrative fragmentation serves thematic purpose (literary-critic)',
      'Historical context is essential for full interpretation (social-historian)',
      'Accessibility gap may limit the novel\'s social impact (reader-advocate)',
    ],
    uncertainties: [
      'Whether difficulty is a barrier or a feature depends on intended audience',
    ],
    preserved_dissent: [{
      label: 'Craft-first reading',
      summary: 'The literary-critic argues the novel should be evaluated primarily as art, not sociology',
    }],
  });

  const synthesis = institution.getSynthesis(proc.id);
  console.log(`\n=== Synthesis (v${synthesis.version}) ===`);
  console.log(synthesis.primary_reading);
  console.log(`\nSupporting: ${synthesis.supporting_points.length} points`);
  console.log(`Uncertainties: ${synthesis.uncertainties.length}`);
  console.log(`Preserved dissent: ${synthesis.preserved_dissent.length}`);

  // Health check
  const health = institution.getHealth();
  console.log(`\n=== Discourse Health ===`);
  console.log(`Ratio: ${health.discourse_ratio} (${health.discourse_health})`);
  console.log(`Total discourse messages: ${health.total_discourse}`);

  console.log(`\nData dir: ${dataDir}`);
}

main().catch(console.error);
