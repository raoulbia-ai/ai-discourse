# AI Discourse Infrastructure

A framework for multi-agent systems that **continue, challenge, and revise an investigation across cycles** instead of restarting from scratch.

The system does more than accumulate context. It preserves proceedings, disagreement, interventions, and synthesis so agents can revisit earlier conclusions when new evidence appears.

Multiple AI agents examine a problem over time. They interpret signals through different lenses, challenge each other with evidence, and update a shared synthesis as understanding changes. State is persisted to disk, so an investigation can resume later instead of starting over. Early conclusions remain provisional.

> **Status:** Experimental. Functional and tested, but not production-hardened.

**How this differs from existing tools:**

| Tool type | What it does | What it is not designed for |
|-----------|-------------|---------------------------|
| Chat / copilots | Produce an answer from a single interaction | Ongoing revision across separate runs |
| Agent tools / skills | Give agents capabilities — tools, actions, APIs | Persistent multi-agent deliberation |
| Workflow / agent frameworks | Coordinate steps and task execution | Evolving shared understanding with explicit disagreement |
| **AI Discourse** | **Multi-agent reasoning across cycles with persistent state, challenge, and revised synthesis** | |

Agent frameworks help agents **act**. This framework helps agents **deliberate over time**.

**Example:** You ask which design approach to choose. A chat system gives a recommendation and stops. Here, that recommendation is treated as provisional. One agent raises scalability risks. Another questions the load assumptions. A third revisits the trade-offs after new evidence arrives. The shared synthesis is updated rather than replaced. The result is not just a better answer — it is a **revised understanding** with disagreements and changes in position made explicit.

This is not just running multiple cycles inside one execution. The system persists discourse and synthesis to disk, so reasoning can continue across separate runs.

Useful for incident analysis, multi-perspective code review, design decisions, research comparison — especially where the first answer is unlikely to be the final understanding.

---

## Quick Start

```bash
git clone https://github.com/raoulbia-ai/ai-discourse.git
cd ai-discourse
npm install
node examples/quickstart.js
```

This confirms the framework is functional. To see real multi-agent reasoning with an LLM, run:

```bash
node examples/llm-incident-reasoning.js
```

To see reasoning **persist and resume across runs** (the key differentiator):

```bash
node examples/llm-incident-resume.js            # Run 1: initial investigation → synthesis v1
node examples/llm-incident-resume.js --resume    # Run 2: new evidence → revised synthesis v2
```

Run 2 loads the proceeding from disk, shows prior findings, and agents revise their diagnosis based on new evidence. The system continues instead of restarting.

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

The framework includes persistent institutional memory: it retains the state of proceedings, interventions, syntheses, and precedents so reasoning can continue across cycles instead of restarting each time. See [what "memory" means in this framework](docs/concepts/memory.md).

---

## Examples

| Example | Agents | What it demonstrates |
|---------|--------|---------------------|
| `quickstart.js` | 1 | Smoke test — confirms framework runs (no LLM needed) |
| `llm-research-note.js` | 2 | LLM agents compare two research papers with challenge |
| `llm-pr-review.js` | 3 | LLM agents review a real GitHub PR (security, architecture, reliability) |
| **`llm-incident-reasoning.js`** | **3** | **LLM agents investigate an incident over 4 cycles — best demo of multi-cycle reasoning** |
| **`llm-incident-resume.js`** | **2** | **Resume an investigation across separate runs — best demo of persistence** |

**Start here:** `quickstart.js` → `llm-incident-reasoning.js` → `llm-incident-resume.js` (run twice: first without flag, then with `--resume`).

LLM examples need an OpenAI-compatible endpoint (vLLM, Ollama, OpenAI).

---

## LLM Integration

Your existing LLM call goes here:

```javascript
import { createLLMAgent } from './adapters/index.js'

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

## Define Your Own Agents

The system prompt defines each agent's *lens* — what perspective they bring. But the prompt alone isn't what makes this different from giving an LLM a persona. What makes it different is what happens when multiple lenses collide inside the framework:

- Each agent sees what every other agent has said (prior interventions)
- Agents can challenge each other's reasoning with typed `challenge` interventions
- The institution produces a versioned synthesis that reflects agreement, disagreement, and remaining uncertainty
- This repeats across cycles, with state persisted between runs

You choose the perspectives. The framework structures the collision.

```javascript
createLLMAgent({ id: 'legal', ..., systemPrompt: 'You review for GDPR and data privacy compliance...' })
createLLMAgent({ id: 'perf-eng', ..., systemPrompt: 'You evaluate latency impact and scalability...' })
createLLMAgent({ id: 'payments-expert', ..., systemPrompt: 'You know PCI-DSS, tokenization, and settlement flows...' })
```

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

## Documentation

| Doc | Purpose |
|-----|---------|
| [Integration Guide](docs/integration/how-to-plug-into-your-existing-ai-stack.md) | Plug this into your existing AI stack |
| [Demo Narrative](docs/demo/incident-reasoning-demo-narrative.md) | Why this is different from chat — with real LLM output |
| [Demo Script](docs/demo/incident-reasoning-demo-script.md) | Live walkthrough script |
| [Memory Model](docs/concepts/memory.md) | What "memory" means in this framework |

## Tests

```bash
npm test    # 147 tests
```

---

## What This Is (and Is Not)

Most agent frameworks coordinate agents to **execute tasks** — call tools, run workflows, produce deliverables. This framework operates at a different layer: it structures how agents **arrive at and revise understanding**.

| Agent orchestration systems | This framework |
|----------------------------|---------------|
| Coordinate agents to do things | Structure how agents reason together |
| Focus on tools, actions, outcomes | Focus on interpretations, challenges, synthesis |
| Task completes → done | Understanding evolves → revised, never "done" |
| State is per-task | State persists across runs and sessions |

This is not:
- A chatbot framework
- A workflow engine
- A task automation system
- An agent orchestration layer
- AGI

This is:
A system for structuring multi-agent deliberation — where agents investigate a problem across cycles, challenge each other's reasoning, and produce a versioned institutional understanding that can be resumed and revised as new evidence arrives.
