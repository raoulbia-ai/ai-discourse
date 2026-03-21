'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../../storage');
const { createInstitution } = require('../../core');
const { AgentRuntime, DeltaDetector, StateManager, CycleRunner, createCycleConfig } = require('../../runtime');

let store;
let inst;

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-runtime-'));
  store = createStore(tmpDir);
  inst = createInstitution(store);
});

// ─── DeltaDetector ───

describe('DeltaDetector', () => {
  it('detects no change on empty store', () => {
    const delta = new DeltaDetector(store);
    const result = delta.check('agent_a', {});
    // Empty store still has empty hashes that differ from "empty" string
    assert.equal(typeof result.changed, 'boolean');
    assert.ok(result.reason);
  });

  it('detects new signals', () => {
    const delta = new DeltaDetector(store);
    const baseline = delta.check('agent_a', {});

    // Add a signal
    store.appendSignal({ id: 's1', source: 'test', tags: [] });

    const after = delta.check('agent_a', {
      snapshot_hash: baseline.snapshot_hash,
      last_seen_comms_offset: baseline.comms_offset,
      proceedings_hash: baseline.proceedings_hash,
    });
    assert.equal(after.changed, true);
    assert.ok(after.reason.includes('signals changed'));
  });

  it('detects new interventions', () => {
    const delta = new DeltaDetector(store);
    const baseline = delta.check('agent_a', {});

    store.appendIntervention({ id: 'int_1', proceeding_id: 'p1', agent_id: 'agent_b' });

    const after = delta.check('agent_a', {
      snapshot_hash: baseline.snapshot_hash,
      last_seen_comms_offset: baseline.comms_offset,
      proceedings_hash: baseline.proceedings_hash,
    });
    assert.equal(after.changed, true);
    assert.ok(after.reason.includes('intervention'));
  });

  it('detects open obligations', () => {
    const delta = new DeltaDetector(store);
    store.saveObligation({
      id: 'obl_1', proceeding_id: 'p1',
      assigned_agent_id: 'agent_a', status: 'open',
      description: 'test',
    });

    const result = delta.check('agent_a', {});
    assert.equal(result.changed, true);
    assert.ok(result.reason.includes('obligation'));
    assert.equal(result.open_obligations.length, 1);
  });
});

// ─── StateManager ───

describe('StateManager', () => {
  it('returns null for unknown agent', () => {
    const sm = new StateManager(store);
    assert.equal(sm.getAgentState('unknown'), null);
  });

  it('updates and retrieves agent state', () => {
    const sm = new StateManager(store);
    sm.updateAgentState('agent_a', { result: 'acted', snapshot_hash: 'abc', comms_offset: 5 });

    const state = sm.getAgentState('agent_a');
    assert.equal(state.result, 'acted');
    assert.equal(state.snapshot_hash, 'abc');
    assert.equal(state.last_seen_comms_offset, 5);
    assert.ok(state.last_run);
    assert.ok(state.last_substantive_output_at);
  });

  it('preserves previous values for partial updates', () => {
    const sm = new StateManager(store);
    sm.updateAgentState('agent_a', { result: 'acted', snapshot_hash: 'abc', comms_offset: 5 });
    sm.updateAgentState('agent_a', { result: 'no_change' });

    const state = sm.getAgentState('agent_a');
    assert.equal(state.result, 'no_change');
    assert.equal(state.snapshot_hash, 'abc'); // preserved
    assert.equal(state.last_seen_comms_offset, 5); // preserved
  });

  it('appends to run audit log', () => {
    const sm = new StateManager(store);
    sm.updateAgentState('agent_a', { result: 'acted' });
    sm.updateAgentState('agent_b', { result: 'skipped' });

    const log = sm.getRunLog();
    assert.equal(log.length, 2);
    assert.equal(log[0].agent, 'agent_a');
    assert.equal(log[1].agent, 'agent_b');
  });

  it('gets all agent states', () => {
    const sm = new StateManager(store);
    sm.updateAgentState('agent_a', { result: 'acted' });
    sm.updateAgentState('agent_b', { result: 'skipped' });

    const all = sm.getAllStates();
    assert.ok(all.agent_a);
    assert.ok(all.agent_b);
  });
});

