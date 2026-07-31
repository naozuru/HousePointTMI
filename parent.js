/**
 * Parent Portal
 */
(function () {
  'use strict';

  const T = window.TMI;

  // Form submit handler
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        loginParent();
      });
    }

    // Auto-focus NIS input
    const nisInput = document.getElementById('nisInput');
    if (nisInput) nisInput.focus();

    // Remember last NIS
    const saved = T.store.get('lastNis');
    if (saved && nisInput) nisInput.value = saved;
  });

  async function loginParent() {
    const nis = document.getElementById('nisInput').value.trim();
    if (!nis) {
      T.showToast('Please enter the student NIS', 'error');
      return;
    }

    if (!/^\d+$/.test(nis)) {
      T.showToast('NIS must be numeric', 'error');
      return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<iconify-icon icon="mdi:loading" class="spin"></iconify-icon> Loading...';

    T.store.set('lastNis', nis);

    const res = await T.api('parentLogin', { nis });

    if (res.status === 'success') {
      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('parentDashboard').classList.remove('hidden');

      renderHeader(res.student, res.stats || {});
      renderHistory(res.history || []);

      T.showToast('Data loaded successfully', 'success');
    } else {
      T.showToast(res.message || 'NIS not found', 'error');
      btn.disabled = false;
      btn.innerHTML = '<iconify-icon icon="mdi:eye-outline"></iconify-icon> View Points';
    }
  }

  function renderHeader(s, stats) {
    const pointClass = s.points >= 0 ? 'points-positive' : 'points-negative';
    const sign = s.points > 0 ? '+' : '';
    const houseColor = T.getHouseColor(s.house);

    const headerDiv = document.getElementById('parentStudentHeader');
    headerDiv.innerHTML = '';

    const avatar = T.createAvatar(s, 'large house-' + (s.house || ''));
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'flex:1; min-width:0;';
    infoDiv.innerHTML = `
      <h3 style="margin-top: 14px;">${T.escapeHtml(s.name)}</h3>
      <p>
        Grade ${T.escapeHtml(s.class)}
        ${s.house ? `• <span style="color:${houseColor}; font-weight: 700;">House ${T.escapeHtml(s.house)}</span>` : ''}
        ${s.nis ? `• NIS: ${T.escapeHtml(String(s.nis))}` : ''}
      </p>
      <div class="points-badge ${pointClass}" style="margin-top:12px; display:inline-block; font-size:14px; padding:6px 14px;">
        Total Points: ${sign}${T.formatNumber(s.points)}
      </div>

      <div class="parent-summary">
        <div class="summary-card primary">
          <div class="label">Transactions</div>
          <div class="value">${stats.total_transactions ?? 0}</div>
        </div>
        <div class="summary-card">
          <div class="label" style="color: var(--success);">Awards</div>
          <div class="value" style="color: var(--success);">+${stats.total_positive ?? 0}</div>
        </div>
        <div class="summary-card">
          <div class="label" style="color: var(--danger);">Violations</div>
          <div class="value" style="color: var(--danger);">-${stats.total_negative ?? 0}</div>
        </div>
      </div>
    `;

    headerDiv.appendChild(avatar);
    headerDiv.appendChild(infoDiv);

    // Achievement check
    if (s.points >= 50) {
      const achievement = document.createElement('div');
      achievement.style.cssText = 'margin-top: 14px; padding: 10px 14px; background: linear-gradient(135deg, #fde047, #f59e0b); color: white; border-radius: var(--radius-md); font-size: 13px; font-weight: 700;';
      achievement.innerHTML = `<iconify-icon icon="mdi:trophy"></iconify-icon> Congratulations! Outstanding achievement: ${s.points} points!`;
      infoDiv.appendChild(achievement);
    } else if (s.points < -25) {
      const warning = document.createElement('div');
      warning.style.cssText = 'margin-top: 14px; padding: 10px 14px; background: var(--warning-soft); color: var(--warning); border-radius: var(--radius-md); font-size: 13px; font-weight: 700;';
      warning.innerHTML = `<iconify-icon icon="mdi:alert"></iconify-icon> Please pay attention to the student's behaviour. Contact the homeroom teacher for a consultation.`;
      infoDiv.appendChild(warning);
    }
  }

  function renderHistory(history) {
    const list = document.getElementById('parentHistoryList');
    if (!history || history.length === 0) {
      list.innerHTML = T.emptyState('mdi:history', 'No history yet', 'Point transactions will appear here');
      return;
    }

    list.innerHTML = history.map(t => {
      const pClass = t.points >= 0 ? 'points-positive' : 'points-negative';
      const sign = t.points > 0 ? '+' : '';
      return `
        <div class="history-item">
          <div class="history-meta">
            <span class="history-date">${T.formatDate(t.date)} • ${T.formatTime(t.date)}</span>
            ${t.violation_name ? `<span class="history-violation">${T.escapeHtml(t.violation_name)}</span>` : ''}
            <span class="history-note">${T.escapeHtml(t.note || 'No note')}</span>
          </div>
          <div class="points-badge ${pClass}">${sign}${T.formatNumber(t.points)}</div>
        </div>
      `;
    }).join('');
  }

  function logoutParent() {
    document.getElementById('nisInput').value = '';
    document.getElementById('parentDashboard').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    const btn = document.getElementById('loginBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<iconify-icon icon="mdi:eye-outline"></iconify-icon> View Points';
    }
  }

  window.logoutParent = logoutParent;
})();
