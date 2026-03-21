'use strict';

const fs = require('fs');
const path = require('path');

// Load all schemas once
const SCHEMAS = {};
const SCHEMA_MAP = {
  signal:          'signals/signal.schema.json',
  proceeding:      'proceedings/proceeding.schema.json',
  intervention:    'interventions/intervention.schema.json',
  obligation:      'obligations/obligation.schema.json',
  synthesis:       'synthesis/synthesis.schema.json',
  closure_record:  'closure/closure-record.schema.json',
  agent_role:      'agents/agent-role.schema.json',
  precedent_link:  'memory/precedent-link.schema.json',
  governance_rule: 'governance/governance-rule.schema.json',
  cycle_snapshot:  'cycles/cycle-snapshot.schema.json',
};

function loadSchema(type) {
  if (SCHEMAS[type]) return SCHEMAS[type];
  const file = SCHEMA_MAP[type];
  if (!file) throw new Error(`Unknown record type: "${type}". Valid: ${Object.keys(SCHEMA_MAP).join(', ')}`);
  const schemaPath = path.join(__dirname, file);
  SCHEMAS[type] = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  return SCHEMAS[type];
}

/**
 * Validate a record against its schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * This is a lightweight validator that checks:
 * - required fields are present
 * - field types match (string, number, integer, boolean, array, object)
 * - enum values are valid
 * - number min/max constraints
 *
 * For production use, consider replacing with ajv or similar.
 */
function validate(type, record) {
  const schema = loadSchema(type);
  const errors = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (record[field] === undefined || record[field] === null) {
        errors.push(`Missing required field: "${field}"`);
      }
    }
  }

  // Check field types and constraints
  if (schema.properties) {
    for (const [field, spec] of Object.entries(schema.properties)) {
      const value = record[field];
      if (value === undefined || value === null) continue;

      // Type check
      const allowedTypes = Array.isArray(spec.type) ? spec.type : [spec.type];
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      const typeMatch = allowedTypes.some(t => {
        if (t === 'null') return value === null;
        if (t === 'integer') return typeof value === 'number' && Number.isInteger(value);
        if (t === 'array') return Array.isArray(value);
        return actualType === t;
      });

      if (!typeMatch) {
        errors.push(`Field "${field}" expected type ${allowedTypes.join('|')}, got ${actualType}`);
      }

      // Enum check
      if (spec.enum && !spec.enum.includes(value)) {
        errors.push(`Field "${field}" value "${value}" not in allowed values: ${spec.enum.join(', ')}`);
      }

      // Number constraints
      if (typeof value === 'number') {
        if (spec.minimum !== undefined && value < spec.minimum) {
          errors.push(`Field "${field}" value ${value} below minimum ${spec.minimum}`);
        }
        if (spec.maximum !== undefined && value > spec.maximum) {
          errors.push(`Field "${field}" value ${value} above maximum ${spec.maximum}`);
        }
      }
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Validate and throw if invalid.
 */
function assertValid(type, record) {
  const result = validate(type, record);
  if (!result.valid) {
    throw new Error(`Invalid ${type} record: ${result.errors.join('; ')}`);
  }
  return record;
}

module.exports = { validate, assertValid, loadSchema, SCHEMA_MAP };
