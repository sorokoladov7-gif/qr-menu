// Single source of truth for the admin cabinet runtime dependency graph.
// Order is intentional: vendor -> shared -> core -> feature modules -> app.
window.QR_ADMIN_MODULES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  '/src/assets/js/pwa/pwa-install.js',
  '/src/assets/js/shared/config.js',
  '/src/assets/js/shared/app.js',
  '/src/assets/js/shared/utils.js',
  '/src/assets/js/admin/admin-core.js',
  '/src/assets/js/admin/admin-venues.js',
  '/src/assets/js/admin/admin-managers.js',
  '/src/assets/js/admin/admin-staff.js',
  '/src/assets/js/admin/admin-subscriptions.js',
  '/src/assets/js/admin/admin-payments.js',
  '/src/assets/js/admin/admin-menu.js',
  '/src/assets/js/admin/admin-settings.js',
  '/src/assets/js/admin/admin-templates.js',
  '/src/assets/js/admin/admin-statistics.js',
  '/src/assets/js/admin/admin-app.js'
];
