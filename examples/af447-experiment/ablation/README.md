# AF447 Ablation — Framework Structure vs Parallelism

Ablation experiment isolating whether ai-discourse's value comes from the
institutional chain (typed interventions, challenge/response, synthesis) or
simply from having more LLM calls producing more coverage.

## Three Conditions

| Condition | Agents | Interaction | Cycles | What it tests |
|-----------|--------|-------------|--------|---------------|
| **A: Single** | 1 analyst | None | 1 | Baseline — one agent, one pass |
| **B: Parallel** | 3 independent | None — agents cannot see each other | 1 each | Parallelism — more calls, no structure |
| **C: Deliberation** | 4 in discourse | Full typed interventions, challenge/response | 4 | Framework structure — institutional chain |

## The Critical Comparison

- **A vs B**: Does having three perspectives improve coverage? (Expected: yes)
- **B vs C**: Does the framework structure add value beyond parallelism? (This is the question)

If B ≈ C, the framework adds little — the value is just more LLM calls.
If C > B, the institutional chain (challenge, typed interventions, synthesis) is doing real work.

## Metrics

Each condition is scored on the same 10-factor rubric from the AF447 experiment
(see `../af447-experiment/scoring-guide.md`).

Additionally, each condition reports **total character count** across all
intervention content as a proxy for compute cost.

## Usage

```bash
# Run all three conditions
node examples/af447-ablation/condition-a-single.js
node examples/af447-ablation/condition-b-parallel.js
node examples/af447-ablation/condition-c-deliberation.js

# Score and compare
node examples/af447-ablation/score-ablation.js
```

## Prerequisites

```bash
tmux new-session -d -s ericai 'ericai ericaiproxy --port 7999'
```

## Files

- `condition-a-single.js` — Single agent baseline
- `condition-b-parallel.js` — Three independent agents (no interaction)
- `condition-c-deliberation.js` — Full deliberation (4 agents, 4 cycles)
- `score-ablation.js` — Scores all three conditions and prints comparison
- `README.md` — This file
