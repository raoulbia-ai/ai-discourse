#!/usr/bin/env node
'use strict';

/**
 * Quickstart — the smallest possible AI Discourse Infrastructure example.
 *
 * Demonstrates the complete framework loop:
 *   store → institution → agent → proceeding → cycle → synthesis
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

// 2. Register one deterministic agent
institution.registerAgent({
  id: 'analyst',
  async evaluate(context) {
    const interventions = [];
    for (const proc of context.proceedings) {
      // Skip if already contributed
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

// 3. Open one proceeding and run one cycle
async function main() {
  const proc = institution.openProceeding({
    title: 'Sample Inquiry',
    framing: { primary_question: 'What should the institution examine?' },
  });

  const result = await institution.runCycle();

  // 4. Produce and print synthesis
  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'system',
    primary_reading: 'The analyst identified this as worthy of examination.',
    supporting_points: ['Initial review completed with 0.7 confidence'],
    uncertainties: ['No challenges yet — single-agent assessment'],
  });

  const synthesis = institution.getSynthesis(proc.id);

  console.log('=== AI Discourse Infrastructure — Quickstart ===');
  console.log(`Proceeding: ${proc.title}`);
  console.log(`Cycle: ${result.cycle_id} | Agents: ${Object.keys(result.agents).length} | Interventions: ${result.interventions_submitted}`);
  console.log(`Synthesis (v${synthesis.version}): ${synthesis.primary_reading}`);
  console.log('Done.');
}

main().catch(console.error);
