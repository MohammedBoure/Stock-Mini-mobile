import { translate } from '../../js/language.js';
import { playSound } from '../../js/main.js';
import { addOrder } from '../../js/orders.js';
import {
  getProducts,
  searchProducts,
  countProducts,
  getProductById,
} from '../../js/products.js';
import { showBorrowerLinkModal } from './borrower_modal.js';

// --- Module-level State for the Add Order Interface ---
const selectedProductsMap = new Map();
let selectedBorrowerId = null;
let productPickerPage = 0;
const productPickerLimit = 30;
let isScanModeActive = false;
let barcodeBuffer = '';
let barcodeTimer = null;
const SCAN_TIMEOUT_MS = 500;
let calculatorTargetProductId = null;
let calculatorInputBuffer = '';
let focusedPickerItemId = null;
let focusedCartItemId = null;

// --- Callbacks passed from the main module ---
let onOrderSubmittedCallback = () => {};
let showAlertCallback = (message, isSuccess = true) => alert(message);

/**
 * Shows the "Add Order" interface directly in the page.
 * @param {object} callbacks - Contains callbacks for when actions are completed.
 * @param {function} callbacks.onOrderSubmitted - Function to call after an order is successfully submitted.
 * @param {function} callbacks.showAlert - Function to call to show an alert.
 */
export function showAddOrderInterface(callbacks = {}) {
  onOrderSubmittedCallback = callbacks.onOrderSubmitted || (() => {});
  showAlertCallback = callbacks.showAlert || ((message, isSuccess = true) => alert(message));

  const posContent = document.getElementById('posContent');
  if (!posContent) return;

  // --- Render Interface HTML ---
  posContent.innerHTML = `
    <div class="order-interface-header">
      <h2 data-i18n-key="modal_title_new_order">New Order</h2>
      <button id="clearInterfaceBtn" class="close" aria-label="Clear interface">&times;</button>
    </div>
    <div class="order-modal-header">
      <div class="search-container">
        <input type="text" id="productSearchInput" placeholder="${translate('modal_placeholder_search_products')}" />
      </div>
      <div class="action-buttons">
        <button id="scanModeBtn" class="scan-mode-btn">${translate('modal_scan_mode_btn')}</button>
        <button id="calculatorToggleBtn" class="calculator-toggle-btn">🔢</button>
        <button id="linkBorrowerBtn" class="link-borrower-btn">${translate('btn_link_borrower')}</button>
        <button id="submitOrderBtn" class="submit-button">${translate('modal_submit_order_btn')}</button>
      </div>
      <div class="borrower-info">
        <span id="selectedBorrowerName" class="selected-borrower-name">${translate('no_borrower_selected')}</span>
      </div>
    </div>
    <div id="scanFeedback" class="scanner-feedback-container hidden"></div>
    <div class="order-modal-content">
      <div class="selected-products-section">
        <h3>${translate('modal_section_title_selected')}</h3>
        <div id="orderTotal"></div>
        <div id="selectedProductsContainer">${translate('cart_empty_message')}</div>
      </div>
      <div class="product-picker-section">
        <h3>${translate('modal_section_title_add')}</h3>
        <div id="productListInPos"></div>
      </div>
    </div>
    <div id="qtyCalculator" class="qty-calculator hidden">
      <div class="calc-display-area">
        <div id="calcHeader">${translate('calc_header_no_product')}</div>
        <div id="calcQtyDisplay">0</div>
      </div>
      <div id="calcKeypad" class="calc-keypad">
        <button class="calc-btn" data-key="1">1</button><button class="calc-btn" data-key="2">2</button><button class="calc-btn" data-key="3">3</button>
        <button class="calc-btn" data-key="4">4</button><button class="calc-btn" data-key="5">5</button><button class="calc-btn" data-key="6">6</button>
        <button class="calc-btn" data-key="7">7</button><button class="calc-btn" data-key="8">8</button><button class="calc-btn" data-key="9">9</button>
        <button class="calc-btn confirm" data-key="set">Set</button><button class="calc-btn" data-key="0">0</button><button class="calc-btn function" data-key="clear">C</button>
      </div>
    </div>
  `;

  // --- Attach Event Listeners ---
  document.getElementById('clearInterfaceBtn').addEventListener('click', clearPosInterface);
  document.getElementById('productSearchInput').addEventListener('input', handleProductSearch);
  document.getElementById('submitOrderBtn').addEventListener('click', handleSubmitOrder);
  document.getElementById('scanModeBtn').addEventListener('click', toggleScanMode);
  document.getElementById('calculatorToggleBtn').addEventListener('click', toggleCalculator);
  document.getElementById('linkBorrowerBtn').addEventListener('click', handleLinkBorrower);
  document.getElementById('calcKeypad').addEventListener('click', (e) => {
    if (e.target.matches('.calc-btn')) handleCalculatorKey(e.target.dataset.key);
  });

  document.addEventListener('keydown', handlePosKeydown);
  document.getElementById('productSearchInput').focus();

  // --- Initial Render ---
  renderSelectedProducts();
  renderProductPicker();
}

