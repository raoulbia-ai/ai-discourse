# Air France 447 — Controlled Reasoning Experiment v2

Controlled experiment testing whether structured multi-agent deliberation
produces more complete and more specific causal reasoning than single-agent
analysis when contributing factors are NOT enumerated in the source material.

## What agents receive

Raw observable facts only: timeline, crew actions, cockpit instrument
readings, atmospheric conditions, and the BEA Phase 1 proximate cause.

The systemic and design-level factors are deliberately withheld from the
source material. Agents must reason to them.

## Ground truth

The BEA final report (July 2012) plus Bill Palmer's independent analysis
and Sullenberger's public commentary form the authoritative ground truth.

The scoring rubric contains 10 factors across two tiers:
- Tier 1 (5 factors): BEA final report — official documented factors
- Tier 2 (5 factors): Palmer/Sullenberger critique — factors the official
  report acknowledged but underweighted or did not surface as primary

## Scoring

Manual scoring by evaluator after both runs complete.
Score Run A fully before reading Run B.

See `scoring-guide.md` for the rubric and scoring instructions.

## Experiment Runs

- **Run A** (`llm-af447-single-agent.js`): Single agent, 1 cycle, no deliberation
- **Run B** (`llm-af447-deliberation.js`): 4 agents, 4 cycles, structured deliberation

## Usage

```bash
# Run A first
node examples/af447-experiment/llm-af447-single-agent.js

# Then Run B
node examples/af447-experiment/llm-af447-deliberation.js

# Score Run A manually before reading Run B output
# See scoring-guide.md
```

## Prerequisites

```bash
tmux new-session -d -s ericai 'ericai ericaiproxy --port 7999'
```

## Files

- `llm-af447-single-agent.js` — Run A: single-agent baseline
- `llm-af447-deliberation.js` — Run B: multi-agent deliberation
- `scoring-guide.md` — Manual scoring rubric and instructions
- `README.md` — This file
