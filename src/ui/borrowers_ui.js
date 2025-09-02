// ui/borrowers_ui.js

// 1. IMPORT THE TRANSLATE FUNCTION
import { translate } from '../js/language.js';

import {
  getBorrowers,
  getSnapshotOrdersForBorrower,
  updateBorrowerAmountDirect,
  deleteBorrower,
  countBorrowers,
   addBorrower,
} from '../js/borrowers.js';

// --- Module-level State ---
let currentSort = { field: 'date', direction: 'desc' };
let currentPage = 0;
const limit = 12;
let currentSearchTerm = '';
let allOrdersCache = new Map();
let modalFocusOutHandler = null;
let modalClickHandler = null;

export async function setupBorrowersUI() {
  setupPersistentEventListeners();
  await renderBorrowersList();
}

let listenersAttached = false;

function setupPersistentEventListeners() {
  if (listenersAttached) return;
   document.getElementById('addBorrowerBtn').addEventListener('click', handleAddBorrower);

  document.getElementById('sortByDateBtn').addEventListener('click', () => {
    setSort('date');
    renderBorrowersList();
  });
  document.getElementById('sortByAmountBtn').addEventListener('click', () => {
    setSort('amount');
    renderBorrowersList();
  });
  document.getElementById('searchInput').addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.trim();
    currentPage = 0;
    renderBorrowersList();
  });
  // MODIFIED: This now listens for clicks inside the main container OR the new overlay
  document.body.addEventListener('click', handleContainerClick);
  document.getElementById('closeModal')?.addEventListener('click', hideModal);
  // NEW: Add listener for the new overlay's close button
  document.getElementById('closeOrdersOverlay')?.addEventListener('click', hideOrdersOverlay);
  
  listenersAttached = true;
}

function updateSortButtonStates() {
  const dateBtn = document.getElementById('sortByDateBtn');
  const amountBtn = document.getElementById('sortByAmountBtn');
  const baseDateText = translate('btn_sort_by_date');
  const baseAmountText = translate('btn_sort_by_amount');

  if (dateBtn) {
    if (currentSort.field === 'date') {
      dateBtn.classList.add('active');
      dateBtn.innerHTML = `📅<span class="button-text">${baseDateText} ${currentSort.direction === 'asc' ? '↑' : '↓'}</span>`;
    } else {
      dateBtn.classList.remove('active');
      dateBtn.innerHTML = `📅<span class="button-text">${baseDateText}</span>`;
    }
  }

  if (amountBtn) {
    if (currentSort.field === 'amount') {
      amountBtn.classList.add('active');
      amountBtn.innerHTML = `💰<span class="button-text">${baseAmountText} ${currentSort.direction === 'asc' ? '↑' : '↓'}</span>`;
    } else {
      amountBtn.classList.remove('active');
      amountBtn.innerHTML = `💰<span class="button-text">${baseAmountText}</span>`;
    }
  }
}

async function handleContainerClick(e) {
  const button = e.target.closest('button');
  if (!button) return;

  // Handle clicks on "Show Products" inside the overlay
  if (button.matches('.show-products-btn')) {
    const borrowerId = Number(button.dataset.borrowerId);
    const orderId = Number(button.dataset.orderId);
    if (borrowerId && orderId) {
      toggleProductsDisplay(borrowerId, orderId, button);
    }
    return;
  }

  const borrowerCard = button.closest('.borrower-card');
  if (!borrowerCard) return;

  const borrowerId = Number(borrowerCard.dataset.id);
  const borrowerName = borrowerCard.dataset.name;

  if (button.matches('.show-orders-btn')) {
    // NEW: Call the function to show the overlay
    showOrdersOverlay(borrowerId, borrowerName);
  } else if (button.matches('.edit-borrower-btn')) {
    const amount = parseFloat(borrowerCard.dataset.amount);
    handleEditAmount(borrowerId, borrowerName, amount);
  } else if (button.matches('.delete-borrower-btn')) {
    handleDeleteBorrower(borrowerId);
  }
}

function handleEditAmount(borrowerId, name, currentAmount) {
  const title = translate('modal_title_edit_debt').replace('{name}', name);
  
  // The 'edit' mode is default, so we don't need to specify it.
  showModal(title, { amount: currentAmount }, async (values) => {
    await updateBorrowerAmountDirect(borrowerId, values.amount);
    await renderBorrowersList();
  });
}
async function handleAddBorrower() {
  const title = translate('modal_title_add_borrower');
  
  showModal(title, { name: '', amount: '' }, async (values) => {
    await addBorrower({
      name: values.name,
      amount: values.amount,
      date: new Date().toISOString(), // Use the current date
    });
    await renderBorrowersList();
  }, 'add'); // <-- Specify the 'add' mode
}

