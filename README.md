# AI Discourse Infrastructure

An institutional reasoning system built on structured discourse.

Agents don't chat — they submit typed interventions into shared proceedings. They interpret, challenge, introduce evidence, and revise positions. The system tracks what was said, what was contested, and what survived scrutiny. Understanding is versioned, not overwritten.

> **Status:** Experimental. Functional and tested (158 tests), but not production-hardened.

---

## What This Is

This system is organized around a mandatory institutional chain:

```
proceedings → interventions → synthesis → memory
```

- **Proceedings** — matters under collective examination, with a lifecycle and state machine
- **Interventions** — typed procedural acts (interpret, challenge, introduce_evidence, revision, agreement, etc.)
- **Obligations** — tracked investigative work assigned to agents
- **Synthesis** — the institution's versioned reading, with uncertainties and preserved dissent
- **Memory** — precedent links between proceedings, persisted across runs

These are structural components of the system, not optional plugins.

---

## What This Is Not

- Not a generic agent framework
- Not a workflow engine
- Not a task orchestration system
- Not a minimal loop runner
- Not AGI

This system's value comes from **enforced structure**, not flexibility. If the system can run without proceedings, typed interventions, and synthesis, it has failed its design.

---

## How This Differs

| Agent orchestration systems | This system |
|----------------------------|-------------|
| Coordinate agents to do things | Structure how agents reason together |
| Focus on tools, actions, outcomes | Focus on interpretations, challenges, synthesis |
| Task completes → done | Understanding evolves → revised, never "done" |
| State is per-task | State persists across runs and sessions |

Agent frameworks help agents **act**. This system helps agents **deliberate**.

---

## Example

You ask which design approach to choose. A chat system gives a recommendation and stops. Here, that recommendation becomes the starting point for discourse:

- one agent challenges it with scalability risks
- another questions the assumptions
- a third reframes the trade-offs
- the system updates its shared understanding

The result is not just a recommendation, but a **revised understanding of the problem**, with disagreements and changes in position made explicit.

---

## Quick Start

```bash
npm install
node examples/quickstart.js
```

This confirms the system is functional. To see real multi-agent reasoning with an LLM:

```bash
node examples/llm-incident-reasoning.js
```

To see reasoning continue across separate runs:

```bash
node examples/llm-incident-initial.js    # Part 1: initial investigation → synthesis v1
node examples/llm-incident-resume.js     # Part 2: new evidence → revised synthesis v2
```

Continuation happens by reusing the same data directory and proceeding — no special mode required.

---

## Architecture

### Institutional Core

The core implements the mandatory reasoning chain. These components are first-class, enforced, and non-removable:

```
core/
  proceedings/       # 13-state lifecycle, framing, attention
  interventions/     # 16 typed acts with grounds and targets enforcement
  obligations/       # TTL-based investigative work tracking
  synthesis/         # Versioned institutional readings + discourse metrics
  governance/        # Rules, stewardship actions, discourse health
    governance-rules.js
    stewardship-actions.js
    discourse-health.js
  memory/            # Precedent links between proceedings
  agenda/            # Watchlists and priority ranking
```

### Infrastructure

Supporting layers — replaceable without changing the system's identity:

```
adapters/            # LLM providers (OpenAI-compatible)
storage/             # Persistence (file-based by default)
runtime/             # Cycle runner, delta detection, agent runtime, state management
  institution-context.js   # Abstraction boundary between runtime and core
api/                 # REST API (Express, optional)
```

### Execution Model

The system is organized around this chain:

```
proceedings → interventions → synthesis → memory
```

- `runCycle()` requires active proceedings to exist — it will not run on empty state
- Agents submit typed interventions during each cycle
- Synthesis is an explicit step — the system signals when it is pending but does not auto-generate it
- State persists to disk so investigations can continue across runs

The chain is the product, not an implementation detail.

---

## Examples

