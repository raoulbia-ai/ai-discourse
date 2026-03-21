'use strict';

const FileStore = require('./file-store');

/**
 * Create a store instance.
 *
 * @param {string} dataDir - Directory for data files
 * @param {string} [backend='file'] - Storage backend (currently only 'file')
 * @returns {FileStore}
 */
function createStore(dataDir, backend = 'file') {
  if (backend !== 'file') {
    throw new Error(`Unknown storage backend: "${backend}". Currently supported: file`);
  }
  return new FileStore(dataDir);
}

module.exports = { createStore, FileStore };