function clearPosInterface() {
  const posContent = document.getElementById('posContent');
  posContent.innerHTML = '';
  selectedProductsMap.clear();
  selectedBorrowerId = null;
  isScanModeActive = false;
  barcodeBuffer = '';
  clearTimeout(barcodeTimer);
  document.removeEventListener('keydown', handlePosKeydown);
  window.location.href = './orders.html';
}

async function handleSubmitOrder() {
  if (selectedProductsMap.size === 0) {
    showAlertCallback(translate('js_alert_add_product_to_order'), false);
    return;
  }
  const productsList = Array.from(selectedProductsMap.entries()).map(([product_id, data]) => ({
    product_id: Number(product_id),
    quantity: data.quantity
  }));
  try {
    const orderId = await addOrder(productsList, selectedBorrowerId);
    showAlertCallback(translate('js_alert_order_submit_success'));

    // Reset state and UI
    selectedProductsMap.clear();
    selectedBorrowerId = null;
    productPickerPage = 0;
    document.getElementById('productSearchInput').value = '';
    document.getElementById('selectedBorrowerName').textContent = translate('no_borrower_selected');
    renderSelectedProducts();
    await renderProductPicker();

    // Navigate back to orders page
    window.location.href = './orders.html';

    // Notify the main module
    await onOrderSubmittedCallback();
  } catch (error) {
    console.error("❌ Failed to submit order:", error);
    showAlertCallback(translate('js_alert_order_submit_error').replace('{error}', error.message), false);
  }
}

function handleLinkBorrower() {
  showBorrowerLinkModal(null, {
    onLinkSuccess: (borrowerId, borrowerName) => {
      selectedBorrowerId = borrowerId;
      document.getElementById('selectedBorrowerName').textContent = borrowerName || translate('no_borrower_selected');
      showAlertCallback(translate('js_alert_borrower_linked').replace('{name}', borrowerName), true);
    },
    showAlert: showAlertCallback
  });
}

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
        <span class="item-subtotal">${subtotal.toFixed(2)} DA</span>
        <button class="remove-item-btn" data-id="${id}">❌</button>
      </div>
    `;
    container.appendChild(div);
  });

  totalContainer.innerHTML = `<strong>${translate('cart_total_label')} ${grandTotal.toFixed(2)} DA</strong>`;

  // Attach event listeners
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

async function renderProductPicker(search = '') {
  const container = document.getElementById('productListInPos');
  if (!container) return;
  container.innerHTML = `<p>${translate('picker_loading')}</p>`;
  try {
    const offset = productPickerPage * productPickerLimit;
    const { products, total } = search
      ? { products: await searchProducts(search, { limit: productPickerLimit, offset }), total: await countProducts(search) }
      : { products: await getProducts({ limit: productPickerLimit, offset }), total: await countProducts() };

    if (products.length === 0) {
      container.innerHTML = `<p>${translate('picker_no_products')}</p>`;
      focusedPickerItemId = null;
      return;
    }

    container.innerHTML = products.map(p => `
      <div class="picker-item ${p.id === focusedPickerItemId ? 'focused' : ''}" tabindex="0" data-id="${p.id}">
        <span>${p.name} (${p.price_sell.toFixed(2)} DA)</span>
        <button class="add-product-btn" data-id="${p.id}">➕ ${translate('btn_add_product')}</button>
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
  const container = document.getElementById('productListInPos');
  const totalPages = Math.ceil(totalCount / productPickerLimit);

  let pagination = document.getElementById('picker-pagination');
  if (pagination) pagination.remove();

  if (totalPages <= 1) return;

  pagination = document.createElement('div');
  pagination.id = 'picker-pagination';
  pagination.className = 'pagination-controls';

  pagination.innerHTML = `
    <button id="pickerPrevBtn" ${productPickerPage === 0 ? 'disabled' : ''}>${translate('pagination_prev')}</button>
    <span class="page-info">${translate('pagination_page_info').replace('{currentPage}', productPickerPage + 1).replace('{totalPages}', totalPages)}</span>
    <button id="pickerNextBtn" ${productPickerPage >= totalPages - 1 ? 'disabled' : ''}>${translate('pagination_next')}</button>
  `;

  pagination.querySelector('#pickerPrevBtn').onclick = () => { productPickerPage--; renderProductPicker(search); };
  pagination.querySelector('#pickerNextBtn').onclick = () => { productPickerPage++; renderProductPicker(search); };

  container.appendChild(pagination);
}

async function addProductToSelection(productId, quantity = 1, increment = false) {
  try {
    const product = await getProductById(productId);
    if (!product) {
      showAlertCallback(translate('product_not_found_alert_short').replace('{id}', productId), false);
      return;
    }

    if (selectedProductsMap.has(productId)) {
      const existingProduct = selectedProductsMap.get(productId);
      existingProduct.quantity = increment ? existingProduct.quantity + quantity : quantity;
    } else {
      selectedProductsMap.set(productId, { ...product, quantity });
    }

    calculatorTargetProductId = productId;
    calculatorInputBuffer = '';
    renderSelectedProducts();
    updateCalculatorDisplay();
  } catch (error) {
    console.error("Error adding product to selection:", error);
    showAlertCallback(translate('error_add_product_to_selection'), false);
  }
}

