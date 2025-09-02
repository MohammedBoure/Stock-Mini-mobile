// ui/orders_ui.js
import { translate } from '../js/language.js';
import { playSound } from '../js/main.js'; // <-- ADD THIS LINE
import {
  getOrdersWithTotal,
  getProductsInOrder,
  deleteOrder,
  countOrders,
  addOrder,
  getOrderStatistics,

} from '../js/orders.js';
import {
  getProducts,
  searchProducts,
  countProducts,
  getProductById,
} from '../js/products.js';
// Re-add all necessary borrower functions
import {
  getBorrowers,
  addBorrower,
  linkOrderToBorrower,
  countBorrowers,
} from '../js/borrowers.js';

// --- Module-level State ---
let ordersList;
let currentPage = 0;
const limit = 20;
let currentSort = { field: 'date', direction: 'desc' };


let borrowerPickerPage = 0;
const borrowerPickerLimit = 9; // Show 5 borrowers per page
// --- Add Order Modal State ---
let isFirstLoad = true;
const selectedProductsMap = new Map();
let productPickerPage = 0;
const productPickerLimit = 30;

// --- Barcode Scanning (in Modal) State ---
let isScanModeActiveInModal = false;
let barcodeBuffer = '';
let barcodeTimer = null;
const SCAN_TIMEOUT_MS = 500;


let calculatorTargetProductId = null;
let calculatorInputBuffer = '';
/**
 * Main entry point for the Orders UI.
 */
let focusedPickerItemId = null; // Tracks focused product in picker
let focusedCartItemId = null; // Tracks focused product in cart

const style = document.createElement('style');


export async function setupOrdersUI() {
  ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  setupGlobalEventListeners();
  await renderOrders(); // Initial render

  if (isFirstLoad) {
    showOrderModal();
    isFirstLoad = false;
  }
}
async function handleProductSearch(e) {
  const searchInput = e.target;
  const searchTerm = searchInput.value;
  const cursorPosition = searchInput.selectionStart; // Remember cursor position

  productPickerPage = 0;
  await renderProductPicker(searchTerm.trim());

  // After the picker re-renders and potentially steals focus,
  // return the focus to the search input where the user was typing.
  searchInput.focus();
  // Restore the cursor's position so typing is not interrupted.
  searchInput.setSelectionRange(cursorPosition, cursorPosition);
}

