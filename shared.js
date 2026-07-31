/**
 * TMI House Points - Shared Utilities v2.0
 * Loaded before app.js, dashboard.js, reports.js, parent.js
 * Provides: api(), debounce(), toast queue, modal, theme, helpers, etc.
 */

(function (global) {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================

  const HOUSES = {
    JJT: { name: 'JJT', color: '#004632', gradient: 'linear-gradient(135deg, #004632, #006644)' },
    Jensud: { name: 'Jensud', color: '#00835c', gradient: 'linear-gradient(135deg, #00835c, #2ea876)' },
    Munir: { name: 'Munir', color: '#2ea876', gradient: 'linear-gradient(135deg, #2ea876, #6cc79a)' }
  };

  const POINTS_TYPE = {
    plus: { color: 'var(--success)', sign: '+', label: 'Add Points' },
    minus: { color: 'var(--danger)', sign: '-', label: 'Subtract Points' }
  };

  const MILESTONES = [100, 50, 25, 10, -10, -25, -50, -100];

  // ============================================================
  // API
  // ============================================================

  const inflight = new Map();

  async function api(action, payload = {}) {
    const cacheKey = action + JSON.stringify(payload);
    if (inflight.has(cacheKey)) return inflight.get(cacheKey);

    const promise = (async () => {
      const start = performance.now();
      try {
        const res = await fetch(window.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...payload })
        });
        const data = await res.json();
        const ms = Math.round(performance.now() - start);
        if (data.status !== 'success' && data.status !== 'ok') {
          console.warn(`[api] ${action} failed:`, data.message);
        }
        return { ...data, _ms: ms };
      } catch (err) {
        console.error(`[api] ${action} network error:`, err);
        return { status: 'error', message: 'Could not reach the server. Please check your connection.', _networkError: true };
      } finally {
        inflight.delete(cacheKey);
      }
    })();

    inflight.set(cacheKey, promise);
    return promise;
  }

  // ============================================================
  // DOM HELPERS
  // ============================================================

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'on') {
        Object.entries(v).forEach(([ev, fn]) => node.addEventListener(ev, fn));
      } else if (k in node && typeof v !== 'object') {
        try { node[k] = v; } catch { node.setAttribute(k, v); }
      } else {
        node.setAttribute(k, v);
      }
    });
    children.flat().forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function debounce(fn, delay = 250) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function throttle(fn, ms = 100) {
    let last = 0, t;
    return function (...args) {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, args);
      } else {
        clearTimeout(t);
        t = setTimeout(() => {
          last = Date.now();
          fn.apply(this, args);
        }, ms - (now - last));
      }
    };
  }

  // ============================================================
  // FORMATTERS
  // ============================================================

  function formatDate(date, opts = {}) {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    const defaults = { day: '2-digit', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('en-US', { ...defaults, ...opts });
  }

  function formatDateTime(date) {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatTime(date) {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatRelative(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec} sec ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
    return formatDate(d);
  }

  function formatNumber(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString('en-US');
  }

  function formatPoints(n) {
    const num = parseInt(n) || 0;
    const sign = num > 0 ? '+' : '';
    return `${sign}${formatNumber(num)}`;
  }

  // ============================================================
  // AVATAR
  // ============================================================

  function createAvatar(student, sizeClass = '') {
    const avatar = document.createElement('div');
    avatar.className = `student-avatar avatar-fallback ${sizeClass}`;
    avatar.textContent = getInitials(student?.name || '?');

    const url = student?.photo_url;
    if (url && typeof url === 'string' && url.startsWith('http')) {
      const img = new Image();
      img.className = `student-avatar-img ${sizeClass}`;
      img.alt = student?.name || '';
      img.loading = 'lazy';
      img.onload = () => {
        avatar.innerHTML = '';
        avatar.appendChild(img);
        avatar.classList.remove('avatar-fallback');
      };
      img.onerror = () => { /* keep fallback */ };
      img.src = url;
    }

    return avatar;
  }

  function getHouseColor(house) {
    return HOUSES[house]?.color || 'var(--primary)';
  }

  function getHouseGradient(house) {
    return HOUSES[house]?.gradient || 'linear-gradient(135deg, var(--primary), var(--primary-500))';
  }

  // ============================================================
  // TOAST QUEUE
  // ============================================================

  let toastEl = null;
  const toastQueue = [];
  let toastBusy = false;

  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function showToast(msg, type = '', duration = 3000) {
    toastQueue.push({ msg, type, duration });
    if (!toastBusy) processToastQueue();
  }

  function processToastQueue() {
    if (toastQueue.length === 0) {
      toastBusy = false;
      return;
    }
    toastBusy = true;
    const { msg, type, duration } = toastQueue.shift();
    const t = ensureToast();
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(processToastQueue, 250);
    }, duration);
  }

  // ============================================================
  // MODAL
  // ============================================================

  let modalOverlay = null;

  function ensureModal() {
    if (modalOverlay) return modalOverlay;
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'modalOverlay';
    modalOverlay.className = 'modal-overlay hidden';
    modalOverlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <button class="modal-close-btn" type="button" aria-label="Close">
          <iconify-icon icon="mdi:close" width="22"></iconify-icon>
        </button>
        <h3 id="modalTitle">Confirm</h3>
        <div id="modalBody"></div>
        <div id="modalFooter" class="modal-footer"></div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    modalOverlay.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
        closeModal();
      }
    });

    return modalOverlay;
  }

  function showModal(title, bodyHtml, buttons = []) {
    const m = ensureModal();
    m.querySelector('#modalTitle').innerText = title;
    m.querySelector('#modalBody').innerHTML = bodyHtml;
    const footer = m.querySelector('#modalFooter');
    footer.innerHTML = '';

    buttons.forEach((btn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${btn.class || 'btn-primary'}`;
      b.innerHTML = btn.text;
      b.disabled = !!btn.disabled;
      b.addEventListener('click', async () => {
        if (btn.keepOpen) {
          if (btn.onClick) await btn.onClick();
        } else {
          closeModal();
          if (btn.onClick) await btn.onClick();
        }
      });
      footer.appendChild(b);
    });

    m.classList.remove('hidden');
    // Focus first focusable element
    setTimeout(() => {
      const focusable = m.querySelector('input, textarea, button');
      if (focusable) focusable.focus();
    }, 50);
  }

  function closeModal() {
    if (modalOverlay) modalOverlay.classList.add('hidden');
  }

  function confirmModal(title, message, opts = {}) {
    return new Promise((resolve) => {
      showModal(title, `<p>${escapeHtml(message)}</p>`, [
        { text: opts.cancelText || 'Cancel', class: 'btn-outline', onClick: () => resolve(false) },
        {
          text: opts.confirmText || 'Confirm',
          class: opts.confirmClass || 'btn-primary',
          onClick: () => resolve(true)
        }
      ]);
    });
  }

  // ============================================================
  // SKELETON LOADERS
  // ============================================================

  function skeleton(count = 3, height = 60) {
    const html = [];
    for (let i = 0; i < count; i++) {
      html.push(`<div class="skeleton skeleton-list-item" style="height:${height}px"></div>`);
    }
    return html.join('');
  }

  function emptyState(icon, title, subtitle = '') {
    return `
      <div class="empty-state">
        <iconify-icon icon="${icon}" width="48"></iconify-icon>
        <div class="title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
      </div>
    `;
  }

  // ============================================================
  // THEME MANAGER
  // ============================================================

  const THEME_KEY = 'tmi-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a1f17' : '#004632');
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  function toggleTheme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    setTheme(getTheme());
  }

  // ============================================================
  // CONNECTION MONITOR
  // ============================================================

  function initConnectionMonitor() {
    const update = () => {
      document.body.classList.toggle('offline', !navigator.onLine);
      window.dispatchEvent(new CustomEvent('connectionchange', { detail: { online: navigator.onLine } }));
    };
    window.addEventListener('online', () => { update(); showToast('Back online', 'success'); });
    window.addEventListener('offline', () => { update(); showToast('You are offline', 'error'); });
    update();
  }

  // ============================================================
  // ANIMATIONS / EFFECTS
  // ============================================================

  function confetti(originX = 0.5, originY = 0.5) {
    const colors = ['#004632', '#00835c', '#2ea876', '#f59e0b', '#dc2626', '#7c3aed'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = (originX * 100) + '%';
      piece.style.top = (originY * 100) + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.setProperty('--tx', (Math.random() - 0.5) * 600 + 'px');
      piece.style.setProperty('--ty', (Math.random() * -400 - 100) + 'px');
      piece.style.setProperty('--rot', (Math.random() * 720) + 'deg');
      piece.style.animationDelay = (Math.random() * 100) + 'ms';
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 2500);
  }

  function pulse(el) {
    if (!el) return;
    el.classList.remove('pulse-anim');
    void el.offsetWidth;
    el.classList.add('pulse-anim');
    setTimeout(() => el.classList.remove('pulse-anim'), 600);
  }

  function vibrate(pattern = 30) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ============================================================
  // PWA HELPERS
  // ============================================================

  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('App installed successfully!', 'success');
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });

  async function promptInstall() {
    if (!deferredInstallPrompt) return false;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return outcome === 'accepted';
  }

  function isInstallable() {
    return !!deferredInstallPrompt;
  }

  // ============================================================
  // STORAGE
  // ============================================================

  const store = {
    get(key, def = null) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : def;
      } catch { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
    },
    del(key) {
      try { localStorage.removeItem(key); } catch {}
    }
  };

  // ============================================================
  // CLIPBOARD
  // ============================================================

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'success', 1500);
      return true;
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('Copied', 'success', 1500); return true; }
      catch { showToast('Failed to copy', 'error'); return false; }
      finally { ta.remove(); }
    }
  }

  // ============================================================
  // AUTH
  // ============================================================

  function logout() {
    store.del('teacher');
    window.location.href = 'index.html';
  }

  function checkAuth() {
    const teacher = store.get('teacher');
    if (!teacher) {
      window.location.href = 'index.html';
      return null;
    }
    return teacher;
  }

  // ============================================================
  // SERVICE WORKER
  // ============================================================

  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then(reg => {
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (!newWorker) return;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  window.dispatchEvent(new CustomEvent('sw-updated'));
                }
              });
            });
          })
          .catch(err => console.log('SW Error:', err));
      });
    }
  }

  // ============================================================
  // EXPOSE
  // ============================================================

  global.TMI = {
    api, $, $$, el, escapeHtml, getInitials, createAvatar, getHouseColor, getHouseGradient,
    debounce, throttle,
    formatDate, formatDateTime, formatTime, formatRelative, formatNumber, formatPoints,
    showToast, showModal, closeModal, confirmModal,
    skeleton, emptyState,
    getTheme, setTheme, toggleTheme, initTheme,
    initConnectionMonitor,
    confetti, pulse, vibrate,
    promptInstall, isInstallable,
    store, copy,
    logout, checkAuth, registerSW,
    HOUSES, POINTS_TYPE, MILESTONES
  };

  // Auto-init
  initTheme();
  initConnectionMonitor();
  registerSW();
})(window);