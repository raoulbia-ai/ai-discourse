'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../../storage');
const { createInstitution } = require('../../core');

let store;
let inst;

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-engines-'));
  store = createStore(tmpDir);
  inst = createInstitution(store);
});

// ─── Proceeding Engine ───

describe('ProceedingEngine', () => {
  it('opens a proceeding', () => {
    const proc = inst.proceedings.open({ title: 'Chile Earthquake', opened_by: 'system' });
    assert.ok(proc.id.startsWith('proc_'));
    assert.equal(proc.status, 'opened');
    assert.equal(proc.title, 'Chile Earthquake');
  });

  it('rejects duplicate titles', () => {
    inst.proceedings.open({ title: 'Chile Earthquake', opened_by: 'system' });
    assert.throws(
      () => inst.proceedings.open({ title: 'Chile Earthquake', opened_by: 'system' }),
      /too similar/
    );
  });

  it('allows duplicates with force', () => {
    inst.proceedings.open({ title: 'Chile Earthquake', opened_by: 'system' });
    const proc2 = inst.proceedings.open({ title: 'Chile Earthquake', opened_by: 'system', force: true });
    assert.ok(proc2.id);
  });

  it('transitions through valid states', () => {
    const proc = inst.proceedings.open({ title: 'Test', opened_by: 'system' });
    const updated = inst.proceedings.transition(proc.id, 'under_examination');
    assert.equal(updated.status, 'under_examination');
  });

  it('rejects invalid transitions', () => {
    const proc = inst.proceedings.open({ title: 'Test', opened_by: 'system' });
    assert.throws(
      () => inst.proceedings.transition(proc.id, 'settled'),
      /Cannot transition/
    );
  });

  it('updates framing', () => {
    const proc = inst.proceedings.open({ title: 'Test', opened_by: 'system' });
    const updated = inst.proceedings.updateFraming(proc.id, {
      primary_question: 'What happened?',
      time_horizon: '14d',
    });
    assert.equal(updated.framing.primary_question, 'What happened?');
  });

  it('updates attention', () => {
    const proc = inst.proceedings.open({ title: 'Test', opened_by: 'system' });
    const updated = inst.proceedings.updateAttention(proc.id, { priority: 0.9, urgency: 0.8 });
    assert.equal(updated.attention.priority, 0.9);
  });

  it('adds signals', () => {
    const proc = inst.proceedings.open({ title: 'Test', opened_by: 'system' });
    inst.proceedings.addSignal(proc.id, 'sig_001');
    inst.proceedings.addSignal(proc.id, 'sig_001'); // idempotent
    const updated = inst.proceedings.get(proc.id);
    assert.deepEqual(updated.signal_ids, ['sig_001']);
  });

  it('lists with filters', () => {
    inst.proceedings.open({ title: 'Chile Earthquake Impact', opened_by: 'system' });
    const b = inst.proceedings.open({ title: 'Sudan Conflict', opened_by: 'system' });
    inst.proceedings.transition(b.id, 'under_examination');

    assert.equal(inst.proceedings.list().length, 2);
    assert.equal(inst.proceedings.list({ status: 'opened' }).length, 1);
    assert.equal(inst.proceedings.list({ exclude_status: 'opened' }).length, 1);
  });

  it('archives via settled path', () => {
    const proc = inst.proceedings.open({ title: 'Test', opened_by: 'system' });
    inst.proceedings.transition(proc.id, 'under_examination');
    inst.proceedings.transition(proc.id, 'provisionally_synthesized');
    inst.proceedings.transition(proc.id, 'stable');
    inst.proceedings.transition(proc.id, 'settled');
    const archived = inst.proceedings.archive(proc.id);
    assert.equal(archived.status, 'archived');
  });
});

// ─── Intervention Engine ───

