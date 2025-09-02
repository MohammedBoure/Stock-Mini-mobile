// =================================================================
// === MAIN APPLICATION BOOTSTRAPPER (FINAL CORRECTED VERSION) =====
// =================================================================
// This single file orchestrates the entire application startup sequence.

// --- 1. CORE MODULE IMPORTS ---
import { initDatabase } from './db.js';
import { loadTranslations, applySavedLanguage, setupLanguageSwitcher } from './language.js';

// --- 2. PAGE-SPECIFIC UI MODULE IMPORTS ---
import { setupOrdersUI } from '../ui/orders_ui.js';
import { setupProductUI } from '../ui/products_ui.js';
import { setupBorrowersUI } from '../ui/borrowers_ui.js';

// --- 3. PWA LOGIC ---
let deferredPrompt; // This variable will hold the install event

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser install prompt
    e.preventDefault();
    // Stash the event so it can be triggered by our custom button
    deferredPrompt = e;
    
    // Find the install card on the current page. This will only work on import_export.html.
    const installCard = document.getElementById('pwa-install-card');
    if (installCard) {
        // Make the entire card visible.
        installCard.style.display = 'block';

        // Find the button INSIDE the card and attach its click handler immediately.
        // This avoids any timing issues with other scripts.
        const installBtn = document.getElementById('install-pwa-btn');
        if (installBtn) {
            installBtn.onclick = async () => {
                if (deferredPrompt) {
                    // Show the browser's installation prompt
                    deferredPrompt.prompt();
                    // Wait for the user's choice
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    
                    // The prompt can only be used once, so we clear it.
                    deferredPrompt = null;

                    // Hide the card permanently after the prompt is shown
                    installCard.style.display = 'none';
                }
            };
        }
    }
});


// --- 4. UTILITY & AUTHENTICATION LOGIC ---

/**
 * Creates and plays an audio file from a given path.
 * @param {string} soundPath - The path to the sound file.
 */
export function playSound(soundPath) {
    const audio = new Audio(soundPath);
    audio.play().catch(error => {
        console.warn("Could not play sound:", error);
    });
}

const ROLE_KEY = "userRole";
const CREDS_KEY = "userCredentials";

function getCredentials() {
    const creds = localStorage.getItem(CREDS_KEY);
    return creds ? JSON.parse(creds) : { owner: "123" };
}

function saveCredentials(creds) {
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

function initializeAuth() {
    let role = localStorage.getItem(ROLE_KEY);
    if (!role) {
        const credentials = getCredentials();
        const password = prompt("Owner Login Required for Full Access\n\n(Enter owner password(password=123), or leave blank for worker access)");
        
        if (password === credentials.owner) {
            role = "owner";
        } else {
            role = "worker";
        }
        localStorage.setItem(ROLE_KEY, role);
    }
    
    document.body.classList.toggle('worker-mode', role === 'worker');

    if (role === 'worker') {
        const currentPath = window.location.pathname.split('/').pop();
        const forbiddenPages = ['products.html', 'borrowers.html', 'statistics.html', 'import_export.html'];
        
        if (forbiddenPages.includes(currentPath)) {
            alert("Access Denied. Redirecting to the Orders page.");
            window.location.href = './orders.html';
        }
    }
}

function setupUserManagement() {
    const manageUsersBtn = document.getElementById("manageUsersBtn");
    if (!manageUsersBtn) return;

    manageUsersBtn.addEventListener("click", () => {
        let currentRole = localStorage.getItem(ROLE_KEY);
        const credentials = getCredentials();

        if (currentRole === 'owner') {
            const action = prompt("Owner Menu:\n1: Log Out\n2: Change Owner Password", "1");
            if (action === '1') {
                localStorage.removeItem(ROLE_KEY);
                alert("Logged out.");
                location.reload();
            } else if (action === '2') {
                const newPassword = prompt("New password for 'owner':");
                if (newPassword && newPassword.length > 2) {
                    credentials.owner = newPassword;
                    saveCredentials(credentials);
                    alert("Password for 'owner' updated!");
                } else {
                    alert("Password too short.");
                }
            }
        } else {
            const ownerPassword = prompt("Owner password required to gain access:");
            if (ownerPassword === credentials.owner) {
                localStorage.setItem(ROLE_KEY, 'owner');
                alert("Verification successful!");
                location.reload();
            } else {
                alert("Incorrect password.");
            }
        }
    });
}

// --- 5. PAGE ROUTER & INITIALIZER ---
const pageInitializers = {
    'orders.html': setupOrdersUI,
    'products.html': setupProductUI,
    'borrowers.html': setupBorrowersUI,
};


// --- 6. MAIN EXECUTION FUNCTION ---
async function main() {
    try {
        initializeAuth();
        
        document.addEventListener('DOMContentLoaded', async () => {
            
            // --- PWA Service Worker Registration ---
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(() => console.log('Service Worker Registered Successfully.'))
                    .catch(error => console.log('Service Worker registration failed:', error));
            }
            
            // NOTE: The PWA Install Button Handler has been moved to the 'beforeinstallprompt' listener
            // to avoid timing issues. No handler is needed here.

            // --- Core functionalities ---
            setupUserManagement();
            await loadTranslations();
            applySavedLanguage();
            setupLanguageSwitcher();

            // --- Initialize the database ---
            await initDatabase();

            // --- Run page-specific UI logic ---
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const initializePage = pageInitializers[currentPage];
            
            if (initializePage) {
                await initializePage();
            }

            console.log(`✅ ${currentPage} initialized successfully.`);
        });

    } catch (error) {
        console.error("❌ A critical error occurred during application startup:", error);
        document.body.innerHTML = `
            <div style="text-align: center; padding: 40px; font-family: sans-serif;">
                <h1>Application Error</h1>
                <p>A critical error occurred. Please try clearing your browser cache or contact support.</p>
                <p><em>Error: ${error.message}</em></p>
            </div>
        `;
    } finally {
        // Reveal the page after all resources are loaded
        window.addEventListener('load', () => {
            document.body.classList.remove('loading-translations');
        });
    }
}

// --- 7. START THE APPLICATION ---
main();