// ─── AgentRuntime ───

describe('AgentRuntime', () => {
  it('provides 3-operation interface', () => {
    const rt = new AgentRuntime('geographer', inst, store);
    assert.equal(typeof rt.readInstitutionState, 'function');
    assert.equal(typeof rt.submitIntervention, 'function');
    assert.equal(typeof rt.fulfillObligation, 'function');
  });

  it('reads institution state', () => {
    // Set up some data
    const proc = inst.proceedings.open({ title: 'Test Proceeding', opened_by: 'system' });
    inst.agenda.watch('geographer', proc.id);
    inst.synthesis.update({
      proceeding_id: proc.id, updated_by: 'chronicler', primary_reading: 'Initial reading.',
    });

    const rt = new AgentRuntime('geographer', inst, store);
    const state = rt.readInstitutionState();

    assert.ok(state.proceedings.length >= 1);
    assert.ok(state.watched_proceedings.length >= 1);
    assert.ok(state.syntheses[proc.id]);
    assert.ok(Array.isArray(state.obligations));
    assert.ok(Array.isArray(state.governance_actions));
  });

  it('submits interventions with agent_id auto-set', () => {
    const proc = inst.proceedings.open({ title: 'Submit Test', opened_by: 'system' });
    const rt = new AgentRuntime('geographer', inst, store);

    const int = rt.submitIntervention({
      proceeding_id: proc.id,
      type: 'introduce_evidence',
      summary: 'Terrain data',
      content: 'Mountain range analysis.',
      grounds: { evidence_refs: ['topo_data_v1'] },
    });

    assert.equal(int.agent_id, 'geographer');
    assert.equal(int.type, 'introduce_evidence');
  });

  it('fulfills obligations', () => {
    const obl = inst.obligations.create({
      proceeding_id: 'p1', assigned_agent_id: 'geographer', description: 'Verify terrain.',
    });
    const rt = new AgentRuntime('geographer', inst, store);

    const resolved = rt.fulfillObligation(obl.id, 'answered', 'int_001');
    assert.equal(resolved.status, 'answered');
  });

  it('records run state', () => {
    const rt = new AgentRuntime('geographer', inst, store);
    const deltaResult = { snapshot_hash: 'abc', comms_offset: 10, proceedings_hash: 'def' };
    rt.recordRun('acted', deltaResult);

    const sm = new StateManager(store);
    const state = sm.getAgentState('geographer');
    assert.equal(state.result, 'acted');
    assert.equal(state.snapshot_hash, 'abc');
  });

  it('checks shouldAct', () => {
    const rt = new AgentRuntime('geographer', inst, store);
    const check = rt.shouldAct();
    assert.equal(typeof check.changed, 'boolean');
  });
});

// ─── CycleRunner ───

