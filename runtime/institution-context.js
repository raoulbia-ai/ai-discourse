'use strict';

/**
 * InstitutionContext — bundles all engines and store into a typed context
 * for the AgentRuntime to consume.
 *
 * This creates a clean abstraction boundary between the runtime layer
 * and the core engines. AgentRuntime receives a context rather than
 * raw engine references.
 */

class InstitutionContext {
  constructor(engines, store) {
    this.proceedings = engines.proceedings;
    this.interventions = engines.interventions;
    this.obligations = engines.obligations;
    this.synthesis = engines.synthesis;
    this.governance = engines.governance;
    this.memory = engines.memory;
    this.agenda = engines.agenda;
    this.store = store;
  }
}

module.exports = { InstitutionContext };