function setupGlobalEventListeners() {
    const safeAddListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) { element.addEventListener(event, handler); }
    };
    safeAddListener('addOrderBtn', 'click', showOrderModal);
    safeAddListener('showStatsBtn', 'click', showStatsModal);
    safeAddListener('sortByDateBtn', 'click', () => sortOrdersBy('date'));
    safeAddListener('sortByTotalBtn', 'click', () => sortOrdersBy('price_sell'));
    safeAddListener('sortByProfitBtn', 'click', () => sortOrdersBy('profit'));
    safeAddListener('closeModal', 'click', hideOrderModal);
    safeAddListener('closeBorrowerModal', 'click', hideBorrowerModal);
    safeAddListener('closeStatsModal', 'click', () => {
        const statsModal = document.getElementById('statsModal');
        if (statsModal) statsModal.classList.add('hidden');
    });
}
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

        ordersList.innerHTML = ''; // Clear the list before appending new cards

        orders.forEach(order => {
            const div = document.createElement('div');
            div.className = `order-card ${order.has_borrower ? 'borrowed' : ''}`;
            
            const borrowerBadge = order.has_borrower ? `<span class="borrowed-badge">${translate('order_card_borrowed_badge')}</span>` : '';
            
            const orderTitle = translate('order_card_title').replace('{id}', order.order_id);

            let profitHtml = '';
            if (userRole === 'owner') {
                profitHtml = `
                    <div class="stat-item">
                        <span class="stat-label">${translate('order_card_stat_profit')}</span>
                        <span class="stat-value positive">${(order.profit ?? 0).toFixed(2)} DA</span>
                    </div>
                `;
            }
             
            div.innerHTML = `
                <div class="order-header">
                    <div>
                        <span class="order-id">${orderTitle}</span>
                        ${borrowerBadge}
                    </div>
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
async function processModalBarcodeBuffer() {
  if (barcodeBuffer.length === 0) return;
  playSound('./assets/store-scanner-beep-90395.mp3'); // <-- ADD THIS LINE
  const scannedId = Number(barcodeBuffer);
  const feedback = document.getElementById('scanFeedback');
  barcodeBuffer = '';
  feedback.textContent = translate('scan_mode_processing').replace('{id}', scannedId);
  await addProductToSelection(scannedId, 1, true);
  setTimeout(() => {
    if (isScanModeActiveInModal) {
      feedback.textContent = translate('scan_mode_active_in_modal');
    }
  }, 1000);
}
/**
 * Sets up listeners for static elements on the page.
 */


// =================================================================
// BORROWER MODAL LOGIC (NEW SECTION)
// =================================================================

/**
 * Shows the modal to link an order to a borrower.
 * @param {number} orderId The ID of the order to be linked.
 */
async function showBorrowerModal(orderId) {
    const modal = document.getElementById('borrowerModal');
     modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideBorrowerModal();
        }
    });
    const body = document.getElementById('borrowerModalBody');
    const title = modal.querySelector('h2');
    
    title.textContent = translate('borrower_modal_title').replace('{id}', orderId);
    
    // Set up the static HTML structure ONCE.
    body.innerHTML = `
        <input type="text" id="borrowerSearchInput" placeholder="${translate('placeholder_search_borrowers')}" style="width: 95%; padding: 8px; margin-bottom: 10px;">
        <div id="borrower-list-container"></div> <!-- Container for the dynamic list -->
        <hr>
        <h4>${translate('borrower_modal_add_new_title')}</h4>
        <div class="add-borrower-form">
            <input type="text" id="newBorrowerNameInput" placeholder="${translate('placeholder_new_borrower_name')}">
            <button id="addNewBorrowerAndLinkBtn">${translate('btn_add_and_link')}</button>
        </div>
    `;

    // Attach listener to the persistent search bar ONCE.
    document.getElementById('borrowerSearchInput').addEventListener('input', (e) => {
        borrowerPickerPage = 0; // Reset page on new search
        renderBorrowerList(orderId, e.target.value); // Re-render ONLY the list
    });

    document.getElementById('addNewBorrowerAndLinkBtn').onclick = () => handleAddNewBorrowerAndLink(orderId);
    
    modal.classList.remove('hidden');
    
    borrowerPickerPage = 0;
    await renderBorrowerList(orderId, ''); // Initial render of the list
}

/**
 * Renders the content inside the borrower modal.
 * @param {number} orderId The ID of the order being linked.
 * @param {Array<Object>} borrowers The list of existing borrowers.
 */
async function renderBorrowerList(orderId, searchTerm = '') {
    const listContainer = document.getElementById('borrower-list-container');
    if (!listContainer) return;
    
    listContainer.innerHTML = `<div class="borrower-grid">${translate('loading_borrowers')}</div>`;

    try {
        const offset = borrowerPickerPage * borrowerPickerLimit;
        const borrowers = await getBorrowers(searchTerm, 'name', true, borrowerPickerLimit, offset);
        const totalBorrowers = await countBorrowers(searchTerm);
        
        let gridHtml = '<div class="borrower-grid">';
        
        if (borrowers.length === 0) {
            gridHtml += `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #666;">${translate('no_borrowers_found')}</div>`;
        } else {
            // In renderBorrowerList()
borrowers.forEach(b => {
  const initial = b.name.charAt(0).toUpperCase();
  gridHtml += `
    <div class="borrower-card" data-borrower-id="${b.id}">
      <div class="borrower-initial">${initial}</div>
      <div class="borrower-name">${b.name}</div>
      <div class="borrower-meta">Since ${new Date(b.date).toLocaleDateString()}</div>
    </div>
                `;
            });
        }
        
        gridHtml += '</div>';

        // Pagination controls
        const totalPages = Math.ceil(totalBorrowers / borrowerPickerLimit);
        if (totalPages > 1) {
            gridHtml += `
                <div class="pagination-controls">
                    <button id="borrowerPrevBtn" class="pagination-btn" ${borrowerPickerPage === 0 ? 'disabled' : ''}>
                        ${translate('pagination_prev')}
                    </button>
                    <span class="page-info">${translate('pagination_page_info').replace('{currentPage}', borrowerPickerPage + 1).replace('{totalPages}', totalPages)}</span>
                    <button id="borrowerNextBtn" class="pagination-btn" ${borrowerPickerPage + 1 >= totalPages ? 'disabled' : ''}>
                        ${translate('pagination_next')}
                    </button>
                </div>
            `;
        }

        listContainer.innerHTML = gridHtml;
        
        // Attach click handlers to each card
        listContainer.querySelectorAll('.borrower-card').forEach(card => {
            card.addEventListener('click', () => {
                const borrowerId = Number(card.dataset.borrowerId);
                handleLinkToBorrower(orderId, borrowerId);
            });
        });

        // Pagination event listeners
        listContainer.querySelector('#borrowerPrevBtn')?.addEventListener('click', () => {
            borrowerPickerPage--;
            renderBorrowerList(orderId, searchTerm);
        });
        
        listContainer.querySelector('#borrowerNextBtn')?.addEventListener('click', () => {
            borrowerPickerPage++;
            renderBorrowerList(orderId, searchTerm);
        });

    } catch (error) {
        console.error("Failed to render borrower list:", error);
        listContainer.innerHTML = `<div class="borrower-grid" style="grid-column: 1/-1; text-align: center; padding: 30px; color: #666;">${translate('error_loading_borrowers')}</div>`;
    }
}

