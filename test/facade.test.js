'use strict';

/**
 * Public Contract Tests — uses ONLY the public facade API.
 * No access to institution.engines, institution.store, or internal modules.
 *
 * If a test can't be written without internals, the public API is missing something.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');

let institution;

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-facade-'));
  const store = createStore(tmpDir);
  institution = createInstitution({ store });
});

describe('Public Contract', () => {

  describe('surface is sealed', () => {
    it('does not expose engines', () => {
      assert.equal(institution.engines, undefined);
    });

    it('does not expose store', () => {
      assert.equal(institution.store, undefined);
    });

    it('exposes minimal runtime contract', () => {
      // These 7 methods are the minimal contract — sufficient for any application
      const minimal = [
        'openProceeding', 'submitIntervention', 'getSynthesis',
        'registerAgent', 'runCycle',
        'listInterventions', 'ingestSignal',
      ];
      for (const method of minimal) {
        assert.equal(typeof institution[method], 'function', `Missing minimal method: ${method}`);
      }
    });

    it('exposes extended public API', () => {
      // These are public and stable but not required for basic operation
      const extended = [
        'getProceeding', 'listProceedings', 'transitionProceeding',
        'updateSynthesis',
        'createObligation', 'resolveObligation',
        'getAgentIds',
        'getAgenda', 'updateAttention',
        'addRule', 'getHealth',
      ];
      for (const method of extended) {
        assert.equal(typeof institution[method], 'function', `Missing extended method: ${method}`);
      }
    });
  });

  describe('createInstitution signature', () => {
    it('accepts { store } object form', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-sig-'));
      const store = createStore(tmpDir);
      const inst = createInstitution({ store });
      assert.equal(typeof inst.openProceeding, 'function');
    });

    it('accepts { store, maxParallelAgents } form', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-sig-'));
      const store = createStore(tmpDir);
      const inst = createInstitution({ store, maxParallelAgents: 2 });
      assert.equal(typeof inst.openProceeding, 'function');
    });

    it('supports legacy two-arg form', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-sig-'));
      const store = createStore(tmpDir);
      const inst = createInstitution(store);
      assert.equal(typeof inst.openProceeding, 'function');
    });
  });

  describe('openProceeding', () => {
    it('opens with minimal args', () => {
      const proc = institution.openProceeding({ title: 'Test Matter' });
      assert.ok(proc.id.startsWith('proc_'));
      assert.equal(proc.status, 'opened');
      assert.equal(proc.opened_by, 'system');
    });

    it('opens with framing', () => {
      const proc = institution.openProceeding({
        title: 'Framed Matter',
        framing: { primary_question: 'What happened?', posture: 'investigation' },
      });
      assert.equal(proc.framing.primary_question, 'What happened?');
    });

    it('rejects duplicate titles', () => {
      institution.openProceeding({ title: 'Unique Topic' });
      assert.throws(
        () => institution.openProceeding({ title: 'Unique Topic' }),
        /too similar/
      );
    });
  });

  describe('getProceeding + listProceedings', () => {
    it('retrieves by ID', () => {
      const proc = institution.openProceeding({ title: 'Retrieve Test' });
      const found = institution.getProceeding(proc.id);
      assert.equal(found.title, 'Retrieve Test');
    });

    it('lists with status filter', () => {
      institution.openProceeding({ title: 'Chile Earthquake' });
      const p2 = institution.openProceeding({ title: 'Sudan Conflict' });
      institution.transitionProceeding(p2.id, 'under_examination');

      assert.equal(institution.listProceedings({ status: 'opened' }).length, 1);
      assert.equal(institution.listProceedings({ status: 'under_examination' }).length, 1);
      assert.equal(institution.listProceedings().length, 2);
    });
  });

  describe('transitionProceeding', () => {
    it('transitions through valid states', () => {
      const proc = institution.openProceeding({ title: 'Transition Test' });
      const updated = institution.transitionProceeding(proc.id, 'under_examination');
      assert.equal(updated.status, 'under_examination');
    });

    it('rejects invalid transitions', () => {
      const proc = institution.openProceeding({ title: 'Bad Transition' });
      assert.throws(
        () => institution.transitionProceeding(proc.id, 'settled'),
        /Cannot transition/
      );
    });
  });

  describe('submitIntervention + listInterventions', () => {
    it('submits and lists', () => {
      const proc = institution.openProceeding({ title: 'Intervention Test' });
      institution.submitIntervention({
        proceeding_id: proc.id,
        type: 'introduce_evidence',
        agent_id: 'tester',
        summary: 'Test evidence',
        content: 'Details.',
        grounds: { evidence_refs: ['test_ref'] },
      });

      const list = institution.listInterventions(proc.id);
      assert.equal(list.length, 1);
      assert.equal(list[0].agent_id, 'tester');
      assert.equal(list[0].type, 'introduce_evidence');
    });

    it('filters by agent_id', () => {
      const proc = institution.openProceeding({ title: 'Filter Test' });
      institution.submitIntervention({
        proceeding_id: proc.id, type: 'introduce_evidence', agent_id: 'a1',
        summary: 's', content: 'c', grounds: { evidence_refs: ['r1'] },
      });
      institution.submitIntervention({
        proceeding_id: proc.id, type: 'introduce_evidence', agent_id: 'a2',
        summary: 's', content: 'c', grounds: { evidence_refs: ['r2'] },
      });

      assert.equal(institution.listInterventions(proc.id, { agent_id: 'a1' }).length, 1);
    });

    it('enforces governance rules', () => {
      institution.addRule({
        name: 'Block ungrounded escalation',
        category: 'intervention_validity',
        description: 'Escalation needs grounds.',
        applies_to: ['escalate'],
        enforcement: { mode: 'hard_block', message: 'Need grounds.' },
      });

      const proc = institution.openProceeding({ title: 'Governance Test' });
      assert.throws(
        () => institution.submitIntervention({
          proceeding_id: proc.id, type: 'escalate', agent_id: 'a',
          summary: 's', content: 'c',
        }),
        /Governance violation|requires grounds/
      );
    });
  });

  describe('getSynthesis + updateSynthesis', () => {
    it('returns null when no synthesis exists', () => {
      assert.equal(institution.getSynthesis('nonexistent'), null);
    });

    it('returns latest after update', () => {
      const proc = institution.openProceeding({ title: 'Synthesis Test' });
      institution.updateSynthesis({
        proceeding_id: proc.id,
        updated_by: 'chronicler',
        primary_reading: 'First reading.',
      });
      institution.updateSynthesis({
        proceeding_id: proc.id,
        updated_by: 'chronicler',
        primary_reading: 'Revised reading.',
      });
      const syn = institution.getSynthesis(proc.id);
      assert.equal(syn.version, 2);
      assert.equal(syn.primary_reading, 'Revised reading.');
    });
  });

  describe('ingestSignal', () => {
    it('ingests with auto-generated ID', () => {
      const sig = institution.ingestSignal({
        type: 'alert', source: 'test', timestamp: 'now',
        title: 'Test Signal', summary: 'Something happened.',
      });
      assert.ok(sig.id.startsWith('sig_'));
      assert.ok(sig.ingested_at);
    });
  });

  describe('createObligation + resolveObligation', () => {
    it('creates and resolves', () => {
      const proc = institution.openProceeding({ title: 'Obligation Test' });
      const obl = institution.createObligation({
        proceeding_id: proc.id,
        assigned_agent_id: 'analyst',
        description: 'Check data.',
      });
      assert.equal(obl.status, 'open');

      const resolved = institution.resolveObligation(obl.id, 'answered');
      assert.equal(resolved.status, 'answered');
    });
  });

  describe('updateAttention + getAgenda', () => {
    it('ranks proceedings by priority', () => {
      const p1 = institution.openProceeding({ title: 'Low Priority Issue' });
      const p2 = institution.openProceeding({ title: 'High Priority Crisis' });
      institution.updateAttention(p1.id, { priority: 0.2 });
      institution.updateAttention(p2.id, { priority: 0.9 });

      const agenda = institution.getAgenda();
      assert.equal(agenda[0].id, p2.id);
    });
  });

  describe('getHealth', () => {
    it('returns discourse health', () => {
      const health = institution.getHealth();
      assert.equal(typeof health.discourse_ratio, 'number');
      assert.ok(['healthy', 'weak', 'very_weak'].includes(health.discourse_health));
    });
  });

  describe('registerAgent + runCycle', () => {
    it('rejects agents without evaluate', () => {
      assert.throws(
        () => institution.registerAgent({ id: 'bad' }),
        /must implement evaluate/
      );
    });

    it('throws when no agents registered', async () => {
      await assert.rejects(
        () => institution.runCycle(),
        /No agents registered/
      );
    });

    it('runs cycle with registered agents', async () => {
      const proc = institution.openProceeding({ title: 'Cycle Test' });

      institution.registerAgent({
        id: 'test-agent',
        async evaluate(context) {
          return {
            interventions: [{
              proceeding_id: proc.id,
              type: 'introduce_evidence',
              summary: 'Agent found something',
              content: 'Evidence from automated analysis.',
              grounds: { evidence_refs: ['auto_scan_v1'] },
            }],
            obligations: [],
          };
        },
      });

      const result = await institution.runCycle();

      // Public summary — no internal phases/waves
      assert.equal(result.cycle_id, 1);
      assert.ok(result.started_at);
      assert.ok(result.ended_at);
      assert.equal(result.agents['test-agent'], 'acted');
      assert.equal(result.interventions_submitted, 1);
      assert.equal(result.obligations_created, 0);
      assert.deepEqual(result.errors, []);

      // Verify via public API
      const interventions = institution.listInterventions(proc.id);
      assert.equal(interventions.length, 1);
      assert.equal(interventions[0].agent_id, 'test-agent');
    });

    it('returns stable summary with multiple agents', async () => {
      const proc = institution.openProceeding({ title: 'Multi Agent' });
      const noop = { id: 'noop', evaluate: async () => ({ interventions: [], obligations: [] }) };
      const actor = {
        id: 'actor',
        evaluate: async () => ({
          interventions: [{
            proceeding_id: proc.id, type: 'introduce_evidence', summary: 's', content: 'c',
            grounds: { evidence_refs: ['r1'] },
          }],
          obligations: [{
            proceeding_id: proc.id, assigned_agent_id: 'noop', description: 'do something',
          }],
        }),
      };

      institution.registerAgent(noop);
      institution.registerAgent(actor);

      const result = await institution.runCycle();
      assert.equal(result.agents.noop, 'acted');
      assert.equal(result.agents.actor, 'acted');
      assert.equal(result.interventions_submitted, 1);
      assert.equal(result.obligations_created, 1);
    });

    it('getAgentIds returns registered agents', () => {
      institution.registerAgent({ id: 'a1', evaluate: async () => ({ interventions: [], obligations: [] }) });
      institution.registerAgent({ id: 'a2', evaluate: async () => ({ interventions: [], obligations: [] }) });
      assert.deepEqual(institution.getAgentIds(), ['a1', 'a2']);
    });
  });
});
