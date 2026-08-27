(function(){
  'use strict';
  let deferredPrompt = null;
  let isAppInstalled = false;

  function isStandalone() {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function hasRoleManifest() {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return false;
    const href = link.getAttribute('href') || '';
    return /manifest-(cook|courier|waiter|manager|admin)\.webmanifest/.test(href);
  }

  function showInstallPrompt() {
    if (isStandalone() || isAppInstalled || !deferredPrompt) return;
    if (!hasRoleManifest()) return;
    if (document.getElementById('pwa-install-box')) return;

    const box = document.createElement('div');
    box.id = 'pwa-install-box';
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:16px;border-radius:18px;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.15);box-shadow:0 20px 60px #0008;font:14px system-ui';
    box.innerHTML = '<b style="font-size:16px">Установить QR-Menu</b><div style="opacity:.75;margin:6px 0 12px">Быстрый доступ и рабочий интерфейс даже при нестабильном интернете.</div><div style="display:flex;gap:8px"><button id="pwa-install" style="flex:1;padding:10px;border:0;border-radius:10px;background:#6366f1;color:#fff;font-weight:700">Установить</button><button id="pwa-later" style="padding:10px 14px;border:1px solid #ffffff22;border-radius:10px;background:#ffffff08;color:#fff">Позже</button></div>';
    document.body.appendChild(box);

    document.getElementById('pwa-install').onclick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (result.outcome === 'accepted') {
          isAppInstalled = true;
        }
        box.remove();
      }
    };
    document.getElementById('pwa-later').onclick = () => {
      box.remove();
      sessionStorage.setItem('pwa_install_dismissed', '1');
    };
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(() => console.log('[PWA] Service Worker registered with scope /'))
        .catch(err => {
          console.warn('[PWA] SW registration failed:', err);
        });
    }
  }

  // Восстановление полей входа для официанта (если нужно)
  function installWaiterLoginRecovery() {
    if (!/\/waiter\.html$/i.test(location.pathname)) return;
    let lastSlug = '', lastPin = '';
    document.addEventListener('input', e => {
      const t = e.target;
      if (!t || !t.id) return;
      if (t.id === 'slug') lastSlug = t.value || '';
      else if (t.id === 'pin') lastPin = t.value || '';
    }, { capture: true });

    const recover = () => {
      const s = document.getElementById('slug'), p = document.getElementById('pin');
      if (s && lastSlug && !s.value) s.value = lastSlug;
      if (p && lastPin && !p.value) p.value = lastPin;
    };

    const originalRpcReady = () => {
      const db = window.db;
      if (!db || typeof db.rpc !== 'function') return false;
      if (db.__qrWaiterLoginPatch) return true;
      const rpc = db.rpc.bind(db);
      db.rpc = async function(name, params) {
        if (name === 'staff_login' && params && params.p_type === 'waiter') {
          recover();
          if (!String(params.p_slug || '').trim() && lastSlug) params = Object.assign({}, params, { p_slug: lastSlug });
          if (!String(params.p_pin || '').trim() && lastPin) params = Object.assign({}, params, { p_pin: lastPin });
        }
        return rpc(name, params);
      };
      db.__qrWaiterLoginPatch = true;
      return true;
    };

    if (!originalRpcReady()) {
      const timer = setInterval(() => {
        if (originalRpcReady()) clearInterval(timer);
      }, 50);
      setTimeout(() => clearInterval(timer), 10000);
    }
  }

  function patchCanonicalOrderRpc() {
    const ready = () => {
      const db = window.db;
      if (!db || typeof db.rpc !== 'function') return false;
      if (db.__qrCanonicalOrderRpcPatch) return true;
      const rpc = db.rpc.bind(db);
      db.rpc = async function(name, params, options) {
        if (name === 'create_public_order_v2' && params) {
          return rpc('create_public_order_canonical', {
            p_venue_id: params.p_venue_id,
            p_order_type: params.p_order_type,
            p_customer_name: params.p_customer_name,
            p_customer_phone: params.p_customer_phone,
            p_delivery_address: params.p_delivery_address,
            p_comment: params.p_comment,
            p_payment_method: params.p_payment_method,
            p_items: params.p_items,
            p_addons: params.p_addons,
            p_table_token: params.p_table_token,
            p_delivery_lat: params.p_delivery_lat,
            p_delivery_lng: params.p_delivery_lng,
            p_operation_key: params.p_operation_key,
            p_client_total: null,
            p_delivery_fee: null
          }, options);
        }
        return rpc(name, params, options);
      };
      db.__qrCanonicalOrderRpcPatch = true;
      return true;
    };
    if (!ready()) {
      const timer = setInterval(() => {
        if (ready()) clearInterval(timer);
      }, 50);
      setTimeout(() => clearInterval(timer), 10000);
    }
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (!sessionStorage.getItem('pwa_install_dismissed')) {
      setTimeout(showInstallPrompt, 900);
    }
  });

  window.addEventListener('appinstalled', () => {
    isAppInstalled = true;
    deferredPrompt = null;
    const box = document.getElementById('pwa-install-box');
    if (box) box.remove();
    sessionStorage.removeItem('pwa_install_dismissed');
  });

  document.addEventListener('click', function(e) {
    const laterBtn = e.target && e.target.id === 'pwa-later';
    if (laterBtn) {
      sessionStorage.setItem('pwa_install_dismissed', '1');
    }
  });

  registerServiceWorker();
  installWaiterLoginRecovery();
  patchCanonicalOrderRpc();

  if (isStandalone()) {
    isAppInstalled = true;
  }
})();
