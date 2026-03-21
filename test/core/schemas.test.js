'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validate, assertValid, SCHEMA_MAP } = require('../../core/validate');

describe('Schema validation', () => {

  describe('loadSchema coverage', () => {
    it('loads all 10 schemas without error', () => {
      for (const type of Object.keys(SCHEMA_MAP)) {
        const result = validate(type, {});
        assert.equal(typeof result.valid, 'boolean');
      }
    });

    it('rejects unknown type', () => {
      assert.throws(() => validate('unknown_type', {}), /Unknown record type/);
    });
  });

  describe('Signal', () => {
    const valid = {
      id: 'sig_001',
      type: 'event_report',
      source: 'usgs',
      timestamp: '2026-03-16T10:22:00Z',
      title: 'Earthquake off Chile',
      summary: 'Magnitude 7.1 earthquake reported.',
      tags: ['earthquake', 'chile'],
    };

    it('accepts valid signal', () => {
      const result = validate('signal', valid);
      assert.equal(result.valid, true);
    });

    it('rejects signal missing required fields', () => {
      const result = validate('signal', { id: 'sig_001' });
      assert.equal(result.valid, false);
      assert.ok(result.errors.length >= 4);
    });
  });

  describe('Proceeding', () => {
    const valid = {
      id: 'proc_001',
      title: 'Chile Earthquake Impact',
      status: 'under_examination',
      created_at: '2026-03-16T10:30:00Z',
      opened_by: 'system',
    };

    it('accepts valid proceeding', () => {
      assert.equal(validate('proceeding', valid).valid, true);
    });

    it('rejects invalid status', () => {
      const result = validate('proceeding', { ...valid, status: 'invalid_state' });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('status')));
    });
  });

  describe('Intervention', () => {
    const valid = {
      id: 'int_001',
      proceeding_id: 'proc_001',
      type: 'interpret',
      agent_id: 'geographer',
      created_at: '2026-03-16T10:42:00Z',
      summary: 'Subduction-zone event assessment.',
      content: 'Detailed analysis text.',
    };

    it('accepts valid intervention', () => {
      assert.equal(validate('intervention', valid).valid, true);
    });

    it('rejects invalid type', () => {
      const result = validate('intervention', { ...valid, type: 'chat' });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('type')));
    });

    it('rejects missing proceeding_id', () => {
      const { proceeding_id, ...missing } = valid;
      const result = validate('intervention', missing);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('proceeding_id')));
    });
  });

  describe('Obligation', () => {
    const valid = {
      id: 'obl_001',
      proceeding_id: 'proc_001',
      assigned_agent_id: 'signal-analyst',
      status: 'open',
      description: 'Verify seismic depth.',
      created_at: '2026-03-16T10:43:00Z',
    };

    it('accepts valid obligation', () => {
      assert.equal(validate('obligation', valid).valid, true);
    });

    it('rejects invalid status', () => {
      const result = validate('obligation', { ...valid, status: 'pending' });
      assert.equal(result.valid, false);
    });
  });

  describe('Synthesis', () => {
    const valid = {
      id: 'syn_001',
      proceeding_id: 'proc_001',
      version: 1,
      created_at: '2026-03-16T12:05:00Z',
      updated_by: 'chronicler',
      primary_reading: 'Moderate earthquake with infrastructure risk.',
    };

    it('accepts valid synthesis', () => {
      assert.equal(validate('synthesis', valid).valid, true);
    });

    it('rejects non-integer version', () => {
      const result = validate('synthesis', { ...valid, version: 1.5 });
      assert.equal(result.valid, false);
    });
  });

  describe('ClosureRecord', () => {
    const valid = {
      id: 'close_001',
      proceeding_id: 'proc_001',
      closure_type: 'provisional_settlement',
      closed_at: '2026-03-18T18:10:00Z',
      closed_by: 'settlement-steward',
      final_synthesis_id: 'syn_009',
      rationale: 'Sufficiently examined.',
    };

    it('accepts valid closure record', () => {
      assert.equal(validate('closure_record', valid).valid, true);
    });

    it('rejects invalid closure_type', () => {
      const result = validate('closure_record', { ...valid, closure_type: 'abandoned' });
      assert.equal(result.valid, false);
    });
  });

  describe('AgentRole', () => {
    const valid = {
      id: 'geographer',
      kind: 'analytic',
      capabilities: ['interpret_geospatial_events'],
      intervention_rights: ['interpret', 'challenge'],
    };

    it('accepts valid agent role', () => {
      assert.equal(validate('agent_role', valid).valid, true);
    });

    it('rejects invalid kind', () => {
      const result = validate('agent_role', { ...valid, kind: 'chatbot' });
      assert.equal(result.valid, false);
    });
  });

  describe('PrecedentLink', () => {
    const valid = {
      id: 'prec_004',
      source_proceeding_id: 'proc_2010_chile_quake',
      target_proceeding_id: 'proc_001',
      relation: 'historical_analog',
      summary: 'Prior Chile earthquake used as comparison.',
    };

    it('accepts valid precedent link', () => {
      assert.equal(validate('precedent_link', valid).valid, true);
    });
  });

  describe('GovernanceRule', () => {
    const valid = {
      id: 'rule_014',
      name: 'Escalation Requires Grounds',
      category: 'intervention_validity',
      description: 'Escalation must cite evidence.',
      enforcement: { mode: 'hard_block', message: 'Escalation requires grounds.' },
      version: 1,
    };

    it('accepts valid governance rule', () => {
      assert.equal(validate('governance_rule', valid).valid, true);
    });
  });

  describe('CycleSnapshot', () => {
    const valid = {
      cycle_id: 42,
      started_at: '2026-03-16T12:00:00Z',
      ended_at: '2026-03-16T12:10:00Z',
    };

    it('accepts valid cycle snapshot', () => {
      assert.equal(validate('cycle_snapshot', valid).valid, true);
    });

    it('rejects non-integer cycle_id', () => {
      const result = validate('cycle_snapshot', { ...valid, cycle_id: 'abc' });
      assert.equal(result.valid, false);
    });
  });

  describe('assertValid', () => {
    it('returns record on valid input', () => {
      const sig = { id: 'sig_1', type: 'alert', source: 'test', timestamp: 'now', title: 'T', summary: 'S' };
      assert.deepEqual(assertValid('signal', sig), sig);
    });

    it('throws on invalid input', () => {
      assert.throws(() => assertValid('signal', {}), /Invalid signal record/);
    });
  });
});
