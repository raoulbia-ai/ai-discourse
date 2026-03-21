'use strict';

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
  institution = createInstitution(store);
});

describe('Public Facade', () => {

  describe('createInstitution', () => {
    it('returns institution with public API methods', () => {
      assert.equal(typeof institution.openProceeding, 'function');
      assert.equal(typeof institution.submitIntervention, 'function');
      assert.equal(typeof institution.getSynthesis, 'function');
      assert.equal(typeof institution.registerAgent, 'function');
      assert.equal(typeof institution.runCycle, 'function');
      assert.equal(typeof institution.getProceeding, 'function');
      assert.equal(typeof institution.listProceedings, 'function');
      assert.equal(typeof institution.ingestSignal, 'function');
      assert.equal(typeof institution.getAgenda, 'function');
      assert.equal(typeof institution.getHealth, 'function');
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
  });

  describe('submitIntervention', () => {
    it('submits through public API', () => {
      const proc = institution.openProceeding({ title: 'Intervention Test' });
      const int = institution.submitIntervention({
        proceeding_id: proc.id,
        type: 'introduce_evidence',
        agent_id: 'tester',
        summary: 'Test evidence',
        content: 'Details.',
        grounds: { evidence_refs: ['test_ref'] },
      });
      assert.equal(int.type, 'introduce_evidence');
      assert.equal(int.agent_id, 'tester');
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

  describe('getSynthesis', () => {
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
      const syn = institution.getSynthesis(proc.id);
      assert.equal(syn.version, 1);
      assert.equal(syn.primary_reading, 'First reading.');
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
      assert.equal(result.cycle_id, 1);

      // Verify intervention was recorded
      const interventions = institution.engines.interventions.forProceeding(proc.id);
      assert.equal(interventions.length, 1);
      assert.equal(interventions[0].agent_id, 'test-agent');
    });

    it('getAgentIds returns registered agents', () => {
      institution.registerAgent({ id: 'a1', evaluate: async () => ({ interventions: [], obligations: [] }) });
      institution.registerAgent({ id: 'a2', evaluate: async () => ({ interventions: [], obligations: [] }) });
      assert.deepEqual(institution.getAgentIds(), ['a1', 'a2']);
    });
  });

  describe('obligations through facade', () => {
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

  describe('getAgenda', () => {
    it('returns ranked proceedings', () => {
      const p1 = institution.openProceeding({ title: 'Low Priority' });
      const p2 = institution.openProceeding({ title: 'High Priority' });
      institution.engines.proceedings.updateAttention(p1.id, { priority: 0.2 });
      institution.engines.proceedings.updateAttention(p2.id, { priority: 0.9 });

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
});