async function handleProductSearch(e) {
  const searchInput = e.target;
  const searchTerm = searchInput.value;
  const cursorPosition = searchInput.selectionStart;

  productPickerPage = 0;
  await renderProductPicker(searchTerm.trim());

  searchInput.focus();
  searchInput.setSelectionRange(cursorPosition, cursorPosition);
}

function handlePosKeydown(e) {
  if (isScanModeActive) {
    e.preventDefault();
    if (e.key === 'Enter') {
      processBarcodeBuffer();
    } else if (e.key === 'Escape') {
      toggleScanMode();
    } else if (/^\d$/.test(e.key)) {
      barcodeBuffer += e.key;
      document.getElementById('scanFeedback').textContent = translate('scan_mode_scanning').replace('{buffer}', barcodeBuffer);
      clearTimeout(barcodeTimer);
      barcodeTimer = setTimeout(processBarcodeBuffer, SCAN_TIMEOUT_MS);
    }
    return;
  }

  switch (e.key) {
    case 'Enter':
      e.preventDefault();
      handleSubmitOrder();
      break;
    case 'Escape':
      e.preventDefault();
      clearPosInterface();
      break;
    case 'ArrowUp':
    case 'ArrowDown':
      const activeElement = document.activeElement;
      const isInPicker = activeElement.closest('#productListInPos');
      const isInCart = activeElement.closest('#selectedProductsContainer');
      if (!isInPicker && !isInCart) return;

      e.preventDefault();
      const items = isInPicker
        ? [...document.querySelectorAll('#productListInPos .picker-item')]
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

function toggleScanMode() {
  isScanModeActive = !isScanModeActive;
  const feedback = document.getElementById('scanFeedback');
  const scanBtn = document.getElementById('scanModeBtn');
  const searchInput = document.getElementById('productSearchInput');
  barcodeBuffer = '';

  if (isScanModeActive) {
    feedback.textContent = translate('scan_mode_active_in_modal');
    feedback.classList.remove('hidden');
    scanBtn.textContent = translate('btn_cancel_scan');
    scanBtn.classList.add('active');
    searchInput.disabled = true;
    searchInput.classList.add('scan-active');
  } else {
    feedback.classList.add('hidden');
    scanBtn.textContent = translate('modal_scan_mode_btn');
    scanBtn.classList.remove('active');
    searchInput.disabled = false;
    searchInput.classList.remove('scan-active');
    searchInput.focus();
  }
}

async function processBarcodeBuffer() {
  if (barcodeBuffer.length === 0) return;
  playSound('./assets/store-scanner-beep-90395.mp3');
  const scannedId = Number(barcodeBuffer);
  const feedback = document.getElementById('scanFeedback');
  barcodeBuffer = '';
  feedback.textContent = translate('scan_mode_processing').replace('{id}', scannedId);
  await addProductToSelection(scannedId, 1, true);
  setTimeout(() => {
    if (isScanModeActive) {
      feedback.textContent = translate('scan_mode_active_in_modal');
    }
  }, 1000);
}

function toggleCalculator() {
  const calculator = document.getElementById('qtyCalculator');
  calculator.classList.toggle('hidden');
  if (!calculator.classList.contains('hidden')) {
    updateCalculatorDisplay();
  }
}

function updateCalculatorDisplay() {
  const header = document.getElementById('calcHeader');
  const display = document.getElementById('calcQtyDisplay');
  if (!header || !display) return;

  if (calculatorTargetProductId && selectedProductsMap.has(calculatorTargetProductId)) {
    const product = selectedProductsMap.get(calculatorTargetProductId);
    header.textContent = product.name;
    display.textContent = calculatorInputBuffer || product.quantity;
  } else {
    header.textContent = translate('calc_header_no_product');
    display.textContent = '0';
  }
}

function handleCalculatorKey(key) {
  if (!calculatorTargetProductId) return;

  if (key >= '0' && key <= '9') {
    calculatorInputBuffer += key;
  } else if (key === 'clear') {
    calculatorInputBuffer = '';
  } else if (key === 'set') {
    setCalculatorQuantity();
    return;
  }
  updateCalculatorDisplay();
}

function setCalculatorQuantity() {
  if (!calculatorTargetProductId) return;

  const newQuantity = parseInt(calculatorInputBuffer, 10);
  if (isNaN(newQuantity)) {
    calculatorInputBuffer = '';
    updateCalculatorDisplay();
    return;
  }

  if (newQuantity <= 0) {
    selectedProductsMap.delete(calculatorTargetProductId);
    calculatorTargetProductId = null;
    document.getElementById('qtyCalculator').classList.add('hidden');
  } else {
    const product = selectedProductsMap.get(calculatorTargetProductId);
    product.quantity = newQuantity;
  }

  calculatorInputBuffer = '';
  renderSelectedProducts();
  updateCalculatorDisplay();
}