| Example | Agents | What it demonstrates |
|---------|--------|---------------------|
| `quickstart.js` | 1 | Smoke test — confirms system runs (no LLM needed) |
| `llm-research-note.js` | 2 | LLM agents compare research papers with challenge |
| `llm-pr-review.js` | 3 | LLM agents review a real GitHub PR |
| **`llm-incident-reasoning.js`** | **3** | **LLM agents investigate an incident over 4 cycles** |
| **`llm-incident-initial.js` + `llm-incident-resume.js`** | **2** | **Continuation across runs via persisted state** |

LLM examples need an OpenAI-compatible endpoint (vLLM, Ollama, OpenAI).

---

## LLM Integration

Your existing LLM call goes here:

```javascript
import { createLLMAgent } from './adapters/index.js'

const agent = createLLMAgent({
  id: 'analyst',
  baseUrl: 'http://127.0.0.1:8000/v1',
  model: 'local-vllm',
  systemPrompt: 'You are an analyst who...'
})

institution.registerAgent(agent)
```

The system doesn't touch your LLM. Your LLM plugs into the agent, not into the system.

See the [integration guide](docs/integration/how-to-plug-into-your-existing-ai-stack.md).

---

## Define Your Own Agents

The system prompt defines each agent's lens. But the prompt alone isn't what makes this different from giving an LLM a persona. What makes it different is what happens when multiple lenses collide inside the institutional structure:

- Each agent sees what every other agent has said
- Agents can challenge each other with typed interventions
- The institution produces a versioned synthesis with preserved disagreement
- This repeats across cycles, with state persisted between runs

A single prompted agent is a skill. Multiple prompted agents reasoning against each other inside a deliberation structure is an institution.

---

## How It Works

```
store → institution → registerAgent → openProceeding → runCycle → updateSynthesis → getSynthesis
```

```javascript
import { createStore, createInstitution } from './index.js'

const store = createStore('./data')
const institution = createInstitution({ store })

institution.registerAgent({
  id: 'analyst',
  async evaluate(context) {
    return {
      interventions: [{
        proceeding_id: context.proceedings[0].id,
        type: 'interpret',
        summary: 'Initial assessment',
        content: 'This warrants further examination.',
        grounds: { evidence_refs: ['review_v1'] }
      }],
      obligations: []
    }
  }
})

const proc = institution.openProceeding({ title: 'Investigate X' })
await institution.runCycle()

institution.updateSynthesis({
  proceeding_id: proc.id,
  updated_by: 'system',
  primary_reading: 'The analyst flagged this for examination.'
})

const synthesis = institution.getSynthesis(proc.id)
```

---

## Recent Refactor

The codebase was refactored for architectural clarity:

- Storage abstraction cleaned — no private method leakage across layers
- GovernanceEngine split into rules, stewardship actions, and discourse health
- Runtime receives dependencies via InstitutionContext, not raw store access
- `runCycle()` enforces that proceedings exist before agents run
- Return value includes chain status indicating when synthesis is pending

The refactor improved modularity without changing the system's identity. Nothing became optional. The institutional chain remains mandatory.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [Integration Guide](docs/integration/how-to-plug-into-your-existing-ai-stack.md) | Plug this into your existing AI stack |
| [Demo Narrative](docs/demo/incident-reasoning-demo-narrative.md) | Why this is different from chat — with real LLM output |
| [Memory Model](docs/concepts/memory.md) | What "memory" means in this system |

## Tests

```bash
npm test    # 158 tests
```

---

## Developer Orientation

| Directory | What's there |
|-----------|-------------|
| `core/` | Institutional logic — proceedings, interventions, obligations, synthesis, governance, memory, agenda |
| `runtime/` | Cycle runner, delta detection, agent runtime, state management |
| `storage/` | File-based persistence (JSON + JSONL, atomic writes) |
| `adapters/` | LLM integration (OpenAI-compatible) |
| `api/` | REST API (Express) |
| `test/` | 158 tests — schemas, storage, engines, runtime, API, public contract |
| `examples/` | Deterministic + LLM-powered examples |
| `docs/` | Integration guide, demo narrative, memory model |