// Add this new function in the BORROWER MODAL LOGIC section
async function renderBorrowerPicker(orderId, searchTerm = '') {
    const body = document.getElementById('borrowerModalBody');
    body.innerHTML = `<p>${translate('loading_borrowers')}</p>`;

    try {
        const offset = borrowerPickerPage * borrowerPickerLimit;
        const borrowers = await getBorrowers(searchTerm, 'name', true, borrowerPickerLimit, offset);
        const totalBorrowers = await countBorrowers(searchTerm);
        
        renderBorrowerModalContent(orderId, borrowers, searchTerm, totalBorrowers);

    } catch (error) {
        console.error("Failed to render borrower picker:", error);
        body.innerHTML = `<p>${translate('error_loading_borrowers')}</p>`;
    }
}
// Replace the existing renderBorrowerModalContent function
function renderBorrowerModalContent(orderId, borrowers, searchTerm, totalBorrowers) {
    const body = document.getElementById('borrowerModalBody');
    
    body.innerHTML = `
      <div class="borrower-modal-container">
        <div class="borrower-search-container">
          <input type="text" id="borrowerSearchInput" class="borrower-search-input" 
                 placeholder="${translate('placeholder_search_borrowers')}" value="${searchTerm}">
        </div>
        
        <div class="borrower-list" id="borrower-list-container">
          ${borrowers.length === 0 ? 
            `<p style="text-align: center; color: #666;">${translate('no_borrowers_found')}</p>` : 
            borrowers.map(b => `
              <div class="borrower-card">
                <div class="borrower-info">
                  <div class="borrower-name">${b.name}</div>
                  <div class="borrower-meta">Joined: ${new Date(b.date).toLocaleDateString()}</div>
                </div>
                <button class="select-borrower-btn" data-borrower-id="${b.id}">
                  Select
                </button>
              </div>
            `).join('')
          }
        </div>
        
        ${totalBorrowers > borrowerPickerLimit ? `
          <div class="pagination-controls">
            <button id="borrowerPrevBtn" class="pagination-btn" ${borrowerPickerPage === 0 ? 'disabled' : ''}>
              ${translate('pagination_prev')}
            </button>
            <span class="page-info">${translate('pagination_page_info').replace('{currentPage}', borrowerPickerPage + 1).replace('{totalPages}', Math.ceil(totalBorrowers / borrowerPickerLimit))}</span>
            <button id="borrowerNextBtn" class="pagination-btn" ${borrowerPickerPage + 1 >= Math.ceil(totalBorrowers / borrowerPickerLimit) ? 'disabled' : ''}>
              ${translate('pagination_next')}
            </button>
          </div>
        ` : ''}
        
        <div class="add-borrower-section">
          <div class="add-borrower-title">${translate('borrower_modal_add_new_title')}</div>
          <div class="add-borrower-form">
            <input type="text" id="newBorrowerNameInput" class="new-borrower-input" 
                   placeholder="${translate('placeholder_new_borrower_name')}">
            <button id="addNewBorrowerAndLinkBtn" class="add-borrower-btn">
              ${translate('btn_add_and_link')}
            </button>
          </div>
        </div>
      </div>
    `;

    // --- Attach Event Listeners ---
    document.getElementById('borrowerSearchInput').addEventListener('input', (e) => {
        borrowerPickerPage = 0;
        renderBorrowerPicker(orderId, e.target.value);
    });
    
    document.getElementById('borrowerPrevBtn')?.addEventListener('click', () => {
        borrowerPickerPage--;
        renderBorrowerPicker(orderId, searchTerm);
    });

    document.getElementById('borrowerNextBtn')?.addEventListener('click', () => {
        borrowerPickerPage++;
        renderBorrowerPicker(orderId, searchTerm);
    });
    
    document.querySelectorAll('.select-borrower-btn').forEach(btn => {
        btn.onclick = () => handleLinkToBorrower(orderId, Number(btn.dataset.borrowerId));
    });

    document.getElementById('addNewBorrowerAndLinkBtn').onclick = () => handleAddNewBorrowerAndLink(orderId);
}

/**
 * Handles linking an order to an existing borrower.
 */
async function handleLinkToBorrower(orderId, borrowerId) {
    try {
        const result = await linkOrderToBorrower(orderId, borrowerId);
        
        if (result && result.success === false) {
             alert(result.error || translate('js_alert_order_already_linked'));
             return;
        }

        showAutoDismissAlert(translate('js_alert_link_successful').replace('{id}', orderId));
        hideBorrowerModal();
        await renderOrders(); // Refresh list to show "(BORROWED)"
    } catch (error) {
        console.error("Failed to link order to borrower:", error);
        alert(translate('js_alert_link_error'));
    }
}

/**
 * Handles creating a new borrower and immediately linking the order.
 */
async function handleAddNewBorrowerAndLink(orderId) {
    const nameInput = document.getElementById('newBorrowerNameInput');
    const name = nameInput.value.trim();

    if (!name) {
        alert(translate('js_alert_enter_borrower_name'));
        return;
    }

    try {
        const newBorrowerId = await addBorrower({
            name: name,
            date: new Date().toISOString(),
            amount: 0 // Debt is tracked via snapshots, not this field
        });

        await handleLinkToBorrower(orderId, newBorrowerId);
        
    } catch (error) {
        console.error("Failed to create and link new borrower:", error);
        alert(translate('js_alert_create_link_error'));
    }
}

/**
 * Hides the borrower selection modal.
 */
function hideBorrowerModal() {
    const modal = document.getElementById('borrowerModal');
    modal.classList.add('hidden');
    document.getElementById('borrowerModalBody').innerHTML = ''; // Clean up content
}