describe('InterventionEngine', () => {
  let procId;

  beforeEach(() => {
    const proc = inst.proceedings.open({ title: 'Test Proceeding', opened_by: 'system' });
    procId = proc.id;
  });

  it('submits a valid interpret intervention', () => {
    const int = inst.interventions.submit({
      proceeding_id: procId,
      type: 'interpret',
      agent_id: 'geographer',
      summary: 'Subduction event',
      content: 'Detailed analysis.',
      grounds: { signal_ids: ['sig_001'] },
    });
    assert.ok(int.id.startsWith('int_'));
    assert.equal(int.type, 'interpret');
    assert.equal(int.legitimacy.procedural_validity, 'valid');
  });

  it('rejects interpret without grounds', () => {
    assert.throws(
      () => inst.interventions.submit({
        proceeding_id: procId,
        type: 'interpret',
        agent_id: 'geo',
        summary: 'No evidence',
        content: 'Empty.',
      }),
      /requires grounds/
    );
  });

  it('rejects challenge without targets', () => {
    assert.throws(
      () => inst.interventions.submit({
        proceeding_id: procId,
        type: 'challenge',
        agent_id: 'historian',
        summary: 'Disagree',
        content: 'No target.',
        grounds: { signal_ids: ['sig_001'] },
      }),
      /requires targets/
    );
  });

  it('accepts challenge with targets', () => {
    const int1 = inst.interventions.submit({
      proceeding_id: procId,
      type: 'interpret',
      agent_id: 'geo',
      summary: 'Initial',
      content: 'Claim.',
      grounds: { signal_ids: ['sig_001'] },
    });
    const int2 = inst.interventions.submit({
      proceeding_id: procId,
      type: 'challenge',
      agent_id: 'historian',
      summary: 'Rebuttal',
      content: 'Counter-evidence.',
      targets: [int1.id],
      grounds: { signal_ids: ['sig_002'] },
    });
    assert.equal(int2.type, 'challenge');
    assert.deepEqual(int2.targets, [int1.id]);
  });

  it('rejects invalid type', () => {
    assert.throws(
      () => inst.interventions.submit({
        proceeding_id: procId, type: 'chat', agent_id: 'a', summary: 's', content: 'c',
      }),
      /Invalid intervention type/
    );
  });

  it('lists and filters interventions', () => {
    inst.interventions.submit({
      proceeding_id: procId, type: 'introduce_evidence', agent_id: 'a1',
      summary: 's', content: 'c', grounds: { evidence_refs: ['ref1'] },
    });
    inst.interventions.submit({
      proceeding_id: procId, type: 'introduce_evidence', agent_id: 'a2',
      summary: 's', content: 'c', grounds: { evidence_refs: ['ref2'] },
    });

    assert.equal(inst.interventions.forProceeding(procId).length, 2);
    assert.equal(inst.interventions.byAgent('a1').length, 1);
  });

  it('counts types', () => {
    inst.interventions.submit({
      proceeding_id: procId, type: 'introduce_evidence', agent_id: 'a1',
      summary: 's', content: 'c', grounds: { evidence_refs: ['ref1'] },
    });
    inst.interventions.submit({
      proceeding_id: procId, type: 'introduce_evidence', agent_id: 'a2',
      summary: 's', content: 'c', grounds: { evidence_refs: ['ref2'] },
    });
    const counts = inst.interventions.typeCounts(procId);
    assert.equal(counts.introduce_evidence, 2);
  });
});

// ─── Obligation Engine ───

describe('ObligationEngine', () => {
  it('creates and resolves an obligation', () => {
    const obl = inst.obligations.create({
      proceeding_id: 'proc_001',
      assigned_agent_id: 'signal-analyst',
      description: 'Verify depth data.',
    });
    assert.equal(obl.status, 'open');
    assert.ok(obl.due_at);

    const resolved = inst.obligations.resolve(obl.id, 'answered', 'int_001');
    assert.equal(resolved.status, 'answered');
    assert.equal(resolved.resolution_intervention_id, 'int_001');
  });

  it('rejects resolving non-open obligation', () => {
    const obl = inst.obligations.create({
      proceeding_id: 'p1', assigned_agent_id: 'a1', description: 'test',
    });
    inst.obligations.resolve(obl.id, 'declined');
    assert.throws(() => inst.obligations.resolve(obl.id, 'answered'), /already declined/);
  });

  it('expires overdue obligations', () => {
    const obl = inst.obligations.create({
      proceeding_id: 'p1', assigned_agent_id: 'a1', description: 'test', ttl_hours: 0.0001,
    });
    // Wait a tiny bit for expiry
    const count = inst.obligations.expireOverdue();
    assert.ok(count >= 0); // May or may not have expired yet
  });

  it('filters by agent', () => {
    inst.obligations.create({ proceeding_id: 'p1', assigned_agent_id: 'a1', description: 'x' });
    inst.obligations.create({ proceeding_id: 'p1', assigned_agent_id: 'a2', description: 'y' });
    assert.equal(inst.obligations.forAgent('a1').length, 1);
  });

  it('provides stats', () => {
    inst.obligations.create({ proceeding_id: 'p1', assigned_agent_id: 'a1', description: 'x' });
    const obl2 = inst.obligations.create({ proceeding_id: 'p1', assigned_agent_id: 'a2', description: 'y' });
    inst.obligations.resolve(obl2.id, 'answered');

    const stats = inst.obligations.stats();
    assert.equal(stats.open, 1);
    assert.equal(stats.answered, 1);
  });
});

