// === GLOBAL VARIABLES & CONSTANTS
// =================================================================
import { translate } from './language.js'; // Make sure to import the translate function

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let accessToken = null;
let SQL;
let db = null;

// =================================================================
// === STATUS & UI MANAGEMENT
// =================================================================




export async function pruneDatabaseHistory() {
  // This function now correctly uses the module-level 'db' variable
  // that is initialized by the initApp() function in this same file.
  if (!db) {
    console.error("Database not initialized. Cannot prune history.");
    return;
  }

  // List of tables to prune, along with their date column
  const tablesToPrune = [
    { name: 'orders_snapshots_products', dateColumn: null }, // Child table, deleted via parent
    { name: 'orders_snapshots', dateColumn: 'date' },
    { name: 'products_snapshots', dateColumn: 'created_at' },
    { name: 'products_orders', dateColumn: null }, // Legacy, but good to clean
    { name: 'orders', dateColumn: 'created_at' },
    
  ];

  console.log("Starting database pruning operation...");
  db.exec("BEGIN TRANSACTION;");

  try {
    for (const table of tablesToPrune) {
      // For tables without a date column, we delete based on their parent's deletion.
      // For others, we find the oldest half and delete them.
      if (table.dateColumn) {
        const countResult = db.exec(`SELECT COUNT(*) FROM ${table.name}`);
        const totalRows = countResult[0].values[0][0];
        const limit = Math.floor(totalRows / 2);

        if (limit > 0) {
          console.log(`Pruning ${limit} oldest rows from ${table.name}...`);
          // We find the IDs of the oldest half and then delete them.
          // This is a safe way to handle deletions with LIMIT in SQLite.
          db.run(`
            DELETE FROM ${table.name}
            WHERE id IN (
              SELECT id FROM ${table.name}
              ORDER BY ${table.dateColumn} ASC
              LIMIT ${limit}
            )
          `);
        }
      }
    }
    
    // Clean up child tables whose parents might have been deleted
    db.run(`DELETE FROM orders_snapshots_products WHERE order_snapshot_id NOT IN (SELECT id FROM orders_snapshots)`);
    db.run(`DELETE FROM products_orders WHERE order_id NOT IN (SELECT id FROM orders)`);


    db.exec("COMMIT;");
    console.log("✅ Database pruning successful.");
    
    // This now correctly calls the saveToIndexedDB function from this same file.
    await saveToIndexedDB();
    alert(translate('status_prune_success'));

  } catch (error) {
    db.exec("ROLLBACK;");
    console.error("❌ Failed to prune database history:", error);
    throw error; // Re-throw the error to be caught by the UI
  }
}
function showStatus(message, type = 'info') {
  const statusArea = document.getElementById('status-area');
  statusArea.innerHTML = `<div class="status ${type}">${message}</div>`;
  console.log(`[${type.toUpperCase()}] ${message}`);
  if (type !== 'error') {
    setTimeout(() => {
      if (statusArea.firstChild && statusArea.firstChild.textContent === message) {
          statusArea.innerHTML = '';
      }
    }, 5000);
  }
}

function updateUI() {
    updateTableSelector();
    updateDatabaseInfo();
    displaySelectedTable();
}

function updateTableSelector() {
    const selector = document.getElementById('table-selector');
    selector.innerHTML = `<option value="">${translate('viewer_select_table')}</option>`;
    if (!db) return;
    try {
        const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        if (result[0]?.values) {
            result[0].values.flat().forEach(name => selector.add(new Option(name, name)));
        }
    } catch (e) { console.error('Error updating table selector:', e); }
}

function updateDatabaseInfo() {
    const infoEl = document.getElementById('db-info');
    if (!db) { infoEl.textContent = translate('info_no_db'); return; }
    try {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0].values.flat();
        let info = translate('info_db_loaded').replace('{count}', tables.length) + '\n\n';
        tables.forEach(name => {
            try {
                const count = db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0];
                info += `• ${name}: ${translate('info_row_count').replace('{count}', count)}\n`;
            } catch { info += `• ${name}: ${translate('info_error_reading')}\n`; }
        });
        infoEl.textContent = info;
    } catch (e) { infoEl.textContent = translate('info_error_reading_db').replace('{error}', e.message); }
}