async function handleDeleteBorrower(borrowerId) {
  if (confirm(translate('js_confirm_delete_borrower'))) {
    await deleteBorrower(borrowerId);
    await renderBorrowersList();
  }
}

function setSort(field) {
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.field = field;
    currentSort.direction = 'asc';
  }
  currentPage = 0;
  updateSortButtonStates();
}

async function renderBorrowersList() {
  const container = document.getElementById('borrowersContainer');
  container.innerHTML = `<p>${translate('loading_borrowers')}</p>`;
  updateSortButtonStates();

  const offset = currentPage * limit;
  const borrowers = await getBorrowers(currentSearchTerm, currentSort.field, currentSort.direction === 'asc', limit, offset);

  if (borrowers.length === 0 && currentPage === 0) {
    container.innerHTML = `<p>${translate('no_borrowers_found')}</p>`;
    renderPagination(0);
    return;
  }

  const cardContainer = document.createElement('div');
  cardContainer.className = 'borrower-cards-container';

  borrowers.forEach(b => {
    const card = document.createElement('div');
    card.className = 'borrower-card';
    card.dataset.id = b.id;
    card.dataset.name = b.name;
    card.dataset.amount = b.amount;

    // SIMPLIFIED: Removed the empty details div
    card.innerHTML = `
      <div class="card-header">
        <strong class="borrower-name">${b.name}</strong>
        <span class="borrower-since">${new Date(b.date).toLocaleDateString()}</span>
      </div>
      <div class="card-body">
        <span class="debt-label">${translate('table_header_total_debt')}</span>
        <span class="debt-amount">${b.amount.toFixed(2)} DA</span>
      </div>
      <div class="card-actions">
        <button class="show-orders-btn">📦<span class="button-text">${translate('btn_orders')}</span></button>
        <button class="edit-borrower-btn">✏️<span class="button-text">${translate('btn_edit')}</span></button>
        <button class="delete-borrower-btn">🗑️<span class="button-text">${translate('btn_delete')}</span></button>
      </div>
    `;
    cardContainer.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(cardContainer);

  const totalCount = await countBorrowers(currentSearchTerm);
  renderPagination(totalCount);
}

// =================================================================
// NEW OVERLAY LOGIC
// =================================================================

async function showOrdersOverlay(borrowerId, borrowerName) {
  const overlay = document.getElementById('ordersOverlay');
  const titleEl = document.getElementById('ordersOverlayTitle');
  const bodyEl = document.getElementById('ordersOverlayBody');

  titleEl.textContent = translate('order_history_for_borrower').replace('{name}', borrowerName);
  bodyEl.innerHTML = `<p>${translate('loading_orders')}</p>`;
  overlay.classList.remove('hidden');

  // Add click listener to close overlay when clicking background
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideOrdersOverlay();
    }
  });

  const orders = await getSnapshotOrdersForBorrower(borrowerId);
  allOrdersCache.set(borrowerId, orders); // Cache for product lookups

  if (orders.length === 0) {
    bodyEl.innerHTML = `<em>${translate('no_historical_orders')}</em>`;
  } else {
    bodyEl.innerHTML = `
      <div class="orders-container-overlay">
        ${orders.map(order => `
          <div class="order-box">
            <span>${translate('order_box_details')
              .replace('{id}', order.order_id)
              .replace('{date}', new Date(order.order_date).toLocaleString())
              .replace('{total}', order.total_price.toFixed(2))}</span>
            <br/>
            <button class="show-products-btn" data-order-id="${order.order_id}" data-borrower-id="${borrowerId}">👁️<span class="button-text">${translate('btn_show_products')}</span></button>
            <div class="products-container" style="display: none;"></div>
          </div>
        `).join('')}
      </div>`;
  }
}

function hideOrdersOverlay() {
  const overlay = document.getElementById('ordersOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    // Clear the body to ensure it's fresh next time
    document.getElementById('ordersOverlayBody').innerHTML = '';
  }
}

