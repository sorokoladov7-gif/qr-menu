'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('filesystem reorganization keeps canonical relocated asset targets', () => {
  const vercel = read('vercel.json');
  const staticServer = read('tests/support/static-server.cjs');

  for (const [source, destination] of [
    ['/js/manager-payment-settings.js', '/src/assets/js/manager/manager-payment-settings.js'],
    ['/js/manager-site-import.js', '/src/assets/js/manager/manager-site-import.js'],
    ['/js/manager-design.js', '/src/assets/js/manager/manager-design.js'],
    ['/js/manager-hall.js', '/src/assets/js/manager/manager-hall.js'],
    ['/js/manager-hall-ai.js', '/src/assets/js/manager/manager-hall-ai.js'],
    ['/js/manager-hall-view.js', '/src/assets/js/manager/manager-hall-view.js']
  ]) {
    assert.ok(vercel.includes(`"source":"${source}","destination":"${destination}"`), `${source} must resolve to ${destination}`);
  }

  assert.ok(staticServer.includes('return `/src/assets/${assetMatch[2]}/${assetMatch[3]}`;'));
  assert.ok(staticServer.includes("['/js/manager-payment-settings.js', '/src/assets/js/manager/manager-payment-settings.js']"));
  assert.ok(staticServer.includes("['/js/manager-design.js', '/src/assets/js/manager/manager-design.js']"));
  assert.ok(!staticServer.includes('/src/assets/js/manager/legacy/'));
});
