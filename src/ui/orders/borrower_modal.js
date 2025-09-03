// ui/orders/borrower_modal.js
import { translate } from '../../js/language.js';
import {
  getBorrowers,
  addBorrower,
  linkOrderToBorrower,
  countBorrowers,
} from '../../js/borrowers.js';

// --- Module-level State ---
let borrowerPickerPage = 0;
const borrowerPickerLimit = 9;
let onLinkSuccessCallback = () => {};
let showAlertCallback = () => {};

/**
 * Shows the modal to link an order to a borrower.
 * @param {number} orderId The ID of the order to be linked.
 * @param {object} callbacks - Callbacks for success actions.
 * @param {function} callbacks.onLinkSuccess - Function to call after successful linking.
 * @param {function} callbacks.showAlert - Function to show an alert.
 */
export async function showBorrowerLinkModal(orderId, callbacks) {
    onLinkSuccessCallback = callbacks.onLinkSuccess || (() => {});
    showAlertCallback = callbacks.showAlert || alert;

    const modal = document.getElementById('borrowerModal');
    modal.classList.remove('hidden');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideBorrowerModal();
    });

    const body = document.getElementById('borrowerModalBody');
    modal.querySelector('h2').textContent = translate('borrower_modal_title').replace('{id}', orderId);
    
    body.innerHTML = `
        <input type="text" id="borrowerSearchInput" placeholder="${translate('placeholder_search_borrowers')}" style="width: 95%; padding: 8px; margin-bottom: 10px;">
        <div id="borrower-list-container"></div>
        <hr>
        <h4>${translate('borrower_modal_add_new_title')}</h4>
        <div class="add-borrower-form">
            <input type="text" id="newBorrowerNameInput" placeholder="${translate('placeholder_new_borrower_name')}">
            <button id="addNewBorrowerAndLinkBtn">${translate('btn_add_and_link')}</button>
        </div>
    `;

    document.getElementById('closeBorrowerModal').addEventListener('click', hideBorrowerModal);
    document.getElementById('borrowerSearchInput').addEventListener('input', (e) => {
        borrowerPickerPage = 0; 
        renderBorrowerList(orderId, e.target.value);
    });
    document.getElementById('addNewBorrowerAndLinkBtn').onclick = () => handleAddNewBorrowerAndLink(orderId);
    
    borrowerPickerPage = 0;
    await renderBorrowerList(orderId, '');
}

function hideBorrowerModal() {
    const modal = document.getElementById('borrowerModal');
    modal.classList.add('hidden');
    document.getElementById('borrowerModalBody').innerHTML = '';
}

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
            gridHtml += `<div style="grid-column: 1/-1; text-align: center;">${translate('no_borrowers_found')}</div>`;
        } else {
            borrowers.forEach(b => {
              const initial = b.name.charAt(0).toUpperCase();
              gridHtml += `
                <div class="borrower-card" data-borrower-id="${b.id}">
                  <div class="borrower-initial">${initial}</div>
                  <div class="borrower-name">${b.name}</div>
                  <div class="borrower-meta">Since ${new Date(b.date).toLocaleDateString()}</div>
                </div>`;
            });
        }
        gridHtml += '</div>';

        // Pagination controls
        const totalPages = Math.ceil(totalBorrowers / borrowerPickerLimit);
        if (totalPages > 1) {
            gridHtml += `
                <div class="pagination-controls">
                    <button id="borrowerPrevBtn" ${borrowerPickerPage === 0 ? 'disabled' : ''}>${translate('pagination_prev')}</button>
                    <span>${translate('pagination_page_info').replace('{currentPage}', borrowerPickerPage + 1).replace('{totalPages}', totalPages)}</span>
                    <button id="borrowerNextBtn" ${borrowerPickerPage + 1 >= totalPages ? 'disabled' : ''}>${translate('pagination_next')}</button>
                </div>`;
        }
        listContainer.innerHTML = gridHtml;
        
        // Attach event listeners
        listContainer.querySelectorAll('.borrower-card').forEach(card => {
            card.addEventListener('click', () => handleLinkToBorrower(orderId, Number(card.dataset.borrowerId)));
        });
        listContainer.querySelector('#borrowerPrevBtn')?.addEventListener('click', () => { borrowerPickerPage--; renderBorrowerList(orderId, searchTerm); });
        listContainer.querySelector('#borrowerNextBtn')?.addEventListener('click', () => { borrowerPickerPage++; renderBorrowerList(orderId, searchTerm); });

    } catch (error) {
        console.error("Failed to render borrower list:", error);
        listContainer.innerHTML = `<div class="borrower-grid">${translate('error_loading_borrowers')}</div>`;
    }
}

async function handleLinkToBorrower(orderId, borrowerId) {
    try {
        const result = await linkOrderToBorrower(orderId, borrowerId);
        if (result && result.success === false) {
             alert(result.error || translate('js_alert_order_already_linked'));
             return;
        }
        showAlertCallback(translate('js_alert_link_successful').replace('{id}', orderId));
        hideBorrowerModal();
        await onLinkSuccessCallback(); // Refresh list
    } catch (error) {
        console.error("Failed to link order to borrower:", error);
        alert(translate('js_alert_link_error'));
    }
}

async function handleAddNewBorrowerAndLink(orderId) {
    const nameInput = document.getElementById('newBorrowerNameInput');
    const name = nameInput.value.trim();
    if (!name) {
        alert(translate('js_alert_enter_borrower_name'));
        return;
    }
    try {
        const newBorrowerId = await addBorrower({ name, date: new Date().toISOString(), amount: 0 });
        await handleLinkToBorrower(orderId, newBorrowerId);
    } catch (error) {
        console.error("Failed to create and link new borrower:", error);
        alert(translate('js_alert_create_link_error'));
    }
}