// =================================================================
// ADD NEW ORDER MODAL - CORE LOGIC (Unchanged)
// =================================================================
function renderSelectedProducts() {
  const container = document.getElementById('selectedProductsContainer');
  const totalContainer = document.getElementById('orderTotal');
  container.innerHTML = '';
  let grandTotal = 0;

  if (selectedProductsMap.size === 0) {
    container.innerHTML = `<p>${translate('cart_empty_message')}</p>`;
    totalContainer.innerHTML = '';
    focusedCartItemId = null;
    return;
  }

  selectedProductsMap.forEach((data, id) => {
    const subtotal = data.price_sell * data.quantity;
    grandTotal += subtotal;
    const div = document.createElement('div');
    div.className = `selected-item ${id === focusedCartItemId ? 'focused' : ''}`;
    div.setAttribute('tabindex', '0');
    div.dataset.id = id;
    div.addEventListener('click', () => {
      focusedCartItemId = id;
      calculatorTargetProductId = id;
      calculatorInputBuffer = '';
      renderSelectedProducts();
      updateCalculatorDisplay();
    });

    const stockInfo = translate('cart_stock_info').replace('{stock}', data.stock);

    div.innerHTML = `
      <span>${data.name} <span class="stock-info">${stockInfo}</span></span>
      <div class="item-controls">
        <button class="qty-minus" data-id="${id}">-</button>
        <input type="number" min="1" value="${data.quantity}" data-id="${id}" class="quantity-input" />
        <button class="qty-plus" data-id="${id}">+</button>
        <span>x ${data.price_sell.toFixed(2)} = ${subtotal.toFixed(2)} DA</span>
        <button class="remove-item-btn" data-id="${id}">❌</button>
      </div>
    `;
    container.appendChild(div);
  });

  totalContainer.innerHTML = `<strong>${translate('cart_total_label')} ${grandTotal.toFixed(2)} DA</strong>`;

  container.querySelectorAll('.quantity-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = Number(e.target.dataset.id);
      const newQuantity = parseInt(e.target.value, 10);
      if (newQuantity > 0) {
        selectedProductsMap.get(id).quantity = newQuantity;
      } else {
        selectedProductsMap.delete(id);
        if (focusedCartItemId === id) focusedCartItemId = null;
        if (calculatorTargetProductId === id) calculatorTargetProductId = null;
      }
      renderSelectedProducts();
      updateCalculatorDisplay();
    });
  });

  container.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      if (selectedProductsMap.has(id)) {
        selectedProductsMap.get(id).quantity += 1;
        focusedCartItemId = id;
        renderSelectedProducts();
        updateCalculatorDisplay();
      }
    });
  });

  container.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      if (selectedProductsMap.has(id)) {
        const product = selectedProductsMap.get(id);
        product.quantity -= 1;
        if (product.quantity <= 0) {
          selectedProductsMap.delete(id);
          if (focusedCartItemId === id) focusedCartItemId = null;
          if (calculatorTargetProductId === id) calculatorTargetProductId = null;
        }
        focusedCartItemId = id;
        renderSelectedProducts();
        updateCalculatorDisplay();
      }
    });
  });

  container.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.target.dataset.id);
      selectedProductsMap.delete(id);
      if (focusedCartItemId === id) focusedCartItemId = null;
      if (calculatorTargetProductId === id) calculatorTargetProductId = null;
      renderSelectedProducts();
      updateCalculatorDisplay();
    });
  });

  if (focusedCartItemId) {
    const focusedItem = container.querySelector(`.selected-item[data-id="${focusedCartItemId}"]`);
    if (focusedItem) {
      focusedItem.focus();
      focusedItem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }
}   
function showOrderModal() {
  const modal = document.getElementById('orderModal');
  modal.classList.remove('hidden');
   modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideOrderModal();
    }
  });
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-scrollable">
  <div class="order-modal-header">
    <button id="scanModeInModalBtn">${translate('modal_scan_mode_btn')}</button>
    <input type="text" id="productSearchInput" placeholder="${translate('modal_placeholder_search_products')}" />
    <button id="calculatorToggleBtn" class="calculator-toggle-btn">🔢</button>
    <button id="submitOrderBtn" class="submit-button">${translate('modal_submit_order_btn')}</button>
  </div>
  <div id="scanFeedback" class="scanner-feedback-container hidden"></div>
  <div class="order-modal-content">
    <div class="selected-products-section">
      <h3>${translate('modal_section_title_selected')}</h3>
      <div id="orderTotal"></div>
      <div id="selectedProductsContainer">${translate('cart_empty_message')}</div>
    </div>
    <div id="qtyCalculator" class="qty-calculator hidden">
      <div class="calc-display-area">
        <div id="calcHeader">${translate('calc_header_no_product')}</div>
        <div id="calcQtyDisplay">0</div>
      </div>
      <div id="calcKeypad" class="calc-keypad">
        <button class="calc-btn" data-key="1">1</button>
        <button class="calc-btn" data-key="2">2</button>
        <button class="calc-btn" data-key="3">3</button>
        <button class="calc-btn" data-key="4">4</button>
        <button class="calc-btn" data-key="5">5</button>
        <button class="calc-btn" data-key="6">6</button>
        <button class="calc-btn" data-key="7">7</button>
        <button class="calc-btn" data-key="8">8</button>
        <button class="calc-btn" data-key="9">9</button>
        <button class="calc-btn confirm" data-key="set">Set</button>
        <button class="calc-btn" data-key="0">0</button>
        <button class="calc-btn function" data-key="clear">C</button>
      </div>
    </div>
    <div class="product-picker-section">
      <h3>${translate('modal_section_title_add')}</h3>
      <div id="productListInModal"></div>
    </div>
  </div>
