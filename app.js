/**
 * app.js - Global app shell behaviors
 * Loaded on every page via <script src="app.js"></script> after shared.js
 */

(function () {
  'use strict';

  // Build top-bar actions (theme toggle, online indicator, install) when present
  document.addEventListener('DOMContentLoaded', () => {
    const headerRight = document.querySelector('.header-right');
    if (headerRight && !headerRight.querySelector('[data-theme-toggle]')) {
      // Order (left → right): [other page buttons] [Online] [Install] [Theme]
      // We append in reverse so final visual order is Install → Online → Theme on the right.

      // 1. Theme toggle (appended last → ends up rightmost among these)
      const themeBtn = document.createElement('button');
      themeBtn.className = 'btn-nav';
      themeBtn.dataset.themeToggle = '';
      themeBtn.title = 'Toggle theme';
      themeBtn.setAttribute('aria-label', 'Toggle theme');
      themeBtn.innerHTML = `<iconify-icon icon="mdi:weather-night"></iconify-icon>`;
      themeBtn.addEventListener('click', () => {
        window.TMI.toggleTheme();
        themeBtn.innerHTML = window.TMI.getTheme() === 'dark'
          ? `<iconify-icon icon="mdi:weather-sunny"></iconify-icon>`
          : `<iconify-icon icon="mdi:weather-night"></iconify-icon>`;
      });
      if (window.TMI.getTheme() === 'dark') {
        themeBtn.innerHTML = `<iconify-icon icon="mdi:weather-sunny"></iconify-icon>`;
      }
      headerRight.appendChild(themeBtn);

      // 2. PWA install
      const installBtn = document.createElement('button');
      installBtn.className = 'btn-nav install-btn hidden';
      installBtn.title = 'Install app';
      installBtn.innerHTML = `<iconify-icon icon="mdi:download"></iconify-icon>`;
      installBtn.addEventListener('click', async () => {
        const installed = await window.TMI.promptInstall();
        if (!installed) installBtn.classList.add('hidden');
      });
      headerRight.insertBefore(installBtn, themeBtn);

      // 3. Online indicator
      const onlineDot = document.createElement('span');
      onlineDot.className = 'online-indicator';
      onlineDot.title = navigator.onLine ? 'Online' : 'Offline';
      onlineDot.innerHTML = `<span class="dot"></span><span class="text">${navigator.onLine ? 'Online' : 'Offline'}</span>`;
      headerRight.insertBefore(onlineDot, installBtn);
      window.addEventListener('connectionchange', (e) => {
        onlineDot.title = e.detail.online ? 'Online' : 'Offline';
        onlineDot.querySelector('.text').textContent = e.detail.online ? 'Online' : 'Offline';
        onlineDot.classList.toggle('offline', !e.detail.online);
      });

      window.addEventListener('pwa-installable', () => {
        installBtn.classList.remove('hidden');
      });
    }

    // SW update notification
    window.addEventListener('sw-updated', () => {
      window.TMI.showToast('New version available - refresh the page', 'success', 5000);
    });

    // Announcements banner
    loadAnnouncements();
  });

  async function loadAnnouncements() {
    if (!window.TMI) return;
    try {
      const res = await window.TMI.api('getAnnouncements');
      if (res.status === 'success' && res.announcements && res.announcements.length > 0) {
        showAnnouncementBanner(res.announcements[0]);
      }
    } catch {}
  }

  function showAnnouncementBanner(ann) {
    const existing = document.querySelector('.announcement-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'announcement-banner';
    banner.innerHTML = `
      <iconify-icon icon="mdi:bullhorn" width="20"></iconify-icon>
      <div class="announcement-body">
        <strong>${window.TMI.escapeHtml(ann.title)}</strong>
        <span>${window.TMI.escapeHtml(ann.body)}</span>
      </div>
      <button class="announcement-close" aria-label="Close">
        <iconify-icon icon="mdi:close" width="18"></iconify-icon>
      </button>
    `;
    document.body.prepend(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    banner.querySelector('.announcement-close').addEventListener('click', () => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 300);
    });
    setTimeout(() => {
      if (banner.parentNode) {
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
  }
})();
