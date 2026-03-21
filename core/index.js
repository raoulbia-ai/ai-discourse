'use strict';

const { ProceedingEngine } = require('./proceedings/proceedings-engine');
const { InterventionEngine } = require('./interventions/intervention-engine');
const { ObligationEngine } = require('./obligations/obligation-engine');
const { SynthesisEngine } = require('./synthesis/synthesis-engine');
const { GovernanceEngine } = require('./governance/governance-engine');
const { MemoryEngine } = require('./memory/memory-engine');
const { AgendaEngine } = require('./agenda/agenda-engine');
const { validate, assertValid } = require('./validate');

/**
 * Create all engines wired to a single store.
 * @param {import('../storage/file-store')} store
 * @returns {{ proceedings: ProceedingEngine, interventions: InterventionEngine, obligations: ObligationEngine, synthesis: SynthesisEngine, governance: GovernanceEngine, memory: MemoryEngine, agenda: AgendaEngine }}
 */
function createInstitution(store) {
  return {
    proceedings: new ProceedingEngine(store),
    interventions: new InterventionEngine(store),
    obligations: new ObligationEngine(store),
    synthesis: new SynthesisEngine(store),
    governance: new GovernanceEngine(store),
    memory: new MemoryEngine(store),
    agenda: new AgendaEngine(store),
  };
}

module.exports = {
  createInstitution,
  ProceedingEngine,
  InterventionEngine,
  ObligationEngine,
  SynthesisEngine,
  GovernanceEngine,
  MemoryEngine,
  AgendaEngine,
  validate,
  assertValid,
};