</div>
  `;
  
  const modalContent = modal.querySelector('.modal-content');
  modalContent.setAttribute('tabindex', '0'); // Make modal focusable
  
  // Add focusout event listener to close modal only when tabbing outside modal
  modalContent.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !modal.contains(e.relatedTarget)) {
      hideOrderModal();
    }
  });

  document.getElementById('productSearchInput').addEventListener('input', handleProductSearch);
  document.getElementById('submitOrderBtn').addEventListener('click', handleSubmitOrder);
  document.getElementById('scanModeInModalBtn').addEventListener('click', toggleScanModeInModal);
document.addEventListener('keydown', handleModalMasterKeydown);
  document.getElementById('calculatorToggleBtn').addEventListener('click', toggleCalculator);
  document.getElementById('calcKeypad').addEventListener('click', (e) => {
    if (e.target.matches('.calc-btn')) {
      const key = e.target.dataset.key;
      handleCalculatorKey(key);
    }
  });
  document.getElementById('productSearchInput').focus();
  renderSelectedProducts();
  renderProductPicker();
}

function toggleCalculator() {
  const calculator = document.getElementById('qtyCalculator');
  if (calculator.classList.contains('hidden')) {
    updateCalculatorDisplay();
    calculator.classList.remove('hidden');
  } else {
    calculator.classList.add('hidden');
  }
}
function updateCalculatorDisplay() {
  const header = document.getElementById('calcHeader');
  const display = document.getElementById('calcQtyDisplay');

  if (calculatorTargetProductId && selectedProductsMap.has(calculatorTargetProductId)) {
    const product = selectedProductsMap.get(calculatorTargetProductId);
    header.textContent = product.name;
    // Display the buffer if it has content, otherwise show the product's current quantity
    display.textContent = calculatorInputBuffer || product.quantity;
  } else {
    header.textContent = translate('calc_header_no_product');
    display.textContent = '0';
  }
}





function hideOrderModal() {
  const modal = document.getElementById('orderModal');
  modal.classList.add('hidden');
  isFirstLoad = false;
  selectedProductsMap.clear();
  isScanModeActiveInModal = false;
  barcodeBuffer = '';
  clearTimeout(barcodeTimer);
 document.removeEventListener('keydown', handleModalMasterKeydown);
}

/**
 * Handles any key press on the calculator keypad.
 * @param {string} key - The key that was pressed (e.g., '1', 'clear', 'set').
 */
function handleCalculatorKey(key) {
  if (!calculatorTargetProductId) return; // Do nothing if no product is selected

  if (key >= '0' && key <= '9') {
    calculatorInputBuffer += key;
  } else if (key === 'clear') {
    calculatorInputBuffer = '';
  } else if (key === 'set') {
    setCalculatorQuantity();
    return; // Exit after setting
  }
  
  updateCalculatorDisplay(); // Update the visual display with the new buffer content
}


function setCalculatorQuantity() {
  if (!calculatorTargetProductId) return;

  // Use the buffer to get the new quantity. If buffer is empty, do nothing.
  const newQuantity = parseInt(calculatorInputBuffer, 10);
  if (isNaN(newQuantity)) {
    calculatorInputBuffer = ''; // Just clear the buffer
    updateCalculatorDisplay();
    return;
  }

  if (newQuantity <= 0) {
    selectedProductsMap.delete(calculatorTargetProductId);
    // Unset the target and hide the calculator since the item is gone
    calculatorTargetProductId = null;
    document.getElementById('qtyCalculator').classList.add('hidden');
  } else {
    const product = selectedProductsMap.get(calculatorTargetProductId);
    product.quantity = newQuantity;
  }
  
  calculatorInputBuffer = ''; // Clear buffer after setting
  renderSelectedProducts(); // Refresh the main list of selected items
  updateCalculatorDisplay(); // Refresh the calculator display to show the new official quantity
}
async function handleSubmitOrder() {
  if (selectedProductsMap.size === 0) {
    alert(translate('js_alert_add_product_to_order'));
    return;
  }
  const productsList = Array.from(selectedProductsMap.entries()).map(([product_id, data]) => ({
    product_id: Number(product_id),
    quantity: data.quantity
  }));
  try {
    await addOrder(productsList);
    showAutoDismissAlert(translate('js_alert_order_submit_success'));
    selectedProductsMap.clear();
    productPickerPage = 0;
    document.getElementById('productSearchInput').value = '';
    renderSelectedProducts();
    await renderProductPicker();
    await renderOrders();
  } catch (error) {
    console.error("❌ Failed to submit order:", error);
    alert(translate('js_alert_order_submit_error').replace('{error}', error.message), false);
  }
}

function toggleScanModeInModal() {
  isScanModeActiveInModal = !isScanModeActiveInModal;
  const feedback = document.getElementById('scanFeedback');
  const scanBtn = document.getElementById('scanModeInModalBtn');
  const searchInput = document.getElementById('productSearchInput');
  barcodeBuffer = '';
  if (isScanModeActiveInModal) {
    feedback.textContent = translate('scan_mode_active_in_modal');
    feedback.classList.remove('hidden');
    scanBtn.textContent = translate('btn_cancel_scan');
    scanBtn.classList.add('active');
    searchInput.classList.add('scan-active'); // Add scan-active class
    searchInput.disabled = true;
  } else {
    feedback.classList.add('hidden');
    scanBtn.textContent = translate('modal_scan_mode_btn');
    scanBtn.classList.remove('active');
    searchInput.classList.remove('scan-active'); // Remove scan-active class
    searchInput.disabled = false;
    searchInput.focus(); // Refocus input when scan mode is deactivated
  }
}
function handleListNavigation(e) {
  console.log("Key pressed:", e.key);
}
// REPLACE your old handleModalKeyPress with THIS function
function handleModalMasterKeydown(e) {
  // --- Part 1: Handle Scan Mode (as you fixed it) ---
  if (isScanModeActiveInModal) {
    e.preventDefault();
    if (e.key === 'Enter') {
      // Your logic: process the buffer and submit the order immediately.
      processModalBarcodeBuffer();
      handleSubmitOrder(); 
    } else if (e.key === 'Escape') {
      toggleScanModeInModal();
    } else if (/^\d$/.test(e.key)) {
      barcodeBuffer += e.key;
      document.getElementById('scanFeedback').textContent = translate('scan_mode_scanning').replace('{buffer}', barcodeBuffer);
      clearTimeout(barcodeTimer);
      barcodeTimer = setTimeout(processModalBarcodeBuffer, SCAN_TIMEOUT_MS);
    }
    return; // Stop processing if in scan mode
  }

  // --- Part 2: Handle Normal Mode ---
  switch (e.key) {
    case 'Enter':
      // The ONLY job for the Enter key now is to submit the order.
      e.preventDefault();
      handleSubmitOrder();
      break;

    case 'ArrowUp':
    case 'ArrowDown':
      // Arrow keys are ONLY for list navigation.
      const activeElement = document.activeElement;
      const isInPicker = activeElement.closest('#productListInModal');
      const isInCart = activeElement.closest('#selectedProductsContainer');
      
      if (!isInPicker && !isInCart) return;
      e.preventDefault();

      const items = isInPicker
        ? [...document.querySelectorAll('#productListInModal .picker-item')]
        : [...document.querySelectorAll('#selectedProductsContainer .selected-item')];
      
      if (items.length === 0) return;

      let currentIndex = items.findIndex(item => item === activeElement);
      if (currentIndex === -1) currentIndex = 0;

      let newIndex = e.key === 'ArrowUp'
        ? (currentIndex > 0 ? currentIndex - 1 : items.length - 1)
        : (currentIndex < items.length - 1 ? currentIndex + 1 : 0);
      
      items[newIndex]?.focus();
      break;
  }
}
/**
 * Adds a product to the order's selection map or updates its quantity.
 * It also sets the calculator to target this product.
 * @param {number} productId - The ID of the product to add.
 * @param {number} quantity - The quantity to set or add.
 * @param {boolean} increment - If true, adds to the existing quantity instead of overwriting.
 */
async function addProductToSelection(productId, quantity = 1, increment = false) {
  try {
    // 1. Fetch the product details from the database
    const product = await getProductById(productId);
    if (!product) {
      alert(translate('product_not_found_alert_short').replace('{id}', productId));
      return; // Exit if the product doesn't exist
    }

    // 2. Check if the product is already in the order
    if (selectedProductsMap.has(productId)) {
      // If it exists, update its quantity
      const existingProduct = selectedProductsMap.get(productId);
      
      if (increment) {
        // Add to the current quantity (e.g., from scanner or "Add" button)
        existingProduct.quantity += quantity;
      } else {
        // Set a specific quantity (not used by default, but good to have)
        existingProduct.quantity = quantity;
      }
    } else {
      // If it's a new product, add it to the map with its details
      selectedProductsMap.set(productId, { ...product, quantity: quantity });
    }

    // 3. Update the calculator's state
    calculatorTargetProductId = productId; // Target this product
    calculatorInputBuffer = '';            // Clear any previous typing

    // 4. Re-render the UI to reflect all changes
    renderSelectedProducts();      // Update the list of selected products
    updateCalculatorDisplay();     // Update the calculator's display with the new target

  } catch (error) {
    console.error("Error adding product to selection:", error);
    alert(translate('error_add_product_to_selection'));
  }
}






























async function renderProductPicker(search = '') {
  const container = document.getElementById('productListInModal');
  if (!container) {
    console.error('Product list container not found');
    return;
  }
  container.innerHTML = `<p>${translate('picker_loading')}</p>`;
  try {
    const offset = productPickerPage * productPickerLimit;
    const { products, total } = search
      ? { products: await searchProducts(search, { limit:productPickerLimit, offset }), total: await countProducts(search) }
      : { products: await getProducts({ limit: productPickerLimit, offset }), total: await countProducts() };

    if (products.length === 0) {
      container.innerHTML = `<p>${translate('picker_no_products')}</p>`;
      focusedPickerItemId = null;
      return;
    }

    container.innerHTML = products.map(p => `
      <div class="picker-item ${p.id === focusedPickerItemId ? 'focused' : ''}" tabindex="0" data-id="${p.id}">
        <span>${p.name} (${p.price_sell.toFixed(2)} DA)</span>
        <button data-id="${p.id}">➕ ${translate('btn_add_product')}</button>
      </div>
    `).join('');

    container.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        focusedPickerItemId = Number(item.dataset.id);
        addProductToSelection(Number(item.dataset.id), 1, true);
      });
    
    });

   

    if (!focusedPickerItemId && products.length > 0) {
      focusedPickerItemId = products[0].id;
    }
    if (focusedPickerItemId) {
      const focusedItem = container.querySelector(`.picker-item[data-id="${focusedPickerItemId}"]`);
      if (focusedItem) {
        focusedItem.focus();
        focusedItem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }

    renderProductPickerPagination(total, search);
  } catch (error) {
    console.error("Failed to render product picker:", error);
    container.innerHTML = `<p>${translate('picker_error').replace('{error}', error.message)}</p>`;
    focusedPickerItemId = null;
  }
}

function renderProductPickerPagination(totalCount, search) {
  const container = document.getElementById('productListInModal');
  const totalPages = Math.ceil(totalCount / productPickerLimit);

  let pagination = document.getElementById('picker-pagination');
  if (pagination) pagination.remove();

  if (totalPages <= 1) return;

  pagination = document.createElement('div');
  pagination.id = 'picker-pagination';
  pagination.className = 'pagination-controls';

  const prev = document.createElement('button');
  prev.textContent = translate('pagination_prev');
  prev.disabled = productPickerPage === 0;
  prev.onclick = () => {
    productPickerPage--;
    renderProductPicker(search);
  };
  pagination.appendChild(prev);

  const pageInfo = document.createElement('span');
  pageInfo.textContent = translate('pagination_page_info')
    .replace('{currentPage}', productPickerPage + 1)
    .replace('{totalPages}', totalPages);
  pagination.appendChild(pageInfo);

  const next = document.createElement('button');
  next.textContent = translate('pagination_next');
  next.disabled = productPickerPage >= totalPages - 1;
  next.onclick = () => {
    productPickerPage++;
    renderProductPicker(search);
  };
  pagination.appendChild(next);

  container.appendChild(pagination);
}

function updateSortButtonStyles() {
    const btnMap = {
        date: document.getElementById('sortByDateBtn'),
        price_sell: document.getElementById('sortByTotalBtn'),
        profit: document.getElementById('sortByProfitBtn'),
    };

    for (const key in btnMap) {
        const btn = btnMap[key];
        if (btn) {
            btn.classList.remove('active');
            const oldArrow = btn.querySelector('.sort-arrow');
            if (oldArrow) oldArrow.remove();
        }
    }

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

async function renderOrders() {
  updateSortButtonStyles();
  await renderOrderList();
}


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
    btn.onclick = (e) => {
      toggleProductDisplayForOrder(Number(e.currentTarget.dataset.id), e.currentTarget);
    };
  });

  document.querySelectorAll('.btn-link-borrower').forEach(btn => {
    btn.onclick = (e) => {
        showBorrowerModal(Number(e.currentTarget.dataset.id));
    };
  });
}

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
      
      if (products.length === 0) {
        productsList.innerHTML = `<div class="product-item">${translate('picker_no_products')}</div>`;
      } else {
        productsList.innerHTML = products.map(p => `
          <div class="product-item">
            <span class="product-name">${p.name}</span>
            <span class="product-qty">${p.quantity}</span>
            <span class="product-price">${p.price_sell.toFixed(2)} DA</span>
            <span class="product-subtotal">${p.subtotal_sell.toFixed(2)} DA</span>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error("Failed to get products for order:", error);
      container.querySelector('.products-list').innerHTML = `<div class="product-item">${translate('picker_error').replace('{error}', '')}</div>`;
    }
  }
}

