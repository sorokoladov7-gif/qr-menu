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

  function installCookRecipeUi() {
    if (!/\/cook\.html$/i.test(location.pathname)) return;
    if (window.__qrCookRecipeUiInstalled) return;
    window.__qrCookRecipeUiInstalled = true;

    const esc = value => String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const getToken = () => sessionStorage.getItem('cook_token') || '';

    const ensureButton = () => {
      if (!document.querySelector('.work-tabs')) return false;
      if (document.getElementById('cook-recipe-tab')) return true;
      const tabs = document.querySelector('.work-tabs');
      const button = document.createElement('button');
      button.id = 'cook-recipe-tab';
      button.className = 'work-tab';
      button.type = 'button';
      button.textContent = '📖 Рецептуры';
      button.addEventListener('click', openRecipes);
      const refresh = tabs.querySelector('.refresh-top');
      if (refresh) tabs.insertBefore(button, refresh);
      else tabs.appendChild(button);
      return true;
    };

    const closeRecipes = () => {
      const modal = document.getElementById('cook-recipes-modal');
      if (modal) modal.remove();
    };

    const showModal = (title, body) => {
      closeRecipes();
      const modal = document.createElement('div');
      modal.id = 'cook-recipes-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(2,6,23,.86);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:14px;';
      modal.innerHTML = '<div style="width:min(1100px,100%);max-height:94vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px"><h2 style="font-size:20px">' + esc(title) + '</h2><button id="cook-recipes-close" style="border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:8px 11px;cursor:pointer">✕</button></div><div id="cook-recipes-body">' + body + '</div></div>';
      document.body.appendChild(modal);
      document.getElementById('cook-recipes-close').onclick = closeRecipes;
      modal.addEventListener('click', e => { if (e.target === modal) closeRecipes(); });
    };

    const renderRecipes = payload => {
      const products = Array.isArray(payload?.products) ? payload.products : [];
      const sync = payload?.sync || {};
      const summary = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' +
        '<span style="padding:7px 10px;border-radius:999px;background:#ffffff08;color:#cbd5e1;font-size:12px">Блюд: ' + products.length + '</span>' +
        '<span style="padding:7px 10px;border-radius:999px;background:rgba(52,211,153,.12);color:#6ee7b7;font-size:12px">С рецептами: ' + products.filter(p => p.status === 'ready').length + '</span>' +
        '<span style="padding:7px 10px;border-radius:999px;background:rgba(245,158,11,.12);color:#fbbf24;font-size:12px">Без сопоставления: ' + products.filter(p => p.status === 'missing_recipe').length + '</span>' +
        '<span style="padding:7px 10px;border-radius:999px;background:rgba(99,102,241,.12);color:#a5b4fc;font-size:12px">Создано ингредиентов: ' + Number(sync.ingredients_created || 0) + '</span>' +
        '</div>';

      if (!products.length) return summary + '<div style="text-align:center;color:#94a3b8;padding:40px">В меню заведения нет блюд.</div>';

      const cards = products.map((p, idx) => {
        const ingredients = Array.isArray(p.ingredients) ? p.ingredients : [];
        const status = p.status === 'ready'
          ? '<span style="color:#6ee7b7">✓ Рецептура подключена</span>'
          : p.status === 'missing_recipe'
            ? '<span style="color:#fbbf24">⚠ Стандартный рецепт не найден</span>'
            : '<span style="color:#fbbf24">⚠ Рецептура требует проверки</span>';
        const ingredientHtml = ingredients.length
          ? ingredients.map(i => '<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)"><span>' + esc(i.name) + (i.note ? ' <small style="color:#64748b">(' + esc(i.note) + ')</small>' : '') + '</span><b style="white-space:nowrap">' + esc(i.quantity) + ' ' + esc(i.unit) + '</b></div>').join('')
          : '<div style="color:#64748b;padding:10px 0">Ингредиенты пока не подключены.</div>';
        const steps = Array.isArray(p.steps) ? p.steps : [];
        const stepsHtml = steps.length ? '<div style="margin-top:14px"><b>Приготовление</b><ol style="margin:8px 0 0 20px;color:#cbd5e1;line-height:1.6">' + steps.map(s => '<li style="margin-bottom:5px">' + esc(typeof s === 'string' ? s : (s?.text || s?.description || JSON.stringify(s))) + '</li>').join('') + '</ol></div>' : '';
        return '<details style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:13px" ' + (idx === 0 ? 'open' : '') + '><summary style="cursor:pointer;list-style:none"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div style="font-size:16px;font-weight:800">' + esc(p.product_name) + '</div><div style="font-size:12px;color:#94a3b8;margin-top:4px">' + esc(p.category || 'Основное') + ' · ' + esc(p.price) + ' ₽</div></div><div style="font-size:12px">' + status + '</div></div></summary><div style="margin-top:14px;border-top:1px solid rgba(255,255,255,.07);padding-top:12px"><div style="display:flex;gap:8px;flex-wrap:wrap;color:#94a3b8;font-size:12px;margin-bottom:10px">' + (p.recipe_name ? '<span>База: ' + esc(p.recipe_name) + '</span>' : '') + (p.base_servings ? '<span>Порций: ' + esc(p.base_servings) + '</span>' : '') + (p.prep_minutes ? '<span>Подготовка: ' + esc(p.prep_minutes) + ' мин</span>' : '') + (p.cook_minutes ? '<span>Готовка: ' + esc(p.cook_minutes) + ' мин</span>' : '') + '</div><div style="font-weight:800;margin-bottom:6px">Ингредиенты (' + ingredients.length + ')</div>' + ingredientHtml + stepsHtml + '</div></details>';
      }).join('');
      return summary + '<div style="display:grid;gap:10px">' + cards + '</div>';
    };

    async function loadRecipes() {
      const token = getToken();
      if (!token) {
        showModal('📖 Рецептуры', '<div style="color:#f87171;padding:30px;text-align:center">Сессия повара не найдена. Выполните вход заново.</div>');
        return;
      }
      showModal('📖 Рецептуры', '<div style="text-align:center;color:#94a3b8;padding:40px">Синхронизация рецептур и ингредиентов…</div>');
      try {
        const db = window.db;
        if (!db || typeof db.rpc !== 'function') throw new Error('Supabase ещё не готов');
        const r = await db.rpc('cook_recipe_catalog', { p_token: token });
        if (r.error) throw new Error(r.error.message || 'Не удалось загрузить рецептуры');
        if (!r.data?.success) throw new Error(r.data?.message || r.data?.error || 'Синхронизация не выполнена');
        const body = document.getElementById('cook-recipes-body');
        if (body) body.innerHTML = renderRecipes(r.data);
      } catch (e) {
        const body = document.getElementById('cook-recipes-body');
        if (body) body.innerHTML = '<div style="color:#f87171;padding:30px;text-align:center">Ошибка: ' + esc(e.message || e) + '</div>';
      }
    }

    function openRecipes() { loadRecipes(); }

    const observer = new MutationObserver(() => { ensureButton(); });
    const start = () => {
      if (!document.body) return;
      observer.observe(document.body, { childList: true, subtree: true });
      ensureButton();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
    setInterval(ensureButton, 1000);
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
  installCookRecipeUi();

  if (isStandalone()) {
    isAppInstalled = true;
  }
})();
