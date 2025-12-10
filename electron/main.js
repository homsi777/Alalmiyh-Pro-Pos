const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const SQLite = require('better-sqlite3');

const isDev = !app.isPackaged;
const DB_PATH = path.join(app.getPath('userData'), 'pos_system.db');
let db;
let mainWindow;
let printWindow;

function initializeDatabase() {
    try {
        db = new SQLite(DB_PATH);
        console.log('[Electron DB] Database connected successfully at', DB_PATH);

        const migrationScript = `
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parentId TEXT
            );
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sku TEXT UNIQUE,
                stock REAL NOT NULL,
                costPrice TEXT NOT NULL,
                wholesalePrice TEXT NOT NULL,
                sellingPrice TEXT NOT NULL,
                categoryId TEXT,
                FOREIGN KEY (categoryId) REFERENCES categories(id)
            );

            -- Updated schemas to include balances column
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT,
                balance REAL,
                balanceCurrency TEXT,
                balances TEXT
            );
            CREATE TABLE IF NOT EXISTS suppliers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT,
                balance REAL,
                balanceCurrency TEXT,
                balances TEXT
            );
            
            CREATE TABLE IF NOT EXISTS expense_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS expenses (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                categoryId TEXT,
                cashRegisterId TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                amountInSyp REAL NOT NULL,
                FOREIGN KEY (categoryId) REFERENCES expense_categories(id),
                FOREIGN KEY (cashRegisterId) REFERENCES cash_registers(id)
            );
            CREATE TABLE IF NOT EXISTS cash_registers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                balances TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cash_transactions (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                registerId TEXT NOT NULL,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,
                amountInSyp REAL NOT NULL,
                description TEXT NOT NULL,
                relatedId TEXT,
                linkedInvoiceId TEXT, -- NEW COLUMN FOR SMART PAYMENTS
                FOREIGN KEY (registerId) REFERENCES cash_registers(id)
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                totalAmount REAL NOT NULL,
                currency TEXT NOT NULL,
                paymentType TEXT NOT NULL,
                totalAmountInSyp REAL NOT NULL,
                customerId TEXT,
                supplierId TEXT,
                type TEXT NOT NULL,
                cashRegisterId TEXT,
                vendorInvoiceNumber TEXT
            );
            CREATE TABLE IF NOT EXISTS invoice_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoiceId TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                quantity REAL NOT NULL,
                unitPrice TEXT NOT NULL,
                totalPrice TEXT NOT NULL,
                FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS settings_internal (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `;
        db.exec(migrationScript);
        
        console.log('[Electron DB] Tables created or verified.');

        // --- Migrations for Existing Databases ---
        
        // 1. Vendor Invoice Number Migration
        try {
            const tableInfo = db.prepare("PRAGMA table_info(invoices)").all();
            const hasVendorCol = tableInfo.some(col => col.name === 'vendorInvoiceNumber');
            if (!hasVendorCol) {
                db.prepare("ALTER TABLE invoices ADD COLUMN vendorInvoiceNumber TEXT;").run();
                console.log('[Electron DB] Added vendorInvoiceNumber column.');
            }
        } catch (e) { console.error('Migration error (invoices):', e); }

        // 2. Customers Multi-currency Migration
        try {
            const tableInfo = db.prepare("PRAGMA table_info(customers)").all();
            const hasBalances = tableInfo.some(col => col.name === 'balances');
            if (!hasBalances) {
                db.prepare("ALTER TABLE customers ADD COLUMN balances TEXT;").run();
                console.log('[Electron DB] Added balances column to customers.');
                
                // Migrate old data
                const customers = db.prepare("SELECT id, balance, balanceCurrency FROM customers").all();
                const updateStmt = db.prepare("UPDATE customers SET balances = ? WHERE id = ?");
                
                const transaction = db.transaction((custs) => {
                    for(const c of custs) {
                        const bal = { "SYP": 0, "USD": 0, "TRY": 0 };
                        const cur = c.balanceCurrency || 'SYP';
                        bal[cur] = c.balance || 0;
                        updateStmt.run(JSON.stringify(bal), c.id);
                    }
                });
                transaction(customers);
                console.log('[Electron DB] Migrated customer balances.');
            }
        } catch(e) { console.error('Migration error (customers):', e); }

        // 3. Suppliers Multi-currency Migration
        try {
            const tableInfo = db.prepare("PRAGMA table_info(suppliers)").all();
            const hasBalances = tableInfo.some(col => col.name === 'balances');
            if (!hasBalances) {
                db.prepare("ALTER TABLE suppliers ADD COLUMN balances TEXT;").run();
                console.log('[Electron DB] Added balances column to suppliers.');
                
                // Migrate old data
                const suppliers = db.prepare("SELECT id, balance, balanceCurrency FROM suppliers").all();
                const updateStmt = db.prepare("UPDATE suppliers SET balances = ? WHERE id = ?");
                
                const transaction = db.transaction((supps) => {
                    for(const s of supps) {
                        const bal = { "SYP": 0, "USD": 0, "TRY": 0 };
                        const cur = s.balanceCurrency || 'SYP';
                        bal[cur] = s.balance || 0;
                        updateStmt.run(JSON.stringify(bal), s.id);
                    }
                });
                transaction(suppliers);
                console.log('[Electron DB] Migrated supplier balances.');
            }
        } catch(e) { console.error('Migration error (suppliers):', e); }

        // 4. Linked Invoice ID for Cash Transactions
        try {
            const tableInfo = db.prepare("PRAGMA table_info(cash_transactions)").all();
            const hasLinkedCol = tableInfo.some(col => col.name === 'linkedInvoiceId');
            if (!hasLinkedCol) {
                db.prepare("ALTER TABLE cash_transactions ADD COLUMN linkedInvoiceId TEXT;").run();
                console.log('[Electron DB] Added linkedInvoiceId column to cash_transactions.');
            }
        } catch(e) { console.error('Migration error (cash_transactions):', e); }


        // Seeding
        db.transaction(() => {
            db.prepare('INSERT OR IGNORE INTO users (id, username, password, role) VALUES (?, ?, ?, ?);').run('u-1', 'admin', 'admin', 'admin');
            
            // Seed default customer with new balances format
            const defaultBalances = JSON.stringify({ "SYP": 0, "USD": 0, "TRY": 0 });
            // We use INSERT OR IGNORE. If it exists, we assume migration handled it. If new, we insert with balances.
            // Note: If ID exists, this is ignored.
            db.prepare('INSERT OR IGNORE INTO customers (id, name, phone, balances) VALUES (?, ?, ?, ?);').run('c-cash', 'عميل نقدي سريع', '', defaultBalances);
            
            db.prepare('INSERT OR IGNORE INTO cash_registers (id, name, balances) VALUES (?, ?, ?);').run('cr-1', 'الصندوق الرئيسي', defaultBalances);
            db.prepare(`INSERT OR IGNORE INTO settings_internal (key, value) VALUES ('nextInvoiceNumber', '1');`).run();
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);`).run('exchangeRates', '{"USD":14000,"TRY":450}');
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);`).run('companyInfo', '{"name":"اسم الشركة","address":"العنوان","phone":"رقم الهاتف"}');
            db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);`).run('printerSettings', '{"paperSize":"80mm"}');
        })();

        console.log('[Electron DB] Initial data seeded successfully.');

    } catch (error) {
        console.error("❌ Fatal error initializing Electron database:", error);
        app.quit();
    }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function setupIpcHandlers() {
    // --- Database Handlers ---
    ipcMain.handle('db:query', (event, sql, params) => {
        try { return db.prepare(sql).all(...(params || [])); }
        catch (e) { console.error('[IPC:query] Error:', e.message); throw e; }
    });

    ipcMain.handle('db:run', (event, sql, params) => {
        try { return db.prepare(sql).run(...(params || [])); }
        catch (e) { console.error('[IPC:run] Error:', e.message); throw e; }
    });

    ipcMain.handle('db:get', (event, sql, params) => {
        try { return db.prepare(sql).get(...(params || [])); }
        catch (e) { console.error('[IPC:get] Error:', e.message); throw e; }
    });

    ipcMain.handle('db:transaction', (event, operations) => {
        try {
            const transaction = db.transaction(() => {
                for (const op of operations) {
                    db.prepare(op.statement).run(...(op.values || []));
                }
            });
            transaction();
            return { success: true };
        } catch (e) {
            console.error('[IPC:transaction] Error:', e.message);
            return { success: false, error: e.message };
        }
    });

    // --- Printer Handlers ---
    ipcMain.handle('printer:list', async () => {
        if (!mainWindow) return [];
        try {
            const printers = await mainWindow.webContents.getPrintersAsync();
            return printers.map(p => ({ name: p.name, address: p.name }));
        } catch (e) { return []; }
    });

    // Unified Robust Printing Handler
    ipcMain.handle('printer:print-job', async (event, htmlContent, options) => {
        return new Promise((resolve, reject) => {
            try {
                // 1. Create a unique temporary file
                const tempDir = os.tmpdir();
                const tempFilePath = path.join(tempDir, `print_job_${Date.now()}.html`);
                
                // 2. Write the HTML content to the file
                fs.writeFileSync(tempFilePath, htmlContent, { encoding: 'utf-8' });

                // 3. Create a hidden window
                if (printWindow && !printWindow.isDestroyed()) {
                    printWindow.close();
                }
                printWindow = new BrowserWindow({ 
                    show: false, 
                    width: 800, 
                    height: 600,
                    webPreferences: { contextIsolation: false } 
                });

                // 4. Load the file (More stable than data URLs)
                printWindow.loadFile(tempFilePath);

                const cleanUp = () => {
                    if (fs.existsSync(tempFilePath)) {
                        try { fs.unlinkSync(tempFilePath); } catch(e) {}
                    }
                };

                printWindow.webContents.on('did-finish-load', () => {
                    // Determine print options
                    const printOptions = {
                        silent: options.silent || false,
                        printBackground: true,
                        deviceName: options.deviceName || '',
                    };

                    // If margins are strictly none (for thermal)
                    if (options.margins === 'none') {
                        printOptions.margins = { marginType: 'none' };
                    }

                    // Execute Print
                    printWindow.webContents.print(printOptions, (success, failureReason) => {
                        cleanUp();
                        if (printWindow && !printWindow.isDestroyed()) {
                            printWindow.close();
                        }
                        printWindow = null;

                        if (success) {
                            resolve({ success: true });
                        } else {
                            reject(new Error(failureReason || 'Print failed'));
                        }
                    });
                });

                printWindow.webContents.on('did-fail-load', (e, errorCode, desc) => {
                    cleanUp();
                    if (printWindow && !printWindow.isDestroyed()) printWindow.close();
                    reject(new Error(`Failed to load print content: ${desc}`));
                });

            } catch (error) {
                console.error("Print System Error:", error);
                reject(error);
            }
        });
    });

    // --- Save PDF Handler ---
    ipcMain.handle('printer:save-pdf', async (event, htmlContent, defaultFilename, options) => {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Create temp file
                const tempDir = os.tmpdir();
                const tempFilePath = path.join(tempDir, `pdf_gen_${Date.now()}.html`);
                fs.writeFileSync(tempFilePath, htmlContent, { encoding: 'utf-8' });

                // 2. Create hidden window
                let pdfWindow = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { contextIsolation: false } });
                
                await pdfWindow.loadFile(tempFilePath);

                // 3. Open Save Dialog
                const { canceled, filePath } = await dialog.showSaveDialog({
                    title: 'حفظ كملف PDF',
                    defaultPath: defaultFilename,
                    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
                });

                if (canceled || !filePath) {
                    pdfWindow.close();
                    fs.unlinkSync(tempFilePath);
                    return resolve({ success: false, error: 'تم إلغاء الحفظ' });
                }

                // 4. Configure PDF Options based on Paper Size
                let pdfOptions = {
                    printBackground: true,
                };

                if (options && (options.paperSize === '80mm')) {
                    // Thermal 80mm: Width ~3.15 inches. Height is automatic based on content.
                    pdfOptions.pageSize = { width: 3.15, height: 11.69 }; // height is arbitrary large A4 length
                    pdfOptions.margins = { top: 0, bottom: 0, left: 0, right: 0 };
                } else if (options && (options.paperSize === '58mm')) {
                    // Thermal 58mm: Width ~2.28 inches
                    pdfOptions.pageSize = { width: 2.28, height: 11.69 }; 
                    pdfOptions.margins = { top: 0, bottom: 0, left: 0, right: 0 };
                } else {
                    // Default A4
                    pdfOptions.pageSize = 'A4';
                    pdfOptions.margins = { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4, unit: 'in' };
                }

                // 5. Print to PDF
                const data = await pdfWindow.webContents.printToPDF(pdfOptions);

                // 6. Write to disk
                fs.writeFileSync(filePath, data);

                // Cleanup
                pdfWindow.close();
                fs.unlinkSync(tempFilePath);

                resolve({ success: true });

            } catch (error) {
                console.error("Save PDF Error:", error);
                resolve({ success: false, error: error.message });
            }
        });
    });
}

app.whenReady().then(() => {
    initializeDatabase();
    setupIpcHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});