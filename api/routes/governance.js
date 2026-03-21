'use strict';

const express = require('express');

/**
 * Governance routes — rules, stewardship actions, discourse health.
 * @param {import('../../core').createInstitution} inst
 */
function governanceRoutes(inst) {
  const router = express.Router();

  // List rules
  router.get('/rules', (req, res) => {
    try {
      res.json(inst.governance.listRules());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Add rule
  router.post('/rules', (req, res) => {
    try {
      const rule = inst.governance.addRule(req.body);
      res.status(201).json(rule);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Post stewardship action
  router.post('/actions', (req, res) => {
    try {
      const action = inst.governance.postAction(req.body);
      res.status(201).json(action);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get active stewardship actions
  router.get('/actions', (req, res) => {
    try {
      res.json(inst.governance.getActiveActions());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Expire past-due actions
  router.post('/actions/expire', (req, res) => {
    try {
      const count = inst.governance.expireActions();
      res.json({ expired: count });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Discourse health analysis
  router.get('/health', (req, res) => {
    try {
      res.json(inst.governance.analyzeHealth());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = governanceRoutes;
