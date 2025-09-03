import { translate } from '../../js/language.js';
import { showAddOrderInterface } from './order_modal.js';
import { showBorrowerLinkModal } from './borrower_modal.js';

// --- Module-level State ---
let isFirstLoad = true;

/**
 * Main entry point for the Point of Sale UI.
 */
export async function setupPosUI() {
  const posContent = document.getElementById('posContent');
  if (!posContent) return;

  setupGlobalEventListeners();
  
  // Define the reset callback as a named function to avoid strict mode issues
  const resetPosInterface = async () => {
    await showAddOrderInterface({
      onOrderSubmitted: resetPosInterface, // Reference the named function
      showAlert: showAutoDismissAlert
    });
  };

  // Pass callbacks to reset the interface and show alerts
  await showAddOrderInterface({ 
    onOrderSubmitted: resetPosInterface, 
    showAlert: showAutoDismissAlert 
  });
}

/**
 * Sets up listeners for static elements on the page.
 */
function setupGlobalEventListeners() {
  // No addOrderBtn anymore, interface loads directly
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
    padding: 15px 25px; background-color: ${isSuccess ? '#4CAF50' : '#f44336'};
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