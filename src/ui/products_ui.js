// ui/products_ui.js

// 1. IMPORT THE TRANSLATE FUNCTION
import { translate } from '../js/language.js'; 
import { playSound } from '../js/main.js'; // <-- ADD THIS LINE

import {
  getProducts,
  countProducts,
  addProduct,
  addProductWithId,
  updateProduct,
  deleteProduct,
  getProductById,
  searchProducts,
  getProductStatistics,
} from '../js/products.js';

// --- Module-level State ---
let showingLowStock = false;
let currentPage = 0;
const limit = 12;
let currentSort = { type: 'created_at', ascending: false };
let isScanModeActive = false;
let barcodeBuffer = '';
let barcodeTimer = null;
const SCAN_TIMEOUT_MS = 600;

export async function setupProductUI() {
  await loadProductUI();
  setupEventListeners();
  updateScanButtonState();
  updateStockButtonState();
}

function setupEventListeners() {
  document.getElementById('scanModeBtn')?.addEventListener('click', toggleScanMode);
  document.getElementById('addProductBtn')?.addEventListener('click', () => showModal(translate('modal_title_add'), handleAddProduct, {}));
  document.getElementById('closeModal')?.addEventListener('click', hideModal);
  document.getElementById('searchInput')?.addEventListener('input', handleSearchInput);
  
  document.getElementById('sortByPriceBtn')?.addEventListener('click', () => sortAndRenderProducts('price_sell'));
  document.getElementById('sortByNameBtn')?.addEventListener('click', () => sortAndRenderProducts('name'));
  document.getElementById('sortByStockBtn')?.addEventListener('click', handleStockSort);
  
  setupProductStatsButton();
  document.addEventListener('keydown', handleGlobalKeyPress);
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
// --- Barcode Scanning Logic ---

function toggleScanMode() {
  isScanModeActive = !isScanModeActive;
  const feedback = document.getElementById('scanner-feedback');
  const searchInput = document.getElementById('searchInput');
  barcodeBuffer = '';

  updateScanButtonState();

  if (isScanModeActive) {
    feedback.textContent = translate('scan_mode_active');
    feedback.classList.remove('hidden');
    if (searchInput) searchInput.disabled = true;
  } else {
    feedback.classList.add('hidden');
    if (searchInput) searchInput.disabled = false;
  }
}

function handleGlobalKeyPress(e) {
  // --- MODIFICATION START ---
  // If the modal is visible, don't process any key presses for scanning.
  const isModalVisible = !document.getElementById('productModal')?.classList.contains('hidden');
  if (!isScanModeActive || isModalVisible) return;
  // --- MODIFICATION END ---

  if (e.key === 'Escape') { toggleScanMode(); return; }
  if (e.key === 'Enter') { e.preventDefault(); processBarcodeBuffer(); return; }
  // This now correctly tests for a single digit.
  if (!/^\d$/.test(e.key)) { return; } 
  
  e.preventDefault();
  barcodeBuffer += e.key;
  document.getElementById('scanner-feedback').textContent = translate('scan_mode_scanning').replace('{buffer}', barcodeBuffer);
  clearTimeout(barcodeTimer);
  barcodeTimer = setTimeout(processBarcodeBuffer, SCAN_TIMEOUT_MS);
}


function processBarcodeBuffer() {
  if (barcodeBuffer.length === 0) return;
   playSound('./assets/store-scanner-beep-90395.mp3'); // <-- ADD THIS LINE

  const scannedId = Number(barcodeBuffer);
  const bufferCopy = barcodeBuffer;
  barcodeBuffer = '';
  
  console.log(`📠 Processing scanned barcode: ${bufferCopy}`);
  handleBarcodeScan(scannedId);
  
 
}



async function handleBarcodeScan(scannedId) {
  if (isNaN(scannedId) || scannedId === 0) return;

  const product = await getProductById(scannedId);

  if (product) {
    // --- MODIFICATION START ---

    // 1. First, still try to highlight the product in the table if it's visible.
    const productElement = document.querySelector(`tr[data-product-id='${scannedId}']`);
    if (productElement) {
      productElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      productElement.classList.add('highlight');
      setTimeout(() => productElement.classList.remove('highlight'), 2500);
    }

    // 2. Build a detailed HTML view for the product.
    // This re-uses the translation keys from your modal for consistency.
    const formatCurrency = (num) => `${(num || 0).toFixed(2)} DA`;
    const notAvailable = translate('not_available') ?? 'N/A'; // Add 'not_available' to your language file

    const html = `
      <h2>${translate('product_found_alert_title')}</h2>
      <ul class="product-details-list">
        <li><strong>${translate('modal_label_barcode')}:</strong> ${product.id}</li>
        <li><strong>${translate('modal_label_name')}:</strong> ${product.name}</li>
        <li><strong>${translate('modal_label_buy_price')}:</strong> ${formatCurrency(product.price_buy)}</li>
        <li><strong>${translate('modal_label_sell_price')}:</strong> ${formatCurrency(product.price_sell)}</li>
        <li><strong>${translate('modal_label_stock')}:</strong> ${product.stock ?? notAvailable}</li>
        <li><strong>${translate('modal_label_stock_danger')}:</strong> ${product.stock_danger ?? notAvailable}</li>
      </ul>
    `;
    
    // 3. Show the detailed view in an overlay instead of an alert.
    createOverlay(html);
    
    // 4. Only toggle scan mode off if a product was successfully found.
    if (isScanModeActive) {
        toggleScanMode();
    }
    // --- MODIFICATION END ---

  } else {
    // This "product not found" logic remains the same.
    if (confirm(translate('product_not_found_confirm').replace('{id}', scannedId))) {
        showModal(translate('modal_title_add_from_scan'), handleAddProductWithId, { id: scannedId });
    }
  }
}
// --- Data Loading & Rendering ---

async function loadProductUI() {
  const productContainer = document.getElementById('productContainer');
  if (!productContainer) return;

  productContainer.innerHTML = `<p>${translate('loading_products')}</p>`;
  
  const offset = currentPage * limit;
  
  const products = await getProducts({
    limit, offset,
    sortBy: currentSort.type, ascending: currentSort.ascending,
    lowStockOnly: showingLowStock
  });

  renderProductList(products);
  
  const total = await countProducts({ lowStockOnly: showingLowStock });
  renderPagination(total);
}

function renderProductList(products) {
  const productContainer = document.getElementById('productContainer');
  productContainer.innerHTML = '';

  if (products.length === 0) {
    productContainer.innerHTML = `<p>${translate('no_products_match')}</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'product-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>${translate('table_header_product_name')}</th>
        <th class="mobile-hidden">${translate('table_header_buy_price')}</th>
        <th>${translate('table_header_sell_price')}</th>
        <th>${translate('table_header_stock')}</th>
        <th class="mobile-hidden">${translate('table_header_danger')}</th>
        <th>${translate('table_header_actions')}</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  products.forEach(product => {
    const tr = document.createElement('tr');
    tr.dataset.productId = product.id;
    
    if (product.stock !== null && product.stock_danger !== null && product.stock < product.stock_danger) {
      tr.classList.add('low-stock-warning');
    }

    tr.innerHTML = `
      <td data-label="${translate('table_header_product_name')}"><strong>${product.name}</strong></td>
      <td data-label="${translate('table_header_buy_price')}" class="mobile-hidden">${product.price_buy ?? '-'} DA</td>
      <td data-label="${translate('table_header_sell_price')}">${product.price_sell ?? '-'} DA</td>
      <td data-label="${translate('table_header_stock')}">${product.stock ?? '-'}</td>
      <td data-label="${translate('table_header_danger')}" class="mobile-hidden">${product.stock_danger ?? '-'}</td>
      <td data-label="${translate('table_header_actions')}">
        <div class="product-actions">
          <button data-id="${product.id}" class="edit-btn">✏️<span class="button-text">${translate('btn_edit')}</span></button>
          <button data-id="${product.id}" class="delete-btn">🗑️<span class="button-text">${translate('btn_delete')}</span></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  productContainer.appendChild(table);
  setupProductEditDeleteButtons();
}

function setupProductEditDeleteButtons() {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      if (confirm(translate('js_confirm_delete_product').replace('{id}', id))) {
        await deleteProduct(id);
        await loadProductUI();
      }
    };
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const product = await getProductById(id);
      if (product) {
        showModal(translate('modal_title_edit'), handleUpdateProduct, product);
      } else {
        alert(translate('product_not_found_alert'));
      }
    };
  });
}

