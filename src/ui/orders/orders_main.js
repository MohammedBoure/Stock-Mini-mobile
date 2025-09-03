import { translate } from '../../js/language.js';
import {
  getOrdersWithTotal,
  getProductsInOrder,
  deleteOrder,
  countOrders,
} from '../../js/orders.js';
import { showBorrowerLinkModal } from './borrower_modal.js';
import { showStatsModal } from './stats_modal.js';

// --- Module-level State ---
let ordersList;
let currentPage = 0;
const limit = 20;
let currentSort = { field: 'date', direction: 'desc' };

/**
 * Main entry point for the Orders UI.
 */
export async function setupOrdersUI() {
  ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  setupGlobalEventListeners();
  await renderOrders();
}

/**
 * Sets up listeners for static elements on the page.
 */
function setupGlobalEventListeners() {
  const safeAddListener = (id, event, handler) => {
    const element = document.getElementById(id);
    if (element) { element.addEventListener(event, handler); }
  };

  safeAddListener('newOrderBtn', 'click', () => window.location.href = './pos.html');
  safeAddListener('showStatsBtn', 'click', showStatsModal);
  safeAddListener('sortByDateBtn', 'click', () => sortOrdersBy('date'));
  safeAddListener('sortByTotalBtn', 'click', () => sortOrdersBy('price_sell'));
  safeAddListener('sortByProfitBtn', 'click', () => sortOrdersBy('profit'));
  safeAddListener('closeStatsModal', 'click', () => {
    const statsModal = document.getElementById('statsModal');
    if (statsModal) statsModal.classList.add('hidden');
  });
}

/**
 * Renders the main list of orders.
 */
async function renderOrderList() {
  ordersList.innerHTML = `<li>${translate('loading_orders')}</li>`;
  try {
    const userRole = localStorage.getItem("userRole");
    const offset = currentPage * limit;
    const orders = await getOrdersWithTotal({ sortBy: currentSort.field, ascending: currentSort.direction === 'asc', limit, offset });
    
    if (orders.length === 0 && currentPage === 0) {
      ordersList.innerHTML = `<li>${translate('no_orders_found')}</li>`;
      return;
    }

    ordersList.innerHTML = ''; 

    orders.forEach(order => {
      const div = document.createElement('div');
      div.className = `order-card ${order.has_borrower ? 'borrowed' : ''}`;
      
      const borrowerBadge = order.has_borrower ? `<span class="borrowed-badge">${translate('order_card_borrowed_badge')}</span>` : '';
      const orderTitle = translate('order_card_title').replace('{id}', order.order_id);
      let profitHtml = userRole === 'owner' ? `
        <div class="stat-item">
          <span class="stat-label">${translate('order_card_stat_profit')}</span>
          <span class="stat-value positive">${(order.profit ?? 0).toFixed(2)} DA</span>
        </div>` : '';
       
      div.innerHTML = `
        <div class="order-header">
          <div><span class="order-id">${orderTitle}</span>${borrowerBadge}</div>
          <span class="order-date">${new Date(order.created_at).toLocaleString()}</span>
        </div>
        <div class="card-body-main">
          <div class="order-stats">
            <div class="stat-item">
              <span class="stat-label">${translate('order_card_stat_total')}</span>
              <span class="stat-value">${(order.total_sell ?? 0).toFixed(2)} DA</span>
            </div>
            ${profitHtml}
          </div>
          <div class="order-actions">
            <button class="btn-show-products" data-id="${order.order_id}">👁️<span class="button-text">${translate('btn_view_products')}</span></button>
            ${!order.has_borrower ? `<button class="btn-link-borrower" data-id="${order.order_id}">🔗<span class="button-text">${translate('btn_link_borrower')}</span></button>` : ''}
            <button class="btn-delete" data-id="${order.order_id}">🗑️<span class="button-text">${translate('btn_delete_order')}</span></button>
          </div>
        </div>
        <div id="products-in-order-${order.order_id}" class="products-container hidden"></div>
      `;
      ordersList.appendChild(div);
    });

    attachActionButtonsToOrderItems();
    const total = await countOrders();
    renderMainPagination(total);

  } catch(error) {
    console.error("Failed to render orders:", error);
    ordersList.innerHTML = `<li>${translate('error_loading_orders')}</li>`;
  }
}

/**
 * Attaches event listeners to buttons on each order card.
 */
function attachActionButtonsToOrderItems() {
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (confirm(translate('js_confirm_delete_order').replace('{id}', id))) {
        try {
          await deleteOrder(id);
          await renderOrders();
        } catch (error) {
          console.error("Failed to delete order:", error);
          alert(translate('js_alert_delete_order_error'));
        }
      }
    };
  });

  document.querySelectorAll('.btn-show-products').forEach(btn => {
    btn.onclick = (e) => toggleProductDisplayForOrder(Number(e.currentTarget.dataset.id), e.currentTarget);
  });

  document.querySelectorAll('.btn-link-borrower').forEach(btn => {
    btn.onclick = (e) => {
      const orderId = Number(e.currentTarget.dataset.id);
      showBorrowerLinkModal(orderId, {
        onLinkSuccess: renderOrders,
        showAlert: showAutoDismissAlert
      });
    };
  });
}