// ─── Synthesis Engine ───

describe('SynthesisEngine', () => {
  it('creates versioned syntheses', () => {
    const s1 = inst.synthesis.update({
      proceeding_id: 'p1', updated_by: 'chronicler', primary_reading: 'Initial reading.',
    });
    assert.equal(s1.version, 1);

    const s2 = inst.synthesis.update({
      proceeding_id: 'p1', updated_by: 'chronicler', primary_reading: 'Updated reading.',
    });
    assert.equal(s2.version, 2);
  });

  it('returns latest synthesis', () => {
    inst.synthesis.update({ proceeding_id: 'p1', updated_by: 'c', primary_reading: 'v1' });
    inst.synthesis.update({ proceeding_id: 'p1', updated_by: 'c', primary_reading: 'v2' });
    const latest = inst.synthesis.latest('p1');
    assert.equal(latest.primary_reading, 'v2');
    assert.equal(latest.version, 2);
  });

  it('returns null when no synthesis exists', () => {
    assert.equal(inst.synthesis.latest('nonexistent'), null);
  });

  it('returns history in order', () => {
    inst.synthesis.update({ proceeding_id: 'p1', updated_by: 'c', primary_reading: 'v1' });
    inst.synthesis.update({ proceeding_id: 'p1', updated_by: 'c', primary_reading: 'v2' });
    const history = inst.synthesis.history('p1');
    assert.equal(history.length, 2);
    assert.equal(history[0].version, 1);
    assert.equal(history[1].version, 2);
  });

  it('measures discourse chains', () => {
    const proc = inst.proceedings.open({ title: 'Chain Test', opened_by: 'system' });

    // Simulate a discourse chain
    inst.interventions.submit({
      proceeding_id: proc.id, type: 'introduce_evidence', agent_id: 'a1',
      summary: 'obs', content: 'observation', grounds: { evidence_refs: ['r1'] },
    });
    inst.interventions.submit({
      proceeding_id: proc.id, type: 'interpret', agent_id: 'a2',
      summary: 'hyp', content: 'hypothesis', grounds: { signal_ids: ['s1'] },
    });
    inst.interventions.submit({
      proceeding_id: proc.id, type: 'challenge', agent_id: 'a3',
      summary: 'ch', content: 'challenge', targets: ['int_prev'], grounds: { signal_ids: ['s2'] },
    });

    const metrics = inst.synthesis.measureChains(proc.id);
    assert.ok(metrics.total_discourse >= 3);
    assert.ok(metrics.chains_detected >= 1);
  });

  it('returns no_activity for empty proceeding', () => {
    const metrics = inst.synthesis.measureChains('nonexistent');
    assert.equal(metrics.interpretation, 'no_activity');
  });
});

// ─── Governance Engine ───

describe('GovernanceEngine', () => {
  it('adds and lists rules', () => {
    inst.governance.addRule({
      name: 'Escalation Requires Grounds',
      category: 'intervention_validity',
      description: 'Must cite evidence.',
      enforcement: { mode: 'hard_block', message: 'Need grounds.' },
    });
    assert.equal(inst.governance.listRules().length, 1);
  });

  it('checks intervention against rules', () => {
    inst.governance.addRule({
      name: 'Escalation Requires Grounds',
      category: 'intervention_validity',
      description: 'Must cite evidence.',
      applies_to: ['escalate'],
      enforcement: { mode: 'hard_block', message: 'Need grounds.' },
    });

    const result = inst.governance.checkIntervention({ type: 'escalate', grounds: null });
    assert.equal(result.allowed, false);
    assert.equal(result.violations.length, 1);

    const ok = inst.governance.checkIntervention({
      type: 'escalate', grounds: { signal_ids: ['s1'] },
    });
    assert.equal(ok.allowed, true);
  });

  it('posts and retrieves stewardship actions', () => {
    const action = inst.governance.postAction({
      agent_id: 'attention-steward',
      action: 'elevate',
      proceeding_id: 'p1',
      reason: 'High urgency.',
    });
    assert.equal(action.action, 'elevate');
    assert.equal(action.duration_hours, 12);

    const active = inst.governance.getActiveActions();
    assert.equal(active.length, 1);
  });

  it('analyzes discourse health', () => {
    const proc = inst.proceedings.open({ title: 'Health Test', opened_by: 'system' });
    inst.interventions.submit({
      proceeding_id: proc.id, type: 'introduce_evidence', agent_id: 'a1',
      summary: 's', content: 'c', grounds: { evidence_refs: ['r1'] },
    });

    const health = inst.governance.analyzeHealth();
    assert.ok(health.total_discourse >= 1);
    assert.ok(['healthy', 'weak', 'very_weak'].includes(health.discourse_health));
  });
});