// --- UI Handlers (Modal, Pagination, Sort, Search) ---

// REPLACE your old showModal function with this one
function showModal(title, onSubmit, prefill = {}) {
    const modal = document.getElementById('productModal');
    document.getElementById('modalTitle').textContent = title;
    const modalBody = document.getElementById('modalBody');

    const barcodeField = prefill.id
      ? `<label>${translate('modal_label_barcode')} <input id="barcode" value="${prefill.id}" readonly /></label><br/>`
      : '';

    modalBody.innerHTML = `
        ${barcodeField}
        <label>${translate('modal_label_name')} <input id="name" value="${prefill.name ?? ''}" required /></label><br/>
        <label>${translate('modal_label_buy_price')} <input id="price_buy" type="number" step="0.01" value="${prefill.price_buy ?? ''}" /></label><br/>
        <label>${translate('modal_label_sell_price')} <input id="price_sell" type="number" step="0.01" value="${prefill.price_sell ?? ''}" /></label><br/>
        <label>${translate('modal_label_stock')} <input id="stock" type="number" value="${prefill.stock ?? ''}" /></label><br/>
        <label>${translate('modal_label_stock_danger')} <input id="stock_danger" type="number" value="${prefill.stock_danger ?? ''}" /></label><br/>
        <button id="submitModal">${translate('modal_btn_submit')}</button>
    `;

    // --- NEW LOGIC STARTS HERE ---

    // A single function to handle all cleanup
    const cleanupAndHide = () => {
        modal.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleEscapeKey);
        hideModal();
    };

    // Handler for clicks on the modal background
    const handleOutsideClick = (e) => {
        if (e.target === modal) {
            cleanupAndHide();
        }
    };

    // Handler for the 'Escape' key
    const handleEscapeKey = (e) => {
        if (e.key === 'Escape') {
            cleanupAndHide();
        }
    };

    modal.classList.remove('hidden');

    // Add the new event listeners
    modal.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
    
    document.getElementById('name')?.focus();

    // Attach cleanup function to the buttons
        document.getElementById('submitModal').onclick = async () => {
        const values = {
            name: document.getElementById('name').value.trim(),
            price_buy: parseFloat(document.getElementById('price_buy').value) || 0,
            price_sell: parseFloat(document.getElementById('price_sell').value) || 0,
            stock: parseInt(document.getElementById('stock').value, 10) || null,
            stock_danger: parseInt(document.getElementById('stock_danger').value, 10) || null
        };

        if (!values.name) {
            alert(translate('js_alert_name_required'));
            return;
        }

        try {
            await onSubmit(prefill, values);

            // --- MODIFICATION START ---
            let successMessage = '';

            // Determine if it was an add or update operation to show the correct message.
            if (onSubmit === handleAddProduct || onSubmit === handleAddProductWithId) {
                // This message will be shown when a new product is added
                successMessage = translate('js_alert_product_added_success').replace('{name}', values.name);
            } else if (onSubmit === handleUpdateProduct) {
                // This message will be shown when a product is updated
                successMessage = translate('js_alert_product_updated_success').replace('{name}', values.name);
            }

            if (successMessage) {
                showAutoDismissAlert(successMessage, true); // true for success style
            }
            // --- MODIFICATION END ---

        } catch (error) {
            console.error('Failed to submit product:', error);
            // Show a generic error message if something goes wrong
            showAutoDismissAlert(translate('js_alert_submit_error'), false); // false for error style
        } finally {
            cleanupAndHide(); // Use the cleanup function
            await loadProductUI();
        }
    };

    document.getElementById('closeModal').onclick = cleanupAndHide;
}


