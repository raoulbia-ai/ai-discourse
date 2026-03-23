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
    // Public: institutional engines (the abstraction boundary)
    this.proceedings = engines.proceedings;
    this.interventions = engines.interventions;
    this.obligations = engines.obligations;
    this.synthesis = engines.synthesis;
    this.governance = engines.governance;
    this.memory = engines.memory;
    this.agenda = engines.agenda;
    // Internal: store for signal reads and delta detection.
    // Not part of the public context interface — runtime internals only.
    this._store = store;
  }
}

module.exports = { InstitutionContext };