function displaySelectedTable() {
    const selector = document.getElementById('table-selector');
    const output = document.getElementById('table-output');
    const tableName = selector.value;
    if (!tableName || !db) { output.textContent = translate('viewer_no_table'); return; }
    try {
        const limit = parseInt(document.getElementById('row-limit').value) || 10;
        const result = db.exec(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT ${limit}`);
        if (result[0]?.values.length > 0) {
            const { columns, values } = result[0];
            const headers = columns.join(' | ');
            const rows = values.map(row => row.join(' | ')).join('\n');
            output.textContent = `${headers}\n${'-'.repeat(headers.length)}\n${rows}`;
        } else {
            output.textContent = translate('viewer_table_empty').replace('{tableName}', tableName);
        }
    } catch (e) { output.textContent = translate('viewer_error_reading_table').replace('{tableName}', tableName).replace('{error}', e.message); }
}

// =================================================================
// === DATABASE INITIALIZATION & SCHEMA
// =================================================================

function initDatabaseSchema() {
    if (!db) { db = new SQL.Database(); }
    db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price_buy REAL NOT NULL, price_sell REAL NOT NULL, stock INTEGER NOT NULL, stock_danger INTEGER NOT NULL, created_at TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS products_snapshots (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, name TEXT NOT NULL, price_buy REAL NOT NULL, price_sell REAL NOT NULL, quantity INTEGER NOT NULL, created_at TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS products_orders (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, snapshot_id INTEGER NOT NULL, quantity INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS borrowers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, amount REAL NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS orders_snapshots (id INTEGER PRIMARY KEY, original_order_id INTEGER NOT NULL, borrower_id INTEGER NOT NULL, date TEXT NOT NULL, total_price REAL NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS orders_snapshots_products (id INTEGER PRIMARY KEY, order_snapshot_id INTEGER NOT NULL, name TEXT NOT NULL, price_sell REAL NOT NULL, quantity INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS import_id_table (id INTEGER PRIMARY KEY DEFAULT 1, drive_id TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS google_drive_client_id (id INTEGER PRIMARY KEY DEFAULT 1, client_id TEXT)`);
}

async function initApp() {
    showStatus(translate('status_initializing'), 'info');
    try {
        SQL = await initSqlJs({ locateFile: file => `../libs/${file}` });
        db = await loadFromIndexedDB(SQL);
        if (!db) {
            initDatabaseSchema();
            showStatus(translate('status_db_initialized_success'), 'success');
        } else {
            showStatus(translate('status_db_loaded_success'), 'success');
        }
        updateUI();
        loadLatestDriveId();
        loadClientIdFromDB();
    } catch (err) {
        console.error(err);
        showStatus(translate('status_db_init_critical_error'), 'error');
    }
}

// =================================================================
// === CONFIGURATION DATA (CLIENT ID & DRIVE ID)
// =================================================================

async function saveLatestDriveId(fileId) {
    if (!db) return;
    try {
        db.run('INSERT INTO import_id_table (id, drive_id) VALUES (1, :drive_id) ON CONFLICT(id) DO UPDATE SET drive_id = :drive_id', { ':drive_id': fileId });
        await saveToIndexedDB();
        console.log(`Saved latest Drive ID to DB: ${fileId}`);
    } catch (error) { console.error("Error saving Drive ID:", error); }
}

function loadLatestDriveId() {
    if (!db) return;
    try {
        const stmt = db.prepare('SELECT drive_id FROM import_id_table WHERE id = 1');
        if (stmt.step()) {
            const driveId = stmt.get()[0];
            if (driveId) {
                document.getElementById('drive-file-id').value = driveId;
                console.log(`Loaded latest Drive ID from DB: ${driveId}`);
            }
        }
        stmt.free();
    } catch (error) { console.warn("Could not load latest Drive ID, table might not exist yet."); }
}

async function saveClientIdToDB() {
    if (!db) return;
    const clientIdInput = document.getElementById('google-client-id');
    const clientId = clientIdInput.value.trim();
    if (!clientId) {
        showStatus(translate('status_client_id_missing'), 'error');
        return;
    }
    try {
        db.run('INSERT INTO google_drive_client_id (id, client_id) VALUES (1, :client_id) ON CONFLICT(id) DO UPDATE SET client_id = :client_id', { ':client_id': clientId });
        await saveToIndexedDB();
        showStatus(translate('status_client_id_saved'), 'success');
        console.log(`Saved Client ID to DB: ${clientId}`);
    } catch (error) {
        console.error("Error saving Client ID:", error);
        showStatus(translate('status_client_id_error').replace('{error}', error.message), 'error');
    }
}

function loadClientIdFromDB() {
    if (!db) return null;
    try {
        const stmt = db.prepare('SELECT client_id FROM google_drive_client_id WHERE id = 1');
        if (stmt.step()) {
            const clientId = stmt.get()[0];
            if (clientId) {
                document.getElementById('google-client-id').value = clientId;
                console.log(`Loaded Client ID from DB: ${clientId}`);
                return clientId;
            }
        }
        stmt.free();
    } catch (error) { console.warn("Could not load Client ID, table might not exist yet."); }
    return null;
}

// =================================================================
// === LOCAL DATABASE PERSISTENCE (IndexedDB)
// =================================================================

async function saveToIndexedDB() {
    if (!db) return;
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open('MyAppDB', 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore('datastore', { keyPath: 'id' });
            request.onsuccess = e => {
                const tx = e.target.result.transaction('datastore', 'readwrite');
                tx.objectStore('datastore').put({ id: 'main', data: db.export(), timestamp: Date.now() });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(new Error(translate('error_indexeddb_save')));
            };
            request.onerror = () => reject(new Error(translate('error_indexeddb_open')));
        } catch (error) { reject(error); }
    });
}