function hideModal() {
    document.getElementById('productModal').classList.add('hidden');

    // --- MODIFICATION ---
    // After the modal closes, correctly set the search input's disabled
    // state based on whether scan mode is still active.
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.disabled = isScanModeActive;
    }
}

// --- Action Handlers ---

async function handleAddProduct(prefill, values) { await addProduct(values.name, values.price_buy, values.price_sell, values.stock, values.stock_danger); }
async function handleAddProductWithId(prefill, values) { await addProductWithId(prefill.id, values.name, values.price_buy, values.price_sell, values.stock, values.stock_danger); }
async function handleUpdateProduct(prefill, values) { await updateProduct(prefill.id, values); }
async function handleSearchInput(e) {
  const keyword = e.target.value.trim();
  currentPage = 0;
  if (keyword === '') {
    await loadProductUI();
  } else {
    const results = searchProducts(keyword, { limit: 100 });
    renderProductList(results);
    const pagination = document.getElementById('pagination-container');
    if (pagination) pagination.innerHTML = '';
  }
}

async function handleStockSort() {
  showingLowStock = !showingLowStock;
  updateStockButtonState();
  currentSort = { type: 'stock', ascending: true };
  currentPage = 0;
  await loadProductUI();
}

async function sortAndRenderProducts(type) {
  if (currentSort.type === type) {
    currentSort.ascending = !currentSort.ascending;
  } else {
    currentSort = { type, ascending: true };
  }
  showingLowStock = false;
  updateStockButtonState();
  currentPage = 0;
  await loadProductUI();
}