function renderMainPagination(totalCount) {
  let pagination = document.getElementById('main-pagination');
  if (pagination) pagination.remove();
  
  const totalPages = Math.ceil(totalCount / limit);
  if (totalPages <= 1) return;

  pagination = document.createElement('div');
  pagination.id = 'main-pagination';
  pagination.className = 'pagination-controls';

  const pageInfoText = translate('pagination_page_info')
      .replace('{currentPage}', currentPage + 1)
      .replace('{totalPages}', totalPages);

  pagination.innerHTML = `
      <button id="mainPrevBtn" class="pagination-btn" ${currentPage === 0 ? 'disabled' : ''}>${translate('pagination_prev')}</button>
      <span class="page-info">${pageInfoText}</span>
      <button id="mainNextBtn" class="pagination-btn pagination-btn-next" ${currentPage + 1 >= totalPages ? 'disabled' : ''}>${translate('pagination_next')}</button>
  `;

  ordersList.insertAdjacentElement('afterend', pagination);

  pagination.querySelector('#mainPrevBtn').onclick = () => { currentPage--; renderOrders(); };
  pagination.querySelector('#mainNextBtn').onclick = () => { currentPage++; renderOrders(); };
}



// Add this new function
function showAutoDismissAlert(message, isSuccess = true) {
  const alertBox = document.createElement('div');
  alertBox.className = `auto-dismiss-alert ${isSuccess ? 'success' : 'error'}`;
  alertBox.textContent = message;

  // Basic styling for the alert box
  alertBox.style.position = 'fixed';
  alertBox.style.top = '20px';
  alertBox.style.left = '50%';
  alertBox.style.transform = 'translateX(-50%)';
  alertBox.style.padding = '15px 25px';
  alertBox.style.backgroundColor = isSuccess ? '#4CAF50' : '#f44336';
  alertBox.style.color = 'white';
  alertBox.style.borderRadius = '8px';
  alertBox.style.zIndex = '10001';
  alertBox.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  alertBox.style.opacity = '0';
  alertBox.style.transition = 'opacity 0.4s ease-in-out';
  
  document.body.appendChild(alertBox);

  // Fade in
  setTimeout(() => {
    alertBox.style.opacity = '1';
  }, 10);

  // Fade out and remove after 2.5 seconds
  setTimeout(() => {
    alertBox.style.opacity = '0';
    alertBox.addEventListener('transitionend', () => alertBox.remove());
  }, 2500);
}