/**
 * Sorts the order list and re-renders.
 */
async function sortOrdersBy(field) {
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.field = field;
    currentSort.direction = 'desc';
  }
  currentPage = 0;
  await renderOrders();
}

/**
 * Main render function that updates styles and the list.
 */
async function renderOrders() {
  updateSortButtonStyles();
  await renderOrderList();
}

/**
 * Toggles the visibility of products within an order card.
 */
async function toggleProductDisplayForOrder(orderId, button) {
  const container = document.getElementById(`products-in-order-${orderId}`);
  if (!container) return;

  const isVisible = !container.classList.contains('hidden');
  if (isVisible) {
    container.classList.add('hidden');
    container.innerHTML = '';
    button.innerHTML = `👁️<span class="button-text">${translate('btn_view_products')}</span>`;
  } else {
    container.innerHTML = `
      <div class="product-header">
        <span class="product-name">${translate('product_list_header_name')}</span>
        <span class="product-qty">${translate('product_list_header_qty')}</span>
        <span class="product-price">${translate('product_list_header_price')}</span>
        <span class="product-subtotal">${translate('product_list_header_subtotal')}</span>
      </div>
      <div class="products-list">${translate('picker_loading')}</div>
    `;
    
    container.classList.remove('hidden');
    button.innerHTML = `🔼<span class="button-text">${translate('btn_hide_products')}</span>`;
    
    try {
      const products = await getProductsInOrder(orderId, 100, 0);
      const productsList = container.querySelector('.products-list');
      
      productsList.innerHTML = products.length === 0 
        ? `<div class="product-item">${translate('picker_no_products')}</div>`
        : products.map(p => `
          <div class="product-item">
            <span class="product-name">${p.name}</span>
            <span class="product-qty">${p.quantity}</span>
            <span class="product-price">${p.price_sell.toFixed(2)} DA</span>
            <span class="product-subtotal">${p.subtotal_sell.toFixed(2)} DA</span>
          </div>
        `).join('');
    } catch (error) {
      console.error("Failed to get products for order:", error);
      container.querySelector('.products-list').innerHTML = `<div class="product-item">${translate('picker_error').replace('{error}', '')}</div>`;
    }
  }
}

/**
 * Renders the pagination controls for the main order list.
 */
function renderMainPagination(totalCount) {
  let pagination = document.getElementById('main-pagination');
  if (pagination) pagination.remove();
  
  const totalPages = Math.ceil(totalCount / limit);
  if (totalPages <= 1) return;

  pagination = document.createElement('div');
  pagination.id = 'main-pagination';
  pagination.className = 'pagination-controls';

  const pageInfoText = translate('pagination_page_info').replace('{currentPage}', currentPage + 1).replace('{totalPages}', totalPages);

  pagination.innerHTML = `
    <button id="mainPrevBtn" class="pagination-btn" ${currentPage === 0 ? 'disabled' : ''}>${translate('pagination_prev')}</button>
    <span class="page-info">${pageInfoText}</span>
    <button id="mainNextBtn" class="pagination-btn pagination-btn-next" ${currentPage + 1 >= totalPages ? 'disabled' : ''}>${translate('pagination_next')}</button>
  `;

  ordersList.insertAdjacentElement('afterend', pagination);

  pagination.querySelector('#mainPrevBtn').onclick = () => { currentPage--; renderOrders(); };
  pagination.querySelector('#mainNextBtn').onclick = () => { currentPage++; renderOrders(); };
}

/**
 * Updates the visual style of the sort buttons.
 */
function updateSortButtonStyles() {
  const btnMap = {
    date: document.getElementById('sortByDateBtn'),
    price_sell: document.getElementById('sortByTotalBtn'),
    profit: document.getElementById('sortByProfitBtn'),
  };

  Object.values(btnMap).forEach(btn => {
    if (btn) {
      btn.classList.remove('active');
      btn.querySelector('.sort-arrow')?.remove();
    }
  });

  const activeBtn = btnMap[currentSort.field];
  if (activeBtn) {
    activeBtn.classList.add('active');
    const arrowDirection = currentSort.direction === 'asc' ? '↑' : '↓';
    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'sort-arrow';
    arrowSpan.textContent = ` ${arrowDirection}`;
    activeBtn.appendChild(arrowSpan);
  }
}

/**
 * Displays a temporary, auto-hiding alert message.
 */
function showAutoDismissAlert(message, isSuccess = true) {
  const alertBox = document.createElement('div');
  alertBox.className = `auto-dismiss-alert ${isSuccess ? 'success' : 'error'}`;
  alertBox.textContent = message;
  alertBox.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    padding: 15px 25px; background-color: ${isSuccess ? 'success' : 'error'};
    color: white; border-radius: 8px; z-index: 10001;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2); opacity: 0;
    transition: opacity 0.4s ease-in-out;
  `;
  document.body.appendChild(alertBox);

  setTimeout(() => { alertBox.style.opacity = '1'; }, 10);
  setTimeout(() => {
    alertBox.style.opacity = '0';
    alertBox.addEventListener('transitionend', () => alertBox.remove());
  }, 2500);
}