# Incident Reasoning Demo — Narrative

## The Problem

A production checkout system starts returning 500 errors for 12% of users. Three people need to figure out why: a backend engineer, a QA engineer, and a product manager.

In a normal setup, you'd ask an AI chatbot: "What's causing this?" You'd get one answer, once, and move on.

But incidents don't work like that. The first hypothesis is often wrong. Evidence arrives in stages. People disagree. The understanding evolves.

This demo shows what happens when you give AI agents the same structure.

---

## What Chat Does

Ask ChatGPT or Claude: *"Our checkout API is returning 500 errors for 12% of users. Only users with saved payment methods are affected. The payment provider rotated their encryption key at 09:00. What's the root cause?"*

You get:

- One answer, immediately
- Probably correct at surface level: "the key rotation broke decryption"
- No follow-up questions
- No competing hypotheses
- No preserved uncertainty
- If you ask again, you get the same answer rephrased

The conversation is **stateless**. It doesn't think further. It answered.

---

## What This System Does Differently

Three AI agents — each with a different role — investigate the same incident over multiple cycles. They don't chat. They submit **typed interventions** into a shared proceeding: interpretations, challenges, evidence, agreements.

### Cycle 1 — Initial Hypothesis

The backend engineer posts the obvious interpretation — the same answer chat would give:

> **[backend-eng] interpret:** *"The failure is isolated to users with saved cards, while new-card flows succeed. Log entries at 09:18 UTC show the error message 'token decryption failed'... The payment-service loads the provider's public key at startup and caches it. After the provider rotated its encryption key at 09:00 UTC, tokens encrypted with the new key cannot be decrypted."* (confidence: 0.86)

One hypothesis. One perspective. This is where chat stops.

### Cycle 2 — Challenge Changes Everything

The QA engineer introduces evidence that complicates the picture:

> **[qa-eng] introduce_evidence:** *"All failed decryption attempts involve payment tokens whose `creation_timestamp` is later than 2026-03-22T08:55:00Z. Tokens generated before this cutoff decrypt successfully."* (confidence: 0.92)

Then challenges the backend engineer's hypothesis directly:

> **[qa-eng] challenge:** *"The current hypothesis assumes that the 500 errors stem solely from the payment-service holding an outdated JWKS cache. However, the evidence that only tokens created after 09:00 UTC fail decryption suggests a deeper mismatch: the service is likely using the wrong key entirely, not just a stale one."* (confidence: 0.78)

The product manager adds impact assessment — a perspective the engineers didn't cover:

> **[product-mgr] interpret:** *"The 500-error spike affects roughly 12% of checkout attempts, but only for customers who have a saved payment method (~35% of total checkout traffic). This translates to an immediate loss of ~4% of total checkout volume."* (confidence: 0.92)

Three agents, three different lenses, and the QA engineer has already shifted the investigation away from the obvious answer.

### Cycle 3 — The Root Cause Shifts

The QA engineer finds new evidence that changes the diagnosis entirely:

> **[qa-eng] introduce_evidence:** *"A manual query of the payment provider's JWKS endpoint at 09:10 UTC returned a JSON payload containing two active RSA keys (kid values: `key-2026-old` and `key-2026-new`). Service logs show that `payment-service` always selects the first key in the array — `key-2026-old` — regardless of the `kid` header in the token."* (confidence: 0.94)

And challenges the backend engineer's fix proposal:

> **[qa-eng] challenge:** *"The current remediation hypothesis assumes that reloading the JWKS cache or restarting the payment-service pods will instantly fix the decryption failures. However, evidence shows that the JWKS endpoint now publishes two active keys, and the service always picks the first one — a restart won't fix the key-selection bug."* (confidence: 0.88)

The understanding has shifted twice. The root cause isn't "provider rotated keys." It's "provider rotation exposed a key-selection bug in our payment-service that always picks the first key from the JWKS array."

### Cycle 4 — Convergence

By cycle 4, the backend engineer has revised their position to match the evidence:

> **[backend-eng] interpret:** *"The 500-error spike is caused by two tightly coupled defects: (1) Static JWKS cache — the service loads the provider's JWKS only at startup and never refreshes it. (2) Naive key selection — when multiple keys are present, the service selects the first key in the array rather than matching by `kid` header."* (confidence: 0.93)

The product manager endorses the converged remediation path (confidence: 0.96). The investigation has gone from "simple key rotation problem" to "two coupled defects" — a diagnosis that emerged from structured disagreement, not from asking a better prompt.

---

## Why Synthesis Matters

After each cycle, the system produces a **synthesis** — the institution's current reading of the situation. This is not a summary. It's a versioned, evolving assessment that includes:

- **Primary reading**: what we currently believe
- **Supporting points**: evidence from each agent
- **Uncertainties**: what we still don't know
- **Preserved dissent**: minority views that haven't been resolved

The synthesis changed 4 times across 4 cycles. By version 4, the system held 7 hypotheses, 2 challenges, 2 evidence items, and preserved dissent about whether a pod restart would actually work. Chat gives you version 1 and stops.

---

## Why This Is Better for Evolving Problems

| Aspect | Chat AI | This System |
|--------|---------|-------------|
| Answers | Once | Evolves over multiple cycles |
| Perspectives | One | Multiple agents with different lenses |
| Disagreement | Not possible | Structured challenges with evidence |
| Evidence | Whatever the user provides | Agents introduce evidence independently |
| Uncertainty | Hidden | Explicitly preserved |
| State | Stateless | Persistent proceedings with full history |
| Synthesis | First response = final answer | Versioned, revisable institutional reading |

---

## Why This Matters

Some problems don't have instant answers. Incidents, research questions, strategic decisions — these require investigation, disagreement, and revision. Chat AI is designed to answer. This system is designed to **keep thinking**.

It doesn't replace engineers. It gives them a structured reasoning environment where multiple AI perspectives can investigate, disagree, and converge — the same way a good incident team works, but with the persistence and discipline of institutional process.

---

## What This Is Not

- Not AGI
- Not autonomous — humans decide what to investigate and when synthesis is sufficient
- Not a replacement for incident response teams
- Not a general-purpose agent framework

It is: **a structured multi-agent reasoning system for problems where understanding evolves over time.**
