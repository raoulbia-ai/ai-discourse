# AI Discourse Infrastructure

An early-stage framework for AI systems that reason over time instead of answering once.

Chat gives answers. This system investigates.

> **Status:** Experimental. Working, tested, and usable — but not production-hardened. Feedback welcome.

---

## Quick Start

```bash
cd infra
npm install
node examples/quickstart.js
```

```
=== AI Discourse Infrastructure — Quickstart ===
Proceeding: Sample Inquiry
Cycle: 1 | Agents: 1 | Interventions: 1
Synthesis (v1): The analyst identified this as worthy of examination.
```

---

## How This Is Different

| | Chat AI | This Framework |
|---|---------|---------------|
| Answers | Once | Evolves over multiple cycles |
| Perspectives | One | Multiple agents, different lenses |
| Disagreement | Not possible | Structured challenges with evidence |
| Memory | Stateless | Persistent proceedings with history |
| Output | First response = final | Versioned synthesis with uncertainty |

---

## What Happens When You Run This

1. Agents analyze the problem from different perspectives
2. They challenge each other's hypotheses with evidence
3. New interpretations emerge from the disagreement
4. The system updates its institutional understanding (synthesis)

This repeats across cycles. Understanding evolves — it doesn't just appear.

---

## Examples

| Example | Agents | What it demonstrates |
|---------|--------|---------------------|
| `quickstart.js` | 1 | Minimal loop — start here for basics |
| `bug-triage.js` | 3 | Software bug diagnosis with challenge |
| `research-note.js` | 2 | Paper comparison with challenge |
| `incident-triage.js` | 2 | Ops incident response |
| `book-review.js` | 3 | Literary deliberation |
| `llm-research-note.js` | 2 | LLM-powered paper comparison |
| **`llm-incident-reasoning.js`** | **3** | **LLM-powered incident investigation — start here for LLM** |

Deterministic examples need no LLM. LLM examples need an OpenAI-compatible endpoint (vLLM, Ollama, OpenAI).

---

## LLM Integration

Your existing LLM call goes here:

```javascript
import { createLLMAgent } from './infra/adapters/index.js'

const agent = createLLMAgent({
  id: 'analyst',
  baseUrl: 'http://127.0.0.1:8000/v1',  // vLLM, Ollama, OpenAI, etc.
  model: 'local-vllm',
  systemPrompt: 'You are an analyst who...'
})

institution.registerAgent(agent)
```

The framework doesn't touch your LLM. Your LLM plugs into the agent, not into the framework.

See the [full integration guide](docs/integration/how-to-plug-into-your-existing-ai-stack.md) for before/after examples and a 20-line working template.

---

## How It Works

```
store → institution → registerAgent → openProceeding → runCycle → updateSynthesis → getSynthesis
```

```javascript
import { createStore, createInstitution } from './infra/index.js'

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

## Documentation

| Doc | Purpose |
|-----|---------|
| [Integration Guide](docs/integration/how-to-plug-into-your-existing-ai-stack.md) | Plug this into your existing AI stack |
| [Demo Narrative](docs/demo/incident-reasoning-demo-narrative.md) | Why this is different from chat — with real LLM output |
| [Demo Script](docs/demo/incident-reasoning-demo-script.md) | Live walkthrough script |
| [Public API Reference](docs/ai-discourse-framework/implementation/20260321_ai-discourse-infrastructure-public-framework-surface-v0.1.md) | Full public surface spec |

## Tests

```bash
npm test    # 147 tests
```

---

## What This Is Not

- Not a chatbot framework
- Not a workflow engine
- Not a task automation system
- Not AGI

It is a structured reasoning system for problems where understanding evolves over time.
