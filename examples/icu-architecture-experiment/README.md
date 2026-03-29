# ICU Architecture Decision — Forward-Looking Reasoning Experiment

Capstone experiment testing whether structured multi-agent deliberation
produces more complete and more epistemically honest risk assessment than
single-agent or parallel-independent analysis on a forward-looking
architectural decision with no memorised answer.

## Why this experiment

Prior experiments (CrowdStrike, GitLab, AF447) used retrospective incident
analysis — problems where the answer exists in the model's training data.
This experiment uses a forward-looking architectural decision where:
- No post-mortem exists to memorise
- Both options have genuine failure modes
- The "right answer" depends on constraints deliberately left ambiguous
- A confident wrong recommendation is the specific failure mode to test

## The Problem

Design a real-time patient monitoring system for a 50-bed ICU.
Two candidate architectures: event-driven (Kafka) vs polling-based.
The problem statement deliberately leaves key constraints ambiguous
(regulatory environment, legacy device mix, clinical IT team size)
to test whether agents surface and reason about those ambiguities
or paper over them with confident recommendations.

## Three Conditions (ablation built-in)

| Condition | Agents | Cycles | What it tests |
|-----------|--------|--------|---------------|
| A: Single | 1 | 1 | Baseline recommendation |
| B: Parallel | 3 independent | 1 each | More perspectives, no interaction |
| C: Deliberation | 4 in discourse | 4 | Framework structure with challenge |

## Scoring

Manual scoring against a pre-defined rubric of known failure modes and
trade-offs. See `scoring-guide.md`.

## Usage

```bash
node examples/icu-architecture-experiment/condition-a-single.js
node examples/icu-architecture-experiment/condition-b-parallel.js
node examples/icu-architecture-experiment/condition-c-deliberation.js
node examples/icu-architecture-experiment/score-icu.js
```

## Prerequisites

```bash
tmux new-session -d -s ericai 'ericai ericaiproxy --port 7999'
```

## Files

- `condition-a-single.js` — Single agent baseline
- `condition-b-parallel.js` — Three independent agents
- `condition-c-deliberation.js` — Full deliberation
- `score-icu.js` — Keyword scoring + cost metrics
- `scoring-guide.md` — Manual scoring rubric (defined before experiment runs)
- `problem.js` — Shared problem statement
- `README.md` — This file
