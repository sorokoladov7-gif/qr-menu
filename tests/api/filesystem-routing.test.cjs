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

test('legacy page and manager runtime URLs remain production-compatible',()=>{
  const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const rewrites=vercel.rewrites||[];
  const map=new Map(rewrites.map(x=>[x&&x.source,x&&x.destination]));
  const expected={
    '/manager.html':'/src/pages/manager/manager.html',
    '/manager-demo.html':'/src/pages/manager/manager-demo.html',
    '/manager-staff-statistics.html':'/src/pages/manager/manager-staff-statistics.html',
    '/integrations.html':'/src/pages/manager/integrations.html',
    '/staff-guide.html':'/src/pages/manager/staff-guide.html',
    '/admin.html':'/src/pages/admin/admin.html',
    '/admin-analytics.html':'/src/pages/admin/admin-analytics.html',
    '/admin-permissions.html':'/src/pages/admin/admin-permissions.html',
    '/venue-analytics.html':'/src/pages/admin/venue-analytics.html',
    '/login.html':'/src/pages/auth/login.html',
    '/register.html':'/src/pages/auth/register.html',
    '/js/app.js':'/src/assets/js/shared/app.js',
    '/js/config.js':'/src/assets/js/shared/config.js',
    '/js/offline-sync.js':'/src/assets/js/shared/offline-sync.js',
    '/js/manager-design.js':'/src/assets/js/manager/manager-design.js',
    '/js/manager-hall.js':'/src/assets/js/manager/manager-hall.js',
    '/js/manager-site-import.js':'/src/assets/js/manager/manager-site-import.js',
    '/js/manager-payment-settings.js':'/src/assets/js/manager/manager-payment-settings.js'
  };
  for(const [source,destination] of Object.entries(expected))assert.equal(map.get(source),destination,`missing or incorrect compatibility rewrite: ${source}`);
  assert.ok(rewrites.findIndex(x=>x.source==='/js/manager-design.js')<rewrites.findIndex(x=>x.source==='/js/:path*'),'specific manager JS rewrites must precede generic /js/:path*');
});
