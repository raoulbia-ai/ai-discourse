'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../../storage');

let store;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-test-'));
  store = createStore(tmpDir);
});

describe('FileStore', () => {

  describe('Proceedings', () => {
    it('saves and retrieves a proceeding', () => {
      const proc = { id: 'proc_001', title: 'Test', status: 'opened', created_at: 'now', opened_by: 'system' };
      store.saveProceeding(proc);
      assert.deepEqual(store.getProceeding('proc_001'), proc);
    });

    it('updates an existing proceeding', () => {
      const proc = { id: 'proc_001', title: 'Test', status: 'opened' };
      store.saveProceeding(proc);
      store.saveProceeding({ ...proc, status: 'under_examination' });
      assert.equal(store.getProceeding('proc_001').status, 'under_examination');
    });

    it('throws for missing proceeding', () => {
      assert.throws(() => store.getProceeding('nonexistent'), /not found/);
    });

    it('lists all proceedings', () => {
      store.saveProceeding({ id: 'p1', title: 'A' });
      store.saveProceeding({ id: 'p2', title: 'B' });
      assert.equal(store.getProceedings().length, 2);
    });
  });

  describe('Interventions', () => {
    it('appends and reads interventions', () => {
      store.appendIntervention({ id: 'int_001', proceeding_id: 'proc_001', type: 'interpret', agent_id: 'a1' });
      store.appendIntervention({ id: 'int_002', proceeding_id: 'proc_001', type: 'challenge', agent_id: 'a2' });
      store.appendIntervention({ id: 'int_003', proceeding_id: 'proc_002', type: 'interpret', agent_id: 'a1' });

      assert.equal(store.readInterventions().length, 3);
      assert.equal(store.readInterventions({ proceeding_id: 'proc_001' }).length, 2);
      assert.equal(store.readInterventions({ agent_id: 'a2' }).length, 1);
      assert.equal(store.readInterventions({ type: 'interpret' }).length, 2);
    });

    it('supports offset and limit', () => {
      for (let i = 0; i < 5; i++) {
        store.appendIntervention({ id: `int_${i}`, proceeding_id: 'p1' });
      }
      assert.equal(store.readInterventions({ offset: 2 }).length, 3);
      assert.equal(store.readInterventions({ limit: 2 }).length, 2);
    });

    it('returns empty array when no file exists', () => {
      assert.deepEqual(store.readInterventions(), []);
    });
  });

  describe('Obligations', () => {
    it('saves and updates obligations', () => {
      const obl = { id: 'obl_001', proceeding_id: 'proc_001', status: 'open' };
      store.saveObligation(obl);
      assert.equal(store.getObligations().length, 1);

      store.saveObligation({ ...obl, status: 'answered' });
      assert.equal(store.getObligations().length, 1);
      assert.equal(store.getObligations()[0].status, 'answered');
    });
  });

  describe('Signals', () => {
    it('appends and filters signals', () => {
      store.appendSignal({ id: 's1', source: 'usgs', tags: ['earthquake'] });
      store.appendSignal({ id: 's2', source: 'bbc', tags: ['news'] });

      assert.equal(store.readSignals().length, 2);
      assert.equal(store.readSignals({ source: 'usgs' }).length, 1);
      assert.equal(store.readSignals({ tag: 'earthquake' }).length, 1);
    });
  });

  describe('Synthesis', () => {
    it('appends and filters by proceeding', () => {
      store.appendSynthesis({ id: 'syn_1', proceeding_id: 'p1', version: 1 });
      store.appendSynthesis({ id: 'syn_2', proceeding_id: 'p1', version: 2 });
      store.appendSynthesis({ id: 'syn_3', proceeding_id: 'p2', version: 1 });

      assert.equal(store.getSyntheses('p1').length, 2);
      assert.equal(store.getSyntheses('p2').length, 1);
    });
  });

  describe('Agent Roles', () => {
    it('saves and retrieves roles', () => {
      store.saveAgentRole({ id: 'geo', kind: 'analytic', capabilities: [], intervention_rights: [] });
      assert.equal(store.getAgentRole('geo').kind, 'analytic');
      assert.equal(store.getAgentRoles().length, 1);
    });

    it('throws for missing role', () => {
      assert.throws(() => store.getAgentRole('nonexistent'), /not found/);
    });
  });

  describe('Governance Rules', () => {
    it('saves and retrieves rules', () => {
      store.saveRule({ id: 'rule_1', name: 'Test', enforcement: { mode: 'hard_block' } });
      assert.equal(store.getRules().length, 1);
    });
  });

  describe('Precedent Links', () => {
    it('saves and retrieves by proceeding', () => {
      store.savePrecedentLink({ id: 'prec_1', source_proceeding_id: 'p_old', target_proceeding_id: 'p1', relation: 'historical_analog', summary: 'test' });
      assert.equal(store.getPrecedentLinks('p1').length, 1);
      assert.equal(store.getPrecedentLinks('p_old').length, 1);
      assert.equal(store.getPrecedentLinks('p_other').length, 0);
    });
  });

  describe('Closure Records', () => {
    it('saves and retrieves by proceeding', () => {
      store.saveClosureRecord({ id: 'close_1', proceeding_id: 'p1', closure_type: 'provisional_settlement' });
      assert.deepEqual(store.getClosureRecord('p1').id, 'close_1');
      assert.equal(store.getClosureRecord('p_other'), null);
    });
  });

  describe('Cycle Snapshots', () => {
    it('appends and retrieves cycle snapshots', () => {
      store.appendCycleSnapshot({ cycle_id: 1, started_at: 't1', ended_at: 't2' });
      store.appendCycleSnapshot({ cycle_id: 2, started_at: 't3', ended_at: 't4' });

      assert.equal(store.getCycleSnapshots().length, 2);
      assert.equal(store.getLatestCycle().cycle_id, 2);
    });

    it('returns null for latest cycle when empty', () => {
      assert.equal(store.getLatestCycle(), null);
    });
  });
});