async function showStatsModal() {
  const modal = document.getElementById('statsModal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
  const body = document.getElementById('statsModalBody');
  modal.classList.remove('hidden');
  
  const role = localStorage.getItem("userRole");
  
  if (role !== "owner") {
    body.innerHTML = `
      <div class="access-denied">
        <h2>${translate('stats_modal_denied_title')}</h2>
        <p>${translate('stats_modal_denied_message')}</p>
        <button id="closeDeniedStatsBtn">${translate('stats_modal_denied_ok')}</button>
      </div>
    `;
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
    </div>
  `;

  try {
    const stats = await getOrderStatistics();
    const statsGrid = body.querySelector('.stats-grid');
    
    statsGrid.innerHTML = `
      <div class="stat-card">
        <h3>${translate('stats_total_orders')}</h3><p>${stats.total_orders}</p>
      </div>
      <div class="stat-card">
        <h3>${translate('stats_avg_profit')}</h3><p class="${stats.average_profit >= 0 ? 'positive' : 'negative'}">${stats.average_profit.toFixed(2)} DA</p>
      </div>
      <div class="stat-card">
        <h3>${translate('stats_largest_order')}</h3><p class="highlight">${stats.largest_order_total ? `${stats.largest_order_total.toFixed(2)} DA` : 'N/A'}</p>
      </div>
       <!-- THIS IS THE NEW CARD YOU ARE ADDING -->
      <div class="stat-card">
        <h3>${translate('stats_largest_order_profit')}</h3><p class="highlight positive">${stats.largest_order_profit ? `${stats.largest_order_profit.toFixed(2)} DA` : 'N/A'}</p>
      </div>
      <div class="stat-card">
        <h3>${translate('stats_borrowed_orders')}</h3><p>${stats.with_borrower}</p>
      </div>
    `;
    
  } catch (error) {
    console.error("Failed to show statistics:", error);
    body.querySelector('.stats-grid').innerHTML = `
      <div class="stat-card">
        <h3>${translate('stats_error_title')}</h3><p>${translate('stats_error_message')}</p>
      </div>
    `;
  }

  document.getElementById('closeStatsModal').onclick = () => {
    modal.classList.add('hidden');
  };
}

function renderCalculator() {
  const calculator = document.getElementById('qtyCalculator');
  const header = document.getElementById('calcHeader');
  const display = document.getElementById('calcQtyDisplay');

  if (calculatorTargetProductId && selectedProductsMap.has(calculatorTargetProductId)) {
    const product = selectedProductsMap.get(calculatorTargetProductId);
    header.textContent = product.name;
    display.textContent = product.quantity;
    calculator.classList.remove('hidden');
  } else {
    header.textContent = translate('calc_header_no_product');
    display.textContent = '0';
    calculator.classList.add('hidden');
  }
}

function updateCalculatorQuantity(change) {
  if (!calculatorTargetProductId || !selectedProductsMap.has(calculatorTargetProductId)) {
    return;
  }
  const product = selectedProductsMap.get(calculatorTargetProductId);
  const newQuantity = product.quantity + change;

  if (newQuantity <= 0) {
    selectedProductsMap.delete(calculatorTargetProductId);
    calculatorTargetProductId = null;
  } else {
    product.quantity = newQuantity;
  }
  renderSelectedProducts();
  renderCalculator();
}