function renderPagination(totalCount) {
  let pagination = document.getElementById('pagination-container');
  if (pagination) {
    pagination.innerHTML = '';
  } else {
    pagination = document.createElement('div');
    pagination.id = 'pagination-container';
    document.getElementById('productContainer').insertAdjacentElement('afterend', pagination);
  }
  
  const totalPages = Math.ceil(totalCount / limit);
  if (totalPages <= 1) return;

  if (currentPage > 0) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = translate('pagination_prev');
    prevBtn.onclick = () => { currentPage--; loadProductUI(); };
    pagination.appendChild(prevBtn);
  }

  const pageInfo = document.createElement('span');
  pageInfo.textContent = translate('pagination_page_info').replace('{currentPage}', currentPage + 1).replace('{totalPages}', totalPages);
  pagination.appendChild(pageInfo);

  if (currentPage < totalPages - 1) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = translate('pagination_next');
    nextBtn.onclick = () => { currentPage++; loadProductUI(); };
    pagination.appendChild(nextBtn);
  }
}

function updateScanButtonState() {
  const scanBtn = document.getElementById('scanModeBtn');
  if (scanBtn) {
    if (isScanModeActive) {
      scanBtn.classList.add('active');
      scanBtn.innerHTML = `🔴<span class="button-text">${translate('btn_cancel')}</span>`;
    } else {
      scanBtn.classList.remove('active');
      scanBtn.innerHTML = `📠<span class="button-text">${translate('btn_scan')}</span>`;
    }
  }
}

function updateStockButtonState() {
  const btn = document.getElementById('sortByStockBtn');
  if (btn) {
    if (showingLowStock) {
      btn.classList.add('active');
      btn.innerHTML = `✅<span class="button-text">${translate('btn_low_stock_active')}</span>`;
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `⚠️<span class="button-text">${translate('btn_low_stock_inactive')}</span>`;
    }
  }
}

// --- Statistics ---

// REPLACE your old createOverlay function with this one
function createOverlay(html) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const closeText = translate('stats_overlay_close');
    overlay.innerHTML = `<div class="overlay-content">${html}<button id="closeStatsOverlay">${closeText}</button></div>`;
    document.body.appendChild(overlay);

    // --- NEW LOGIC STARTS HERE ---

    // A single function to handle all cleanup
    const cleanupAndRemove = () => {
        overlay.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleEscapeKey);
        overlay.remove();
    };

    // Handler for clicks on the overlay background
    const handleOutsideClick = (e) => {
        if (e.target === overlay) {
            cleanupAndRemove();
        }
    };

    // Handler for the 'Escape' key
    const handleEscapeKey = (e) => {
        if (e.key === 'Escape') {
            cleanupAndRemove();
        }
    };

    // Add the new event listeners
    overlay.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);

    // Attach cleanup function to the close button
    const closeButton = overlay.querySelector('#closeStatsOverlay');
    closeButton.onclick = cleanupAndRemove;
    closeButton.focus();
}

export async function setupProductStatsButton() {
  const btn = document.getElementById('productStatsBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const stats = await getProductStatistics();
    if (!stats) {
      alert(translate('js_alert_stats_error'));
      return;
    }

    const formatCurrency = (num) => `${(num || 0).toFixed(2)} DA`;
    const unitsSuffix = translate('stats_units_suffix');
    const revenueSuffix = translate('stats_revenue_suffix');

    const html = `
      <h2>${translate('stats_title')}</h2>
      
      <h3>${translate('stats_summary_title')}</h3>
      <ul>
        <li><strong>${translate('stats_total_products')}</strong> ${stats.totalProducts}</li>
        <li><strong>${translate('stats_total_sold')}</strong> ${stats.totalQuantity}</li>
        <li><strong>${translate('stats_stock_value_buy')}</strong> ${formatCurrency(stats.stockValueBuy)}</li>
        <li><strong>${translate('stats_potential_revenue')}</strong> ${formatCurrency(stats.stockValueSell)}</li>
      </ul>

      <h3>${translate('stats_performance_title')}</h3>
      <ul>
        <li><strong>${translate('stats_most_sold')}</strong> ${stats.mostSold[0]} (${stats.mostSold[1]} ${unitsSuffix})</li>
        <li><strong>${translate('stats_least_sold')}</strong> ${stats.leastSold[0]} (${stats.leastSold[1]} ${unitsSuffix})</li>
        <li><strong>${translate('stats_top_revenue')}</strong> ${stats.topRevenue[0]} (${formatCurrency(stats.topRevenue[1])} ${revenueSuffix})</li>
      </ul>
    `;
    createOverlay(html);
  });
}