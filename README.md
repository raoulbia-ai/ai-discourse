# AI Discourse Infrastructure

A framework for multi-agent reasoning that persists and continues — not single-shot answers, not task automation.

Multiple AI agents investigate a problem across cycles. They interpret, challenge each other with evidence, and produce a shared synthesis that updates as understanding changes. State is persisted, so an investigation can resume later with new evidence instead of restarting from scratch. The system doesn't just accumulate context — it supports revision of prior conclusions when new evidence arrives, provided agents are prompted to consider revising their earlier positions. The first hypothesis is rarely the final one.

> **Status:** Experimental. Working, tested, and usable — but not production-hardened. Feedback welcome.

**How this differs from existing tools:**

| Tool type | What it does | What it doesn't do |
|-----------|-------------|-------------------|
| Chat / copilots | One answer, one perspective, done | Revisit, challenge, evolve |
| Agent tools / skills | Give agents capabilities — tools, actions, APIs | Reason together, disagree, synthesize |
| Workflow / agent frameworks | Execute steps, complete tasks | Revise, preserve uncertainty |
| **AI Discourse** | **Multiple agents reason across cycles with structured challenge and evolving synthesis** | |

Agent frameworks help agents *act*. This framework helps agents *deliberate*.

**Example:** In an incident investigation, chat says "key rotation broke decryption" and stops. This framework runs 3 agents over 4 cycles — one challenges the initial hypothesis with log evidence, the diagnosis shifts to "two coupled defects", and the synthesis preserves the remaining uncertainty. That evolution is the point.

This is not just running multiple cycles in one execution. The system persists proceedings, interventions, and synthesis to disk — reasoning can continue across separate runs, not just within a single session.

Useful for incident analysis, multi-perspective code review, research comparison — problems where the first answer is rarely the final one.

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

Agent roles are defined entirely by your system prompt — the framework imposes no fixed personas. You decide what perspectives matter for your problem.

```javascript
// A legal reviewer
createLLMAgent({ id: 'legal', ..., systemPrompt: 'You review code changes for GDPR and data privacy compliance...' })

// A performance engineer
createLLMAgent({ id: 'perf-eng', ..., systemPrompt: 'You evaluate changes for latency impact, memory usage, and scalability...' })

// A domain expert
createLLMAgent({ id: 'payments-expert', ..., systemPrompt: 'You are a payments domain expert who knows PCI-DSS, tokenization, and settlement flows...' })
```

Mix any combination of agents for your use case. The framework handles the deliberation cycle — who sees what, when they respond, how interventions are typed and validated.

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

## What This Is Not

- Not a chatbot framework
- Not a workflow engine
- Not a task automation system
- Not AGI

It is a structured reasoning system for problems where understanding evolves over time.