// This function is now used inside the overlay, but the logic is the same
function toggleProductsDisplay(borrowerId, orderId, button) {
  const container = button.nextElementSibling;
  const isVisible = container.style.display !== 'none';

  if (isVisible) {
    container.style.display = 'none';
    button.innerHTML = `👁️<span class="button-text">${translate('btn_show_products')}</span>`;
  } else {
    container.style.display = 'block';
    button.innerHTML = `🔼<span class="button-text">${translate('btn_hide_products')}</span>`;
    const orders = allOrdersCache.get(borrowerId);
    const order = orders?.find(o => o.order_id === orderId);
    const products = order?.products || [];

    container.innerHTML = products.length === 0 
      ? `<em>${translate('no_products_in_snapshot')}</em>`
      : products.map(p => 
          translate('product_snapshot_details')
            .replace('{name}', p.name)
            .replace('{quantity}', p.quantity)
            .replace('{price}', p.price_sell.toFixed(2))
        ).join('<br/>');
  }
}

// =================================================================
// UNCHANGED FUNCTIONS
// =================================================================

function renderPagination(totalCount) {
  const container = document.getElementById('pagination-container');
  container.innerHTML = '';
  const totalPages = Math.ceil(totalCount / limit);

  if (totalPages <= 1) return;

  const prev = document.createElement('button');
  prev.className = 'pagination-btn'; // <-- ADD THIS LINE
  prev.textContent = translate('pagination_prev');
  prev.disabled = currentPage === 0;
  prev.onclick = () => { currentPage--; renderBorrowersList(); };
  container.appendChild(prev);

  const pageInfo = document.createElement('span');
  pageInfo.textContent = translate('pagination_page_info')
    .replace('{currentPage}', currentPage + 1)
    .replace('{totalPages}', totalPages);
  container.appendChild(pageInfo);

  const next = document.createElement('button');
  next.className = 'pagination-btn pagination-btn-next'; // <-- ADD THIS LINE
  next.textContent = translate('pagination_next');
  next.disabled = currentPage >= totalPages - 1;
  next.onclick = () => { currentPage++; renderBorrowersList(); };
  container.appendChild(next);
}
// 🟢 ...WITH this new, more flexible version.
function showModal(title, prefill, onSubmit, mode = 'edit') {
  const modal = document.getElementById('borrowerModal');
  const modalContent = modal.querySelector('.modal-content');
  document.getElementById('modalTitle').textContent = title;
  const modalBody = document.getElementById('modalBody');

  // Dynamically create the form fields based on the mode
  const nameInputHTML = mode === 'add'
    ? ` <label for="name">${translate('modal_label_name')}</label>
        <input id="name" type="text" value="${prefill.name ?? ''}" required />`
    : '';

  const buttonText = mode === 'add'
    ? translate('modal_btn_add')
    : translate('modal_btn_update');
    
  modalBody.innerHTML = `
    ${nameInputHTML}
    <label for="amount">${translate('modal_label_new_debt')}</label>
    <input id="amount" type="number" step="0.01" value="${prefill.amount ?? ''}" required />
    <button id="submitModal">${buttonText}</button>
  `;
  modal.classList.remove('hidden');
  
  // Focus the first input field
  const firstInput = modal.querySelector('input');
  if (firstInput) {
    firstInput.focus();
  }

  modalFocusOutHandler = (e) => {
    if (!modalContent.contains(e.relatedTarget)) {
      hideModal();
    }
  };

  modalClickHandler = (e) => {
    if (e.target === modal) {
      hideModal();
    }
  };

  modalContent.addEventListener('focusout', modalFocusOutHandler);
  modal.addEventListener('click', modalClickHandler);

  document.getElementById('submitModal').onclick = async () => {
    const newAmount = parseFloat(document.getElementById('amount').value);
    
    // Prepare the data object to be submitted
    const data = { amount: newAmount };

    if (mode === 'add') {
      const newName = document.getElementById('name').value.trim();
      if (!newName) {
        alert(translate('js_alert_invalid_name'));
        return;
      }
      data.name = newName;
    }

    if (isNaN(newAmount) || newAmount < 0) {
      alert(translate('js_alert_invalid_amount'));
      return;
    }
    
    await onSubmit(data); // Pass the whole data object
    hideModal();
  };
}

function hideModal() {
  const modal = document.getElementById('borrowerModal');
  if(modal) {
    if (modalFocusOutHandler) {
      const modalContent = modal.querySelector('.modal-content');
      modalContent.removeEventListener('focusout', modalFocusOutHandler);
      modalFocusOutHandler = null;
    }
    if (modalClickHandler) {
      modal.removeEventListener('click', modalClickHandler);
      modalClickHandler = null;
    }
    modal.classList.add('hidden');
  }
}