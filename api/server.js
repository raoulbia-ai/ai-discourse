'use strict';

const express = require('express');
const { createStore } = require('../storage');
const { createInstitution } = require('../core');

// Route factories
const proceedingsRoutes = require('./routes/proceedings');
const interventionsRoutes = require('./routes/interventions');
const obligationsRoutes = require('./routes/obligations');
const synthesisRoutes = require('./routes/synthesis');
const governanceRoutes = require('./routes/governance');
const agendaRoutes = require('./routes/agenda');
const memoryRoutes = require('./routes/memory');
const cyclesRoutes = require('./routes/cycles');
const signalsRoutes = require('./routes/signals');

/**
 * Create an Express app with all institutional API routes mounted.
 *
 * @param {{ dataDir: string, prefix?: string }} opts
 * @returns {{ app: express.Application, store: import('../storage/file-store'), institution: object }}
 */
function createApp(opts) {
  const { dataDir, prefix = '/api/v1' } = opts;

  const store = createStore(dataDir);
  const inst = createInstitution(store);

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Mount routes
  app.use(`${prefix}/signals`, signalsRoutes(store));
  app.use(`${prefix}/proceedings`, proceedingsRoutes(inst));
  app.use(`${prefix}/interventions`, interventionsRoutes(inst));
  app.use(`${prefix}/obligations`, obligationsRoutes(inst));
  app.use(`${prefix}/synthesis`, synthesisRoutes(inst));
  app.use(`${prefix}/governance`, governanceRoutes(inst));
  app.use(`${prefix}/agenda`, agendaRoutes(inst));
  app.use(`${prefix}/memory`, memoryRoutes(inst));
  app.use(`${prefix}/cycles`, cyclesRoutes(store));

  // Health endpoint
  app.get(`${prefix}/health`, (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return { app, store, institution: inst };
}

module.exports = { createApp };

// Standalone server when run directly
if (require.main === module) {
  const path = require('path');
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const port = process.env.PORT || 3000;

  const { app } = createApp({ dataDir });
  app.listen(port, () => {
    console.log(`AI Discourse Infrastructure API running on port ${port}`);
    console.log(`  Data directory: ${dataDir}`);
    console.log(`  Endpoints: /api/v1/{signals,proceedings,interventions,obligations,synthesis,governance,agenda,memory,cycles}`);
  });
}
