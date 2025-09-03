// ui/orders/stats_modal.js
import { translate } from '../../js/language.js';
import { getOrderStatistics } from '../../js/orders.js';

export async function showStatsModal() {
  const modal = document.getElementById('statsModal');
  modal.classList.remove('hidden');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  const body = document.getElementById('statsModalBody');
  const role = localStorage.getItem("userRole");
  
  if (role !== "owner") {
    body.innerHTML = `
      <div class="access-denied">
        <h2>${translate('stats_modal_denied_title')}</h2>
        <p>${translate('stats_modal_denied_message')}</p>
        <button id="closeDeniedStatsBtn">${translate('stats_modal_denied_ok')}</button>
      </div>`;
    body.querySelector('#closeDeniedStatsBtn').onclick = () => modal.classList.add('hidden');
    return;
  }

  body.innerHTML = `
    <div class="stats-container">
      <div class="stats-header">
        <h2>${translate('stats_modal_title')}</h2>
        <p>${translate('stats_modal_subtitle')}</p>
      </div>
      <div class="stats-grid"><div class="stat-card"><p>${translate('picker_loading')}</p></div></div>
    </div>`;

  try {
    const stats = await getOrderStatistics();
    const statsGrid = body.querySelector('.stats-grid');
    statsGrid.innerHTML = `
      <div class="stat-card"><h3>${translate('stats_total_orders')}</h3><p>${stats.total_orders}</p></div>
      <div class="stat-card"><h3>${translate('stats_avg_profit')}</h3><p class="${stats.average_profit >= 0 ? 'positive' : 'negative'}">${stats.average_profit.toFixed(2)} DA</p></div>
      <div class="stat-card"><h3>${translate('stats_largest_order')}</h3><p class="highlight">${stats.largest_order_total ? `${stats.largest_order_total.toFixed(2)} DA` : 'N/A'}</p></div>
      <div class="stat-card"><h3>${translate('stats_largest_order_profit')}</h3><p class="highlight positive">${stats.largest_order_profit ? `${stats.largest_order_profit.toFixed(2)} DA` : 'N/A'}</p></div>
      <div class="stat-card"><h3>${translate('stats_borrowed_orders')}</h3><p>${stats.with_borrower}</p></div>
    `;
  } catch (error) {
    console.error("Failed to show statistics:", error);
    body.querySelector('.stats-grid').innerHTML = `
      <div class="stat-card">
        <h3>${translate('stats_error_title')}</h3><p>${translate('stats_error_message')}</p>
      </div>`;
  }
}