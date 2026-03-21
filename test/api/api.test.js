'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../../api/server');

let app, inst, store;

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discourse-api-'));
  ({ app, institution: inst, store } = createApp({ dataDir: tmpDir }));
});

// Tiny test helper — no external deps
async function request(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = app.listen(0, () => {
      const port = server.address().port;
      const opts = {
        hostname: '127.0.0.1',
        port,
        path: url,
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' },
      };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

// ─── Health ───

describe('Health', () => {
  it('returns ok', async () => {
    const res = await request(app, 'GET', '/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });
});

// ─── Proceedings ───

describe('Proceedings API', () => {
  it('creates and lists proceedings', async () => {
    const create = await request(app, 'POST', '/api/v1/proceedings', {
      title: 'Chile Earthquake', opened_by: 'system',
    });
    assert.equal(create.status, 201);
    assert.ok(create.body.id.startsWith('proc_'));

    const list = await request(app, 'GET', '/api/v1/proceedings');
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
  });

  it('gets a single proceeding', async () => {
    const create = await request(app, 'POST', '/api/v1/proceedings', {
      title: 'Test', opened_by: 'system',
    });
    const get = await request(app, 'GET', `/api/v1/proceedings/${create.body.id}`);
    assert.equal(get.status, 200);
    assert.equal(get.body.title, 'Test');
  });

  it('transitions state', async () => {
    const create = await request(app, 'POST', '/api/v1/proceedings', {
      title: 'State Test', opened_by: 'system',
    });
    const transition = await request(app, 'POST', `/api/v1/proceedings/${create.body.id}/transition`, {
      status: 'under_examination',
    });
    assert.equal(transition.status, 200);
    assert.equal(transition.body.status, 'under_examination');
  });

  it('rejects invalid transition', async () => {
    const create = await request(app, 'POST', '/api/v1/proceedings', {
      title: 'Invalid', opened_by: 'system',
    });
    const res = await request(app, 'POST', `/api/v1/proceedings/${create.body.id}/transition`, {
      status: 'settled',
    });
    assert.equal(res.status, 400);
  });
});

// ─── Interventions ───

describe('Interventions API', () => {
  it('submits and lists interventions', async () => {
    const proc = await request(app, 'POST', '/api/v1/proceedings', {
      title: 'Intervention Test', opened_by: 'system',
    });

    const submit = await request(app, 'POST', '/api/v1/interventions', {
      proceeding_id: proc.body.id,
      type: 'introduce_evidence',
      agent_id: 'geographer',
      summary: 'Terrain data',
      content: 'Analysis.',
      grounds: { evidence_refs: ['topo_v1'] },
    });
    assert.equal(submit.status, 201);

    const list = await request(app, 'GET', `/api/v1/interventions?proceeding_id=${proc.body.id}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
  });

  it('rejects invalid intervention', async () => {
    const res = await request(app, 'POST', '/api/v1/interventions', {
      proceeding_id: 'p1', type: 'chat', agent_id: 'a', summary: 's', content: 'c',
    });
    assert.equal(res.status, 400);
  });
});

// ─── Obligations ───

describe('Obligations API', () => {
  it('creates, resolves, and lists obligations', async () => {
    const create = await request(app, 'POST', '/api/v1/obligations', {
      proceeding_id: 'p1', assigned_agent_id: 'a1', description: 'Verify data.',
    });
    assert.equal(create.status, 201);

    const resolve = await request(app, 'POST', `/api/v1/obligations/${create.body.id}/resolve`, {
      resolution_type: 'answered',
    });
    assert.equal(resolve.status, 200);
    assert.equal(resolve.body.status, 'answered');

    const stats = await request(app, 'GET', '/api/v1/obligations/stats');
    assert.equal(stats.body.answered, 1);
  });
});

// ─── Synthesis ───

describe('Synthesis API', () => {
  it('creates synthesis and measures chains', async () => {
    const proc = await request(app, 'POST', '/api/v1/proceedings', {
      title: 'Synthesis Test', opened_by: 'system',
    });

    const syn = await request(app, 'POST', '/api/v1/synthesis/update', {
      proceeding_id: proc.body.id,
      updated_by: 'chronicler',
      primary_reading: 'Initial assessment.',
    });
    assert.equal(syn.status, 201);
    assert.equal(syn.body.version, 1);

    const chains = await request(app, 'GET', `/api/v1/synthesis/chains/${proc.body.id}`);
    assert.equal(chains.status, 200);
    assert.ok(chains.body.interpretation);
  });
});

// ─── Governance ───

describe('Governance API', () => {
  it('manages rules and actions', async () => {
    const rule = await request(app, 'POST', '/api/v1/governance/rules', {
      name: 'Test Rule', category: 'intervention_validity',
      description: 'Test.', enforcement: { mode: 'hard_block', message: 'Blocked.' },
    });
    assert.equal(rule.status, 201);

    const rules = await request(app, 'GET', '/api/v1/governance/rules');
    assert.equal(rules.body.length, 1);

    const action = await request(app, 'POST', '/api/v1/governance/actions', {
      agent_id: 'steward', action: 'elevate', proceeding_id: 'p1', reason: 'Urgent.',
    });
    assert.equal(action.status, 201);

    const active = await request(app, 'GET', '/api/v1/governance/actions');
    assert.equal(active.body.length, 1);

    const health = await request(app, 'GET', '/api/v1/governance/health');
    assert.equal(health.status, 200);
  });
});

// ─── Agenda ───

describe('Agenda API', () => {
  it('watches and unwatches proceedings', async () => {
    const watch = await request(app, 'POST', '/api/v1/agenda/watch', {
      agent_id: 'geo', proceeding_id: 'p1',
    });
    assert.equal(watch.body.status, 'watching');

    const wl = await request(app, 'GET', '/api/v1/agenda/watchlists/geo');
    assert.equal(wl.body.length, 1);

    const unwatch = await request(app, 'POST', '/api/v1/agenda/unwatch', {
      agent_id: 'geo', proceeding_id: 'p1',
    });
    assert.equal(unwatch.body.status, 'unwatched');
  });
});

// ─── Memory ───

describe('Memory API', () => {
  it('creates and retrieves precedent links', async () => {
    const link = await request(app, 'POST', '/api/v1/memory/precedents', {
      source_proceeding_id: 'p_old', target_proceeding_id: 'p_new',
      relation: 'historical_analog', summary: 'Similar event.',
    });
    assert.equal(link.status, 201);

    const get = await request(app, 'GET', '/api/v1/memory/precedents/p_new');
    assert.equal(get.body.length, 1);
  });
});

// ─── Signals ───

describe('Signals API', () => {
  it('creates and queries signals', async () => {
    const sig = await request(app, 'POST', '/api/v1/signals', {
      type: 'event_report', source: 'usgs', timestamp: 'now',
      title: 'Earthquake', summary: 'M7.1',
      tags: ['earthquake'],
    });
    assert.equal(sig.status, 201);

    const list = await request(app, 'GET', '/api/v1/signals?source=usgs');
    assert.equal(list.body.length, 1);

    const byTag = await request(app, 'GET', '/api/v1/signals?tag=earthquake');
    assert.equal(byTag.body.length, 1);
  });
});

// ─── Cycles ───

describe('Cycles API', () => {
  it('returns empty when no cycles', async () => {
    const res = await request(app, 'GET', '/api/v1/cycles');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);

    const latest = await request(app, 'GET', '/api/v1/cycles/latest');
    assert.equal(latest.body, null);
  });
});
