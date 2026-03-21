'use strict';

const fs = require('fs');
const path = require('path');

/**
 * File-based storage for AI Discourse Infrastructure.
 *
 * Uses JSON files for registries and JSONL for append-only logs.
 * Atomic writes via tmp+rename pattern.
 *
 * This is the default storage backend — easy to run, easy to inspect, easy to debug.
 */
class FileStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // --- Paths ---

  _path(filename) {
    return path.join(this.dataDir, filename);
  }

  // --- JSON registry operations (read/write whole file) ---

  _readJSON(filename, defaultValue = {}) {
    const filepath = this._path(filename);
    if (!fs.existsSync(filepath)) return defaultValue;
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch {
      return defaultValue;
    }
  }

  _writeJSON(filename, data) {
    const filepath = this._path(filename);
    const tmp = filepath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filepath);
  }

  // --- JSONL append-only log operations ---

  _appendJSONL(filename, record) {
    const filepath = this._path(filename);
    fs.appendFileSync(filepath, JSON.stringify(record) + '\n');
  }

  _readJSONL(filename) {
    const filepath = this._path(filename);
    if (!fs.existsSync(filepath)) return [];
    return fs.readFileSync(filepath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean);
  }

  // --- Proceedings ---

  getProceedings() {
    return this._readJSON('proceedings.json', { proceedings: [] }).proceedings;
  }

  getProceeding(id) {
    const proc = this.getProceedings().find(p => p.id === id);
    if (!proc) throw new Error(`Proceeding not found: ${id}`);
    return proc;
  }

  saveProceeding(proceeding) {
    const data = this._readJSON('proceedings.json', { proceedings: [] });
    const idx = data.proceedings.findIndex(p => p.id === proceeding.id);
    if (idx === -1) {
      data.proceedings.push(proceeding);
    } else {
      data.proceedings[idx] = proceeding;
    }
    this._writeJSON('proceedings.json', data);
    return proceeding;
  }

  // --- Interventions (append-only log) ---

  appendIntervention(intervention) {
    this._appendJSONL('interventions.jsonl', intervention);
    return intervention;
  }

  readInterventions(filters = {}) {
    let interventions = this._readJSONL('interventions.jsonl');
    if (filters.proceeding_id) {
      interventions = interventions.filter(i => i.proceeding_id === filters.proceeding_id);
    }
    if (filters.agent_id) {
      interventions = interventions.filter(i => i.agent_id === filters.agent_id);
    }
    if (filters.type) {
      interventions = interventions.filter(i => i.type === filters.type);
    }
    if (filters.offset) {
      interventions = interventions.slice(filters.offset);
    }
    if (filters.limit) {
      interventions = interventions.slice(0, filters.limit);
    }
    return interventions;
  }

  // --- Obligations ---

  getObligations() {
    return this._readJSON('obligations.json', { obligations: [] }).obligations;
  }

  saveObligation(obligation) {
    const data = this._readJSON('obligations.json', { obligations: [] });
    const idx = data.obligations.findIndex(o => o.id === obligation.id);
    if (idx === -1) {
      data.obligations.push(obligation);
    } else {
      data.obligations[idx] = obligation;
    }
    this._writeJSON('obligations.json', data);
    return obligation;
  }

  // --- Synthesis ---

  getSyntheses(proceeding_id) {
    return this._readJSONL('syntheses.jsonl')
      .filter(s => s.proceeding_id === proceeding_id);
  }

  appendSynthesis(synthesis) {
    this._appendJSONL('syntheses.jsonl', synthesis);
    return synthesis;
  }

  // --- Signals ---

  appendSignal(signal) {
    this._appendJSONL('signals.jsonl', signal);
    return signal;
  }

  readSignals(filters = {}) {
    let signals = this._readJSONL('signals.jsonl');
    if (filters.source) {
      signals = signals.filter(s => s.source === filters.source);
    }
    if (filters.tag) {
      signals = signals.filter(s => s.tags && s.tags.includes(filters.tag));
    }
    return signals;
  }

  // --- Governance Rules ---

  getRules() {
    return this._readJSON('governance-rules.json', { rules: [] }).rules;
  }

  saveRule(rule) {
    const data = this._readJSON('governance-rules.json', { rules: [] });
    const idx = data.rules.findIndex(r => r.id === rule.id);
    if (idx === -1) {
      data.rules.push(rule);
    } else {
      data.rules[idx] = rule;
    }
    this._writeJSON('governance-rules.json', data);
    return rule;
  }

  // --- Agent Roles ---

  getAgentRoles() {
    return this._readJSON('agent-roles.json', { roles: [] }).roles;
  }

  getAgentRole(id) {
    const role = this.getAgentRoles().find(r => r.id === id);
    if (!role) throw new Error(`Agent role not found: ${id}`);
    return role;
  }

  saveAgentRole(role) {
    const data = this._readJSON('agent-roles.json', { roles: [] });
    const idx = data.roles.findIndex(r => r.id === role.id);
    if (idx === -1) {
      data.roles.push(role);
    } else {
      data.roles[idx] = role;
    }
    this._writeJSON('agent-roles.json', data);
    return role;
  }

  // --- Precedent Links ---

  getPrecedentLinks(proceeding_id) {
    return this._readJSON('precedent-links.json', { links: [] })
      .links.filter(l => l.target_proceeding_id === proceeding_id || l.source_proceeding_id === proceeding_id);
  }

  savePrecedentLink(link) {
    const data = this._readJSON('precedent-links.json', { links: [] });
    const idx = data.links.findIndex(l => l.id === link.id);
    if (idx === -1) {
      data.links.push(link);
    } else {
      data.links[idx] = link;
    }
    this._writeJSON('precedent-links.json', data);
    return link;
  }

  // --- Closure Records ---

  getClosureRecord(proceeding_id) {
    const records = this._readJSON('closure-records.json', { records: [] }).records;
    return records.find(r => r.proceeding_id === proceeding_id) || null;
  }

  saveClosureRecord(record) {
    const data = this._readJSON('closure-records.json', { records: [] });
    const idx = data.records.findIndex(r => r.id === record.id);
    if (idx === -1) {
      data.records.push(record);
    } else {
      data.records[idx] = record;
    }
    this._writeJSON('closure-records.json', data);
    return record;
  }

  // --- Cycle Snapshots (append-only log) ---

  appendCycleSnapshot(snapshot) {
    this._appendJSONL('cycle-snapshots.jsonl', snapshot);
    return snapshot;
  }

  getCycleSnapshots() {
    return this._readJSONL('cycle-snapshots.jsonl');
  }

  getLatestCycle() {
    const snapshots = this.getCycleSnapshots();
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }
}

module.exports = FileStore;