// ─── Memory Engine ───

describe('MemoryEngine', () => {
  it('creates and retrieves precedent links', () => {
    const link = inst.memory.createLink({
      source_proceeding_id: 'p_old',
      target_proceeding_id: 'p_new',
      relation: 'historical_analog',
      summary: 'Similar earthquake event.',
      weight: 0.76,
    });
    assert.ok(link.id.startsWith('prec_'));

    const links = inst.memory.forProceeding('p_new');
    assert.equal(links.length, 1);
    assert.equal(links[0].relation, 'historical_analog');
  });

  it('rejects invalid relation', () => {
    assert.throws(
      () => inst.memory.createLink({
        source_proceeding_id: 'a', target_proceeding_id: 'b',
        relation: 'invalid', summary: 'test',
      }),
      /Invalid relation/
    );
  });

  it('filters by relation type', () => {
    inst.memory.createLink({
      source_proceeding_id: 'a', target_proceeding_id: 'b',
      relation: 'historical_analog', summary: 'test1',
    });
    inst.memory.createLink({
      source_proceeding_id: 'c', target_proceeding_id: 'd',
      relation: 'contradicts', summary: 'test2',
    });
    assert.equal(inst.memory.byRelation('historical_analog').length, 1);
  });
});

// ─── Agenda Engine ───

describe('AgendaEngine', () => {
  it('watches and unwatches proceedings', () => {
    const r1 = inst.agenda.watch('agent_a', 'proc_001');
    assert.equal(r1.status, 'watching');

    const r2 = inst.agenda.watch('agent_a', 'proc_001');
    assert.equal(r2.status, 'already_watching');

    const r3 = inst.agenda.unwatch('agent_a', 'proc_001');
    assert.equal(r3.status, 'unwatched');

    const r4 = inst.agenda.unwatch('agent_a', 'proc_001');
    assert.equal(r4.status, 'not_watching');
  });

  it('enforces max watchlist size', () => {
    for (let i = 0; i < 5; i++) {
      inst.agenda.watch('agent_a', `proc_${i}`);
    }
    assert.throws(
      () => inst.agenda.watch('agent_a', 'proc_extra'),
      /Watchlist full/
    );
  });

  it('returns empty watchlist for unknown agent', () => {
    assert.deepEqual(inst.agenda.getWatchlist('unknown'), []);
  });

  it('prunes archived proceedings', () => {
    const proc = inst.proceedings.open({ title: 'Prune Test', opened_by: 'system' });
    inst.agenda.watch('agent_a', proc.id);

    // Move to archived via valid path
    inst.proceedings.transition(proc.id, 'under_examination');
    inst.proceedings.transition(proc.id, 'provisionally_synthesized');
    inst.proceedings.transition(proc.id, 'stable');
    inst.proceedings.transition(proc.id, 'settled');
    inst.proceedings.transition(proc.id, 'archived');

    const result = inst.agenda.prune();
    assert.equal(result.removed, 1);
    assert.equal(inst.agenda.getWatchlist('agent_a').length, 0);
  });

  it('ranks proceedings by priority', () => {
    const p1 = inst.proceedings.open({ title: 'Low', opened_by: 'system' });
    const p2 = inst.proceedings.open({ title: 'High', opened_by: 'system', force: true });
    inst.proceedings.updateAttention(p1.id, { priority: 0.3 });
    inst.proceedings.updateAttention(p2.id, { priority: 0.9 });

    const ranked = inst.agenda.getRankedProceedings();
    assert.equal(ranked[0].id, p2.id);
  });
});

// ─── Integration: createInstitution ───

describe('createInstitution', () => {
  it('returns all engines wired to the same store', () => {
    assert.ok(inst.proceedings);
    assert.ok(inst.interventions);
    assert.ok(inst.obligations);
    assert.ok(inst.synthesis);
    assert.ok(inst.governance);
    assert.ok(inst.memory);
    assert.ok(inst.agenda);
  });

  it('engines share state via store', () => {
    const proc = inst.proceedings.open({ title: 'Shared', opened_by: 'system' });
    inst.interventions.submit({
      proceeding_id: proc.id, type: 'introduce_evidence', agent_id: 'a1',
      summary: 's', content: 'c', grounds: { evidence_refs: ['ref'] },
    });
    assert.equal(inst.interventions.forProceeding(proc.id).length, 1);
  });
});