function loadFromIndexedDB(SQL) {
    return new Promise((resolve) => {
        const request = indexedDB.open('MyAppDB', 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore('datastore', { keyPath: 'id' });
        request.onsuccess = e => {
            const tx = e.target.result.transaction('datastore', 'readonly');
            const get = tx.objectStore('datastore').get('main');
            get.onsuccess = () => resolve(get.result?.data ? new SQL.Database(get.result.data) : null);
            get.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
    });
}

// =================================================================
// === GOOGLE DRIVE INTEGRATION
// =================================================================

function ensureAuthThenRun(callback) {
  if (!accessToken) {
    initGoogleDriveAuth(callback);
  } else {
    callback();
  }
}

function initGoogleDriveAuth(callback) {
    showStatus(translate('status_gdrive_signin_await'), 'info');
    const CLIENT_ID = loadClientIdFromDB();

    if (!CLIENT_ID) {
        showStatus(translate('status_gdrive_client_id_not_set'), 'error');
        return;
    }

    google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error) {
                showStatus(translate('status_gdrive_signin_failed'), 'error');
                return;
            }
            accessToken = response.access_token;
            document.getElementById('auth-status').textContent = translate('auth_status_signed_in');
            showStatus(translate('status_gdrive_signin_success'), 'success');
            if (callback) callback();
        }
    }).requestAccessToken();
}

async function exportDatabaseToDrive() {
  if (!db) { showStatus(translate('status_export_no_db'), 'error'); return; }
  try {
    showStatus(translate('status_exporting'), 'info');
    const metadata = { name: `store_database_${new Date().toISOString().split('T')[0]}.db`, description: 'SQLite database export' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([db.export()], { type: 'application/octet-stream' }));
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size', {
      method: 'POST',
      headers: new Headers({ Authorization: 'Bearer ' + accessToken }),
      body: form,
    });
    if (!response.ok) throw new Error(translate('error_upload_failed').replace('{status}', response.status).replace('{statusText}', response.statusText));
    const result = await response.json();
    const fileId = result.id;
    showStatus(translate('status_export_success').replace('{fileId}', fileId), 'success');
    await saveLatestDriveId(fileId);
    document.getElementById('drive-file-id').value = fileId;
  } catch (error) { showStatus(translate('status_export_failed').replace('{error}', error.message), 'error'); }
}

