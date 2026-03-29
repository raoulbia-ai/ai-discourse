# CrowdStrike Incident Investigator — ai-discourse Experiment

Multi-agent deliberation over the true contributing factors of the CrowdStrike
global outage of July 19, 2024. Three agents with distinct epistemic lenses
investigate beyond the official RCA using structured typed interventions.

## Purpose

This experiment was designed to answer four research questions:

1. Does the Challenger surface gaps or errors the Analyst missed?
2. Does synthesis change meaningfully across deliberation cycles?
3. Do agents converge or stay in genuine disagreement?
4. What survives scrutiny vs. what gets dropped?

Results from this experiment are documented in:
- LinkedIn article: _"Your AI Agents Are Yes-Men"_ [link when published]
- Medium article: _"AI Discourse: Structured Deliberation as an Alternative to Task Orchestration"_ [link when published]

## Architecture

```
Incident framing injected as proceeding
        │
        ▼
┌──────────────────────────────────────────────────┐
│  analyst         — SRE lens                       │
│  Forms technical hypotheses about root cause      │
│  and causal chain. May anchor on visible cause.   │
│                  │                                │
│                  ▼                                │
│  challenger      — Devil's Advocate lens          │
│  Attacks assumptions, surfaces gaps, demands      │
│  evidence. Must challenge at least one claim      │
│  per cycle.                                       │
│                  │                                │
│                  ▼                                │
│  systems-thinker — Resilience research lens       │
│  Surfaces organizational factors, process gaps,  │
│  governance failures, normalization of deviance.  │
│  References Hollnagel, Rasmussen, Dekker.         │
│                  │                                │
│                  ▼                                │
│  Synthesis updated after every cycle              │
│  (managed by script, not an agent)                │
└──────────────────────────────────────────────────┘
```

## Agents

| Agent | Role | Lens | Temperature |
|-------|------|------|-------------|
| `analyst` | Primary investigator | Senior SRE — technical root cause, causal chain | 0.3 |
| `challenger` | Devil's Advocate | Principal Engineer — gaps, unsupported assumptions, alternative hypotheses | 0.5 |
| `systems-thinker` | Systemic context | Resilience researcher — process failures, governance gaps, normalization of deviance | 0.4 |

## The Incident

**CrowdStrike Global Outage — July 19, 2024**

- 8.5 million Windows hosts entered a boot loop simultaneously
- Cause: Channel File 291 — a content configuration update — passed a buggy
  validator and was pushed globally in a single deployment
- No staged rollout was applied to content updates (only to sensor code releases)
- Recovery required manual Safe Mode intervention on every affected machine
- A nearly identical validator bug had triggered a Linux outage in March 2024 —
  this precedent was not connected during the July Windows release process
- Official RCA: "content configuration validator bug"

The experiment tests whether structured multi-agent deliberation surfaces the
deeper systemic story — the March 2024 precedent, the content/code deployment
policy gap, and the normalization of unchecked fast-path deployments — that the
official single-perspective RCA does not fully capture.

## Prerequisites

```bash
# ericai proxy (LLM access) — must be running
tmux new-session -d -s ericai 'ericai ericaiproxy --port 7999'
```

## Usage

```bash
# From repo root, using defaults from .env
node examples/crowdstrike-experiment/llm-incident-crowdstrike.js

# Or with explicit overrides
BASE_URL=http://127.0.0.1:7999 MODEL=Qwen/Qwen3-235B-A22B \
  node examples/crowdstrike-experiment/llm-incident-crowdstrike.js
```

## Files

- `llm-incident-crowdstrike.js` — Main experiment script
- `README.md` — This file
