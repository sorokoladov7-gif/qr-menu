'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const exists=relative=>fs.existsSync(path.join(root,relative));

test('filesystem reorganization keeps one canonical manager runtime tree',()=>{
  const expected=[
    'src/assets/js/manager/manager-payment-settings.js',
    'src/assets/js/manager/manager-site-import.js',
    'src/assets/js/manager/manager-design.js',
    'src/assets/js/manager/manager-hall.js',
    'src/assets/js/manager/manager-hall-ai.js',
    'src/assets/js/manager/manager-hall-view.js',
  ];
  for(const file of expected)assert.ok(exists(file),`canonical runtime file is missing: ${file}`);
});

test('legacy root manager runtime aliases are not required internally',()=>{
  const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const sources=(vercel.rewrites||[]).map(x=>x&&x.source).filter(Boolean);
  assert.equal(sources.includes('/js/manager-payment-settings.js'),false);
  assert.equal(sources.includes('/js/manager-site-import.js'),false);
  assert.equal(sources.includes('/js/manager-design.js'),false);
});