async function importDatabaseFromDrive(fileId) {
    if (!fileId) { showStatus(translate('status_import_no_id'), 'error'); return; }
    try {
        showStatus(translate('status_import_downloading'), 'info');
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: new Headers({ Authorization: 'Bearer ' + accessToken }), });
        if (!response.ok) throw new Error(translate('error_download_failed').replace('{status}', response.status).replace('{statusText}', response.statusText));
        showStatus(translate('status_import_loading'), 'info');
        const newDb = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
        const tablesResult = newDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        if (tablesResult.length === 0 || tablesResult[0].values.length === 0) {
            newDb.close();
            throw new Error(translate('error_import_no_tables'));
        }
        if (db) db.close();
        db = newDb;
        showStatus(translate('status_import_saving'), 'info');
        await saveToIndexedDB();
        updateUI();
        showStatus(translate('status_import_success').replace('{count}', tablesResult[0].values.length), 'success');
        document.getElementById('drive-file-id').value = '';
    } catch (error) { showStatus(translate('status_import_failed').replace('{error}', error.message), 'error'); }
}

// =================================================================
// === DANGER ZONE FUNCTIONS
// =================================================================

async function deleteAllData() {
    if (!db) { showStatus(translate('status_delete_no_db'), 'error'); return; }
    try {
        showStatus(translate('status_deleting_data'), 'info');
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        const tablesToClear = tablesResult[0].values.flat();
        tablesToClear.forEach(table => {
            db.run(`DELETE FROM ${table};`);
            db.run(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
        });
        showStatus(translate('status_delete_success'), 'success');
        await saveToIndexedDB();
        updateUI();
    } catch (error) {
        console.error("Error deleting data:", error);
        showStatus(translate('status_delete_error').replace('{error}', error.message), 'error');
    }
}
async function initializeSampleData() {
    if (!db) throw new Error(translate('status_delete_no_db'));
    
    // --- Configuration for the dataset size ---
    const numProducts = 100;
    const numOrders = 2000;
    const numBorrowers = 100; // More borrowers for a better distribution
    // ------------------------------------------

    showStatus(translate('status_sample_initializing_large').replace('{count}', numOrders.toLocaleString()), 'info');

    try {
        // Step 1: Wrap everything in a transaction for massive speed improvement and safety.
        db.exec("BEGIN TRANSACTION;");

        // Step 2: Clear all existing data from tables.
        showStatus(translate('status_sample_clearing'), 'info');
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        const tablesToClear = tablesResult[0].values.flat();
        tablesToClear.forEach(table => db.run(`DELETE FROM ${table};`));

        // Step 3: Generate Products using a memory-efficient Prepared Statement.
        showStatus(translate('status_sample_generating_products').replace('{count}', numProducts.toLocaleString()), 'info');
        const productData = [];
        const productInsertStmt = db.prepare(`
            INSERT INTO products (name, price_buy, price_sell, stock, stock_danger, created_at) 
            VALUES (?, ?, ?, ?, ?, ?);
        `);
        for (let i = 1; i <= numProducts; i++) {
            const priceBuy = 50 + i * 2;
            const priceSell = 100 + i * 3;
            const stock = Math.floor(Math.random() * 200) + 20;
            const stockDanger = Math.floor(Math.random() * 20) + 5;
            
            productInsertStmt.run([`Product ${i}`, priceBuy, priceSell, stock, stockDanger, '2025-08-09']);
            
            // Still need this in memory to create orders later
            productData.push({ id: i, name: `Product ${i}`, price_buy: priceBuy, price_sell: priceSell });
        }
        productInsertStmt.free(); // Release the statement from memory

        // Step 4: Generate Orders and link them to Borrowers. This is the most intensive part.
        const borrowerTotals = new Array(numBorrowers).fill(0);
        
        // Prepare all statements *before* the loop for maximum performance
        const orderInsertStmt = db.prepare(`INSERT INTO orders (created_at) VALUES (?)`);
        const orderSnapshotStmt = db.prepare(`INSERT INTO orders_snapshots (original_order_id, borrower_id, date, total_price) VALUES (?, ?, ?, ?)`);
        const productSnapshotStmt = db.prepare(`INSERT INTO products_snapshots (order_id, product_id, name, price_buy, price_sell, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        
        const getRandomDateInYear = () => new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

        for (let i = 1; i <= numOrders; i++) {
             // Provide UI feedback without freezing the browser
            if (i % 10000 === 0) {
                showStatus(translate('status_sample_generating_orders').replace('{current}', i.toLocaleString()).replace('{total}', numOrders.toLocaleString()), 'info');
                // Give the browser a moment to update the UI
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const orderDate = getRandomDateInYear();
            const borrowerId = Math.floor(Math.random() * numBorrowers) + 1;
            let currentOrderTotalPrice = 0;

            // Insert the order and get its new ID
            orderInsertStmt.run([orderDate]);
            const orderId = db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];

            const numProductsInOrder = Math.floor(Math.random() * 4) + 1;
            for (let j = 0; j < numProductsInOrder; j++) {
                const product = productData[Math.floor(Math.random() * productData.length)];
                const quantity = Math.floor(Math.random() * 5) + 1;
                const priceAtSale = parseFloat(product.price_sell.toFixed(2));
                
                currentOrderTotalPrice += quantity * priceAtSale;
                
                productSnapshotStmt.run([orderId, product.id, product.name, product.price_buy, priceAtSale, quantity, orderDate.split(' ')[0]]);
            }

            const finalOrderPrice = parseFloat(currentOrderTotalPrice.toFixed(2));
            orderSnapshotStmt.run([orderId, borrowerId, orderDate.split(' ')[0], finalOrderPrice]);
            
            borrowerTotals[borrowerId - 1] += finalOrderPrice;
        }
        // Free all prepared statements
        orderInsertStmt.free();
        orderSnapshotStmt.free();
        productSnapshotStmt.free();


        // Step 5: Generate the Borrowers with their final calculated totals.
        showStatus(translate('status_sample_generating_borrowers').replace('{count}', numBorrowers.toLocaleString()), 'info');
        const borrowerInsertStmt = db.prepare(`INSERT INTO borrowers (name, date, amount) VALUES (?, ?, ?)`);
        const names = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Emma', 'David', 'Sophia', 'Michael', 'Olivia', 'Liam', 'Ava'];
        for (let i = 1; i <= numBorrowers; i++) {
            const name = `${names[Math.floor(Math.random() * names.length)]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${i}`;
            borrowerInsertStmt.run([name, '2025-08-09', borrowerTotals[i - 1].toFixed(2)]);
        }
        borrowerInsertStmt.free();

        // Step 6: Commit all changes to the database at once.
        db.exec("COMMIT;");
        
        showStatus(translate('status_sample_success'), 'success');
        updateUI(); // Assuming you have functions to refresh the UI
        await saveToIndexedDB(); // Assuming you have this function

    } catch (error) {
        console.error("Error initializing large sample data:", error);
        showStatus(translate('status_sample_error').replace('{error}', error.message), 'error');
        db.exec("ROLLBACK;"); // If anything fails, undo all changes.
    }
}

// =================================================================
// === EVENT LISTENERS
// =================================================================
document.addEventListener('DOMContentLoaded', async() => {




    document.getElementById('prune-history-btn').addEventListener('click', async () => {
        // Show a very clear confirmation dialog
        if (confirm(translate('confirm_prune_half_data'))) {
            try {
                showStatus(translate('status_pruning_data'), 'info');
                await pruneDatabaseHistory();
                showStatus(translate('status_prune_success'), 'success');
                // Refresh the UI to show updated table counts
                updateUI(); 
            } catch (error) {
                showStatus(translate('status_prune_error').replace('{error}', error.message), 'error');
            }
        }
    });
    document.getElementById('save-client-id-btn').addEventListener('click', saveClientIdToDB);
    document.getElementById('export-db-to-drive-btn').addEventListener('click', () => ensureAuthThenRun(exportDatabaseToDrive));
    document.getElementById('import-db-from-drive-btn').addEventListener('click', () => {
        const fileId = document.getElementById('drive-file-id').value.trim();
        ensureAuthThenRun(() => importDatabaseFromDrive(fileId));
    });
    document.getElementById('init-sample-data-btn').addEventListener('click', () => {
        if (confirm(translate('confirm_init_sample_data'))) {
            initializeSampleData();
        }
    });
    document.getElementById('delete-all-data-btn').addEventListener('click', () => {
        if (confirm(translate('confirm_delete_all_data'))) {
            deleteAllData();
        }
    });
    document.getElementById('table-selector').addEventListener('change', displaySelectedTable);
    document.getElementById('refresh-table-btn').addEventListener('click', updateUI);
     document.getElementById('lang-select').addEventListener('change', () => {
      // Use a minimal timeout to ensure the language script has updated the dictionary
      // before we try to re-translate and re-render the dynamic elements.
      setTimeout(updateUI, 0);
    });
    
    
    initApp();
});