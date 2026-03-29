# GitLab 2017 Database Deletion — Controlled Reasoning Experiment

Controlled experiment testing whether structured multi-agent deliberation
produces more complete root cause analysis than single-agent analysis.

## Hypothesis

Structured multi-agent deliberation identifies more documented contributing
factors than single-agent analysis on the same incident facts.

## The Incident

On January 31, 2017, a GitLab.com database administrator accidentally deleted
300GB of production data while attempting to fix database replication lag.
GitLab lost approximately 6 hours of data affecting 5,000+ projects.

The popular narrative: "engineer accidentally deleted the production database."
The actual story: 12 independent systemic failures that made the deletion
possible and made recovery impossible.

## Ground Truth

GitLab's own post-mortem (February 10, 2017) is the authoritative document.
It explicitly lists 12 contributing factors — these form the scoring rubric.

Source: https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/

## Scoring Rubric (12 factors from the official post-mortem)

| # | Factor | Category |
|---|--------|----------|
| 1 | Spam attack caused elevated DB load | Trigger |
| 2 | Background job hard-deleted flagged user data (false positive) | Trigger |
| 3 | PostgreSQL replication lag caused WAL segments to be removed before secondary caught up | Technical |
| 4 | Engineer confused production and secondary server (ran rm -rf on wrong server) | Human |
| 5 | pg_dump backups silently failing — version mismatch (9.2 tool vs 9.6 DB) | Systemic |
| 6 | Backup failure notification emails rejected by DMARC misconfiguration | Systemic |
| 7 | Azure disk snapshots not enabled for the DB server | Systemic |
| 8 | LVM snapshots only every 24 hours (not hourly as assumed) | Systemic |
| 9 | Staging environment DB restore procedure untested and broken | Systemic |
| 10 | No safeguards preventing destructive commands on production | Process |
| 11 | No tested disaster recovery procedure | Process |
| 12 | Late-night work under pressure contributed to human error | Human factors |

## Experiment Runs

- **Run A** (`llm-gitlab-single-agent.js`): Single agent, no deliberation
- **Run B** (`llm-gitlab-deliberation.js`): Three-agent structured deliberation

## Scoring

```bash
node examples/gitlab-experiment/score.js
```

Scores both runs against the 12-factor rubric and prints:
- Factors identified by single agent
- Factors identified by deliberation
- Coverage comparison

## Usage

```bash
# Run A: single agent
node examples/gitlab-experiment/llm-gitlab-single-agent.js

# Run B: deliberation
node examples/gitlab-experiment/llm-gitlab-deliberation.js

# Score both
node examples/gitlab-experiment/score.js
```

## Prerequisites

```bash
tmux new-session -d -s ericai 'ericai ericaiproxy --port 7999'
```

## Files

- `llm-gitlab-single-agent.js` — Run A: single-agent baseline
- `llm-gitlab-deliberation.js` — Run B: three-agent deliberation
- `score.js` — Scoring script comparing both outputs against rubric
- `README.md` — This file
