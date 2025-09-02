// ui/statistics_ui.js

// 1. IMPORT THE TRANSLATE FUNCTION
import { translate } from '../js/language.js'; 

import { initDatabase } from '../js/db.js';
import {
  getDashboardKPIs,
  getSalesDataForChart,
  getProfitMarginData,
  getTopSellingProducts
} from '../js/statistics.js';
import { countBorrowers } from '../js/borrowers.js';

let salesProfitChart = null;
let currentDuration = '7'; 
let currentAccuracy = 'auto';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDatabase();
    await setupDashboard();
  } catch (err)
  {
    console.error("Failed to initialize dashboard:", err);
    
    const container = document.querySelector('main') || document.body;
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'padding:20px;color:red;text-align:center;';
    // Use translate for the error message
    errorDiv.innerHTML = `<h2>${translate('error_loading_dashboard')}</h2>`;
    container.appendChild(errorDiv);
  }
});

async function setupDashboard() {
  await renderKPIs();
  await renderAllCharts();
  setupEventListeners();
  autoFillCustomDates();
}

async function renderKPIs() {
  const kpis = await getDashboardKPIs();
  const container = document.getElementById('kpi-cards');
  const borrowerCount = await countBorrowers(); // Ensure this is awaited if it's async

  // Logic for singular/plural borrower text
  const borrowerText = borrowerCount === 1 ? translate('borrower_singular') : translate('borrower_plural');
  
  container.innerHTML = `
    <div class="stat-card">
      <h3>${translate('kpi_total_sales')}</h3>
      <p class="value">${Number(kpis.totalSales).toFixed(2)} DA</p>
      <p class="subtitle">${translate('kpi_subtitle_orders').replace('{count}', kpis.totalOrders)}</p>
    </div>
    <div class="stat-card">
      <h3>${translate('kpi_total_profit')}</h3>
      <p class="value" style="color: #28a745;">${Number(kpis.totalProfit).toFixed(2)} DA</p>
      <p class="subtitle">${translate('kpi_subtitle_profit')}</p>
    </div>
    <div class="stat-card">
      <h3>${translate('kpi_outstanding_debt')}</h3>
      <p class="value" style="color: #dc3545;">${Number(kpis.totalDebt).toFixed(2)} DA</p>
      <p class="subtitle">${translate('kpi_subtitle_debt').replace('{count}', borrowerCount).replace('{borrowerText}', borrowerText)}</p>
    </div>
  `;
}

async function renderAllCharts() {
  await createSalesChart(currentDuration);
  createProfitMarginChart();
  createTopProductsChart();
}

function getSelectedCustomRange() {
  const s = document.getElementById('customStart').value;
  const e = document.getElementById('customEnd').value;
  return { s: s || null, e: e || null };
}

// js/statistics.js


async function createSalesChart(duration, start = null, end = null) {
  if (duration === 'custom') {
    const range = getSelectedCustomRange();
    if (!range.s || !range.e) {
      alert(translate('js_alert_custom_range_dates'));
      return;
    }
    start = range.s;
    end = range.e;
  }

  // UPDATED: Destructure the new totalSales and totalProfit values
  const { labels, salesData, profitData, totalSales, totalProfit } = await getSalesDataForChart(duration, start, end, currentAccuracy);

  const ctx = document.getElementById('salesProfitChart').getContext('2d');
  const canvasWidth = ctx.canvas.parentElement.clientWidth || 800;
  const approxTickLimit = Math.max(3, Math.floor(canvasWidth / 80));

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: translate('chart_label_sales'),
          data: salesData,
          borderColor: '#007bff',
          backgroundColor: 'rgba(0,123,255,0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 2
        },
        {
          label: translate('chart_label_profit'),
          data: profitData,
          borderColor: '#28a745',
          backgroundColor: 'rgba(40,167,69,0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        // NEW: Added the title plugin to display the totals
        title: {
          display: true,
          // UPDATED: This text will now show the dynamic totals
          text: `${translate('chart_total_sales')}: ${formatNumber(totalSales)} DA | ${translate('chart_total_profit')}: ${formatNumber(totalProfit)} DA`,
          font: {
            size: 16
          },
          padding: {
            top: 10,
            bottom: 20
          },
          color: '#444' // Optional: Set a color for the title
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: approxTickLimit,
            callback: function(value) { return this.getLabelForValue(value); }
          }
        },
        y: { beginAtZero: true, ticks: { callback: v => formatNumber(v) } }
      }
    }
  };

  if (salesProfitChart) {
    salesProfitChart.data.labels = config.data.labels;
    salesProfitChart.data.datasets = config.data.datasets;
    // UPDATED: Also update the title when the chart is redrawn
    salesProfitChart.options.plugins.title.text = config.options.plugins.title.text;
    salesProfitChart.options.scales.x.ticks.maxTicksLimit = config.options.scales.x.ticks.maxTicksLimit;
    salesProfitChart.update();
  } else {
    salesProfitChart = new Chart(ctx, config);
  }
}
async function createProfitMarginChart() {
  const { totalProfit, totalCost } = await getProfitMarginData();
  const ctx = document.getElementById('profitMarginChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      // Use translate for chart labels
      labels: [translate('chart_label_total_profit'), translate('chart_label_total_cost')],
      datasets: [{ data: [totalProfit, totalCost], backgroundColor: ['#28a745', '#ffc107'], hoverOffset: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

async function createTopProductsChart() {
  const { labels, data } = await getTopSellingProducts();
  const ctx = document.getElementById('topProductsChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      // Use translate for chart labels
      datasets: [{ label: translate('chart_label_quantity_sold'), data, backgroundColor: ['rgba(0,123,255,0.7)','rgba(40,167,69,0.7)','rgba(255,193,7,0.7)','rgba(220,53,69,0.7)','rgba(108,117,125,0.7)'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
  });
}

function setupEventListeners() {
  const durationControls = document.getElementById('salesChartDuration');
  durationControls.addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON') {
      const duration = e.target.dataset.duration;
      durationControls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentDuration = duration;
      if (duration !== 'custom') {
        document.getElementById('customStart').value = '';
        document.getElementById('customEnd').value = '';
        await createSalesChart(duration);
      }
    }
  });

  document.getElementById('applyCustom').addEventListener('click', async () => {
    const start = document.getElementById('customStart').value;
    const end = document.getElementById('customEnd').value;
    if (!start || !end) {
      // Use translate for the alert
      alert(translate('js_alert_custom_range_dates'));
      return;
    }
    currentDuration = 'custom';
    durationControls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    await createSalesChart('custom', start, end);
  });

  document.getElementById('accuracySelect').addEventListener('change', async (e) => {
    currentAccuracy = e.target.value;
    if (currentDuration === 'custom') {
      const { s, e: en } = getSelectedCustomRange();
      if (s && en) await createSalesChart('custom', s, en);
    } else {
      await createSalesChart(currentDuration);
    }
  });

  window.addEventListener('resize', () => {
    if (!salesProfitChart) return;
    setTimeout(() => { createSalesChart(currentDuration); }, 120);
  });
}

function autoFillCustomDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  document.getElementById('customStart').value = start.toISOString().split('T')[0];
  document.getElementById('customEnd').value = end.toISOString().split('T')[0];
}

function formatNumber(num) {
  // Use a saved language from localStorage to format numbers if desired, otherwise default to a locale
  const savedLang = localStorage.getItem('language') || 'en';
  const locale = savedLang === 'ar' ? 'ar-DZ' : 'en-US';
  return num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}