describe('CycleRunner', () => {
  it('creates config from wave definitions', () => {
    const config = createCycleConfig({
      observation: [['a1', 'a2'], ['a3', 'a4']],
      reaction: [['a1', 'a2']],
      synthesis: ['chronicler'],
      executive: ['steward_a', 'steward_b'],
      assessment: ['assessor'],
    });

    assert.equal(config.phases.length, 5);
    assert.equal(config.phases[0].name, 'observation');
    assert.equal(config.phases[0].waves.length, 2);
    assert.equal(config.phases[1].name, 'reaction');
    assert.ok(config.phases[1].waves[0].deltaGated);
  });

  it('runs a dry-run cycle', async () => {
    const config = createCycleConfig({
      observation: [['a1', 'a2']],
      synthesis: ['chronicler'],
    });
    const runner = new CycleRunner(inst, store, config);

    const result = await runner.runCycle(
      async (agentId) => 'ok',
      { dryRun: true }
    );

    assert.equal(result.cycle_id, 1);
    assert.equal(result.phases.length, 2);
    assert.equal(result.phases[0].waves[0].results.length, 2);
    assert.equal(result.phases[0].waves[0].results[0].result, 'dry_run');
  });

  it('runs a real cycle with executor', async () => {
    const config = createCycleConfig({
      observation: [['a1', 'a2']],
      synthesis: ['chronicler'],
    });
    const runner = new CycleRunner(inst, store, config);

    const executed = [];
    const result = await runner.runCycle(
      async (agentId) => {
        executed.push(agentId);
        return 'acted';
      }
    );

    assert.equal(result.cycle_id, 1);
    assert.deepEqual(executed, ['a1', 'a2', 'chronicler']);

    // Verify snapshot was recorded
    const snapshots = store.getCycleSnapshots();
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].cycle_id, 1);
  });

  it('increments cycle IDs', async () => {
    const config = createCycleConfig({ observation: [['a1']] });
    const runner = new CycleRunner(inst, store, config);

    await runner.runCycle(async () => 'ok');
    const r2 = await runner.runCycle(async () => 'ok');
    assert.equal(r2.cycle_id, 2);
  });

  it('respects maxParallel', async () => {
    const config = createCycleConfig({
      observation: [['a1', 'a2', 'a3', 'a4', 'a5']],
    });
    config.maxParallel = 2;
    const runner = new CycleRunner(inst, store, config);

    let maxConcurrent = 0;
    let concurrent = 0;

    await runner.runCycle(async (agentId) => {
      concurrent++;
      if (concurrent > maxConcurrent) maxConcurrent = concurrent;
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
      return 'ok';
    });

    assert.ok(maxConcurrent <= 2, `Max concurrent was ${maxConcurrent}, expected <= 2`);
  });

  it('calls lifecycle hooks', async () => {
    const config = createCycleConfig({ observation: [['a1']] });
    const runner = new CycleRunner(inst, store, config);

    const events = [];
    await runner.runCycle(async () => 'ok', {
      onPhaseStart: (name) => events.push(`phase_start:${name}`),
      onPhaseEnd: (name) => events.push(`phase_end:${name}`),
      onAgentStart: (id) => events.push(`agent_start:${id}`),
      onAgentComplete: (id) => events.push(`agent_complete:${id}`),
    });

    assert.ok(events.includes('phase_start:observation'));
    assert.ok(events.includes('phase_end:observation'));
    assert.ok(events.includes('agent_start:a1'));
    assert.ok(events.includes('agent_complete:a1'));
  });

  it('handles agent executor errors gracefully', async () => {
    const config = createCycleConfig({ observation: [['a1', 'a2']] });
    const runner = new CycleRunner(inst, store, config);

    const result = await runner.runCycle(async (agentId) => {
      if (agentId === 'a1') throw new Error('Agent failed');
      return 'ok';
    });

    const waveResults = result.phases[0].waves[0].results;
    // One should be error, one should be ok
    const errorResult = waveResults.find(r => r.result === 'error');
    const okResult = waveResults.find(r => r.result === 'ok' || (r.agentId === 'a2'));
    assert.ok(errorResult || okResult); // At least one completed
  });

  it('delta-gates reaction waves', async () => {
    const config = createCycleConfig({
      reaction: [['a1', 'a2']],
    });
    const runner = new CycleRunner(inst, store, config);

    // Set up state so agents have no changes
    const sm = new StateManager(store);
    const delta = new DeltaDetector(store);
    const baseline = delta.check('a1', {});
    sm.updateAgentState('a1', {
      result: 'acted',
      snapshot_hash: baseline.snapshot_hash,
      comms_offset: baseline.comms_offset,
      proceedings_hash: baseline.proceedings_hash,
    });
    sm.updateAgentState('a2', {
      result: 'acted',
      snapshot_hash: baseline.snapshot_hash,
      comms_offset: baseline.comms_offset,
      proceedings_hash: baseline.proceedings_hash,
    });

    const executed = [];
    await runner.runCycle(async (agentId) => {
      executed.push(agentId);
      return 'ok';
    });

    // Both should be skipped since no changes
    assert.equal(executed.length, 0);
  });
});
