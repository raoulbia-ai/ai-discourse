#!/usr/bin/env node
'use strict';

/**
 * Quickstart — the smallest possible AI Discourse Infrastructure example.
 *
 * Demonstrates the canonical first-use loop:
 *
 *   store → institution → registerAgent → openProceeding
 *     → runCycle → updateSynthesis → getSynthesis
 *
 * Synthesis is an explicit step because it represents the institution's
 * considered reading — not an automatic summary. In a real system, a
 * designated synthesizer agent would produce it. Here we do it manually
 * to show the complete loop.
 *
 * Usage: node examples/quickstart.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');

// 1. Create store and institution
const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'quickstart-')));
const institution = createInstitution({ store });

// 2. Register a deterministic agent
institution.registerAgent({
  id: 'analyst',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'analyst'
      );
      if (mine.length > 0) continue;

      interventions.push({
        proceeding_id: proc.id,
        type: 'interpret',
        summary: 'Initial assessment of the matter',
        content: 'Based on the available signals, this proceeding warrants further examination.',
        grounds: { evidence_refs: ['initial_review'] },
        confidence: 0.7,
      });
    }
    return { interventions, obligations: [] };
  },
});

// 3. Open a proceeding
async function main() {
  const proc = institution.openProceeding({
    title: 'Sample Inquiry',
    framing: { primary_question: 'What should the institution examine?' },
  });

  // 4. Run a deliberation cycle (agents evaluate and submit interventions)
  const result = await institution.runCycle();

  // 5. Produce synthesis (explicit — synthesis is a deliberate institutional act)
  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'system',
    primary_reading: 'The analyst identified this as worthy of examination.',
    supporting_points: ['Initial review completed with 0.7 confidence'],
    uncertainties: ['No challenges yet — single-agent assessment'],
  });

  // 6. Read the synthesis
  const synthesis = institution.getSynthesis(proc.id);

  console.log('=== AI Discourse Infrastructure — Quickstart ===');
  console.log(`Proceeding: ${proc.title}`);
  console.log(`Cycle: ${result.cycle_id} | Agents: ${Object.keys(result.agents).length} | Interventions: ${result.interventions_submitted}`);
  console.log(`Synthesis (v${synthesis.version}): ${synthesis.primary_reading}`);
  console.log('\nCanonical loop: store → institution → registerAgent → openProceeding → runCycle → updateSynthesis → getSynthesis');
}

main().catch(console.error);
