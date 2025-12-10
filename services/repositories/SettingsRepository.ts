
import { CompanyInfo, Currency, Invoice, PrinterSettings, LicenseInfo, LicenseType } from '../../types';
import { BaseRepository } from './BaseRepository';
import { InventoryRepository } from './InventoryRepository';
import { FinanceRepository } from './FinanceRepository';
import { LedgerRepository } from './LedgerRepository';
import { SalesRepository } from './SalesRepository';
import { AuthRepository } from './AuthRepository';

interface ExchangeRates {
  USD: number;
  TRY: number;
}

export class SettingsRepository extends BaseRepository {

    public static getCreateTableSql(): string {
        return `
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );`;
    }

    public static getSeedSql(): { stmt: string, values: any[] }[] {
        const rates = JSON.stringify({ USD: 14000, TRY: 450 });
        const companyInfo = JSON.stringify({ name: 'اسم الشركة', address: 'العنوان', phone: 'رقم الهاتف' });
        const printerSettings = JSON.stringify({ paperSize: '80mm' });
        // NOTE: We do NOT seed 'isSetupCompleted' or 'licenseInfo' here. 
        // Absence of 'isSetupCompleted' means setup is needed.
        return [
            { stmt: `INSERT OR IGNORE INTO settings (key, value) VALUES ('exchangeRates', ?);`, values: [rates] },
            { stmt: `INSERT OR IGNORE INTO settings (key, value) VALUES ('companyInfo', ?);`, values: [companyInfo] },
            { stmt: `INSERT OR IGNORE INTO settings (key, value) VALUES ('printerSettings', ?);`, values: [printerSettings] }
        ];
    }
    
    private static async getSetting<T>(key: string): Promise<T | null> {
        const result = await this.execute({
            electron: async () => this.dbGet('SELECT value FROM settings WHERE key = ?;', [key]),
            capacitor: async () => (await this.getDb().query('SELECT value FROM settings WHERE key = ?;', [key])).values?.[0],
            web: async () => null,
        });
        return result ? JSON.parse(result.value) : null;
    }

    private static async setSetting<T>(key: string, value: T): Promise<void> {
        const stmt = `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`;
        const values = [key, JSON.stringify(value)];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: setSetting skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

    // Exchange Rates
    public static async getExchangeRates(): Promise<ExchangeRates | null> {
        return this.getSetting<ExchangeRates>('exchangeRates');
    }
    public static async setExchangeRates(rates: ExchangeRates) {
        await this.setSetting('exchangeRates', rates);
    }
    
    // Company Info
    public static async getCompanyInfo(): Promise<CompanyInfo | null> {
        return this.getSetting<CompanyInfo>('companyInfo');
    }
    public static async setCompanyInfo(info: CompanyInfo) {
        await this.setSetting('companyInfo', info);
    }

    // Printer Settings
    public static async getPrinterSettings(): Promise<PrinterSettings | null> {
        return this.getSetting<PrinterSettings>('printerSettings');
    }
    public static async setPrinterSettings(settings: PrinterSettings) {
        await this.setSetting('printerSettings', settings);
    }

    // Setup & License
    public static async isSetupCompleted(): Promise<boolean> {
        const val = await this.getSetting<boolean>('isSetupCompleted');
        return !!val;
    }
    public static async setSetupCompleted(completed: boolean) {
        await this.setSetting('isSetupCompleted', completed);
    }

    public static async getLicenseInfo(): Promise<LicenseInfo | null> {
        return this.getSetting<LicenseInfo>('licenseInfo');
    }
    public static async setLicenseInfo(info: LicenseInfo) {
        await this.setSetting('licenseInfo', info);
    }
    
    // Backup & Restore
    public static async backup(): Promise<string> {
        const data = {
            products: await InventoryRepository.getProducts(),
            categories: await InventoryRepository.getCategories(),
            invoices: await SalesRepository.getInvoices(),
            nextInvoiceNumber: await SalesRepository.getNextInvoiceNumber(),
            customers: await LedgerRepository.getCustomers(),
            suppliers: await LedgerRepository.getSuppliers(),
            expenseCategories: await FinanceRepository.getExpenseCategories(),
            expenses: await FinanceRepository.getExpenses(),
            cashRegisters: await FinanceRepository.getCashRegisters(),
            cashTransactions: await FinanceRepository.getCashTransactions(),
            rates: await this.getExchangeRates(),
            companyInfo: await this.getCompanyInfo(),
            printerSettings: await this.getPrinterSettings(),
            licenseInfo: await this.getLicenseInfo(), // Backup license too
        };
        return JSON.stringify(data, null, 2);
    }

    public static async restore(jsonData: string): Promise<{ success: boolean, message: string }> {
        try {
            const data = JSON.parse(jsonData);
            // We use set methods which will clear and re-insert
            if (data.products) await InventoryRepository.setProducts(data.products);
            if (data.categories) await InventoryRepository.setCategories(data.categories);
            if (data.customers) await LedgerRepository.setCustomers(data.customers);
            if (data.suppliers) await LedgerRepository.setSuppliers(data.suppliers);
            if (data.expenseCategories) await FinanceRepository.setExpenseCategories(data.expenseCategories);
            if (data.expenses) await FinanceRepository.setExpenses(data.expenses);
            if (data.cashRegisters) await FinanceRepository.setCashRegisters(data.cashRegisters);
            if (data.cashTransactions) await FinanceRepository.setCashTransactions(data.cashTransactions);
            // Invoices must be last due to relations
            if (data.invoices) await SalesRepository.setInvoices(data.invoices);
            if (data.nextInvoiceNumber) {
                 await this.execute({
                    electron: async () => this.dbRun(`UPDATE settings_internal SET value = ? WHERE key = 'nextInvoiceNumber';`, [data.nextInvoiceNumber.toString()]),
                    capacitor: async () => {
                        const result = await this.getDb().run(`UPDATE settings_internal SET value = ? WHERE key = 'nextInvoiceNumber';`, [data.nextInvoiceNumber.toString()]);
                        return {
                            changes: result.changes?.changes ?? 0,
                            lastInsertRowid: result.changes?.lastId ?? 0,
                        };
                    },
                    web: async () => { return { changes: 0, lastInsertRowid: 0 }; },
                 });
            }
            if (data.rates) await this.setExchangeRates(data.rates);
            if (data.companyInfo) await this.setCompanyInfo(data.companyInfo);
            if (data.printerSettings) await this.setPrinterSettings(data.printerSettings);
            if (data.licenseInfo) await this.setLicenseInfo(data.licenseInfo);

            return { success: true, message: 'تم استعادة البيانات بنجاح! سيتم إعادة تحميل التطبيق.' };
        } catch (error) {
            console.error("Failed to restore data:", error);
            return { success: false, message: 'فشل في استعادة البيانات. الملف غير صالح.' };
        }
    }

    public static async restoreMerge(jsonData: string): Promise<{ success: boolean; message: string }> {
        try {
            const data = JSON.parse(jsonData);
            let messages: string[] = [];

            // Import master data first (customers, products, etc.)
            if (data.customers) {
                const { imported } = await LedgerRepository.importCustomers(data.customers);
                if (imported > 0) messages.push(`تم استيراد ${imported} عميل جديد.`);
            }
            if (data.suppliers) {
                const { imported } = await LedgerRepository.importSuppliers(data.suppliers);
                if (imported > 0) messages.push(`تم استيراد ${imported} مورد جديد.`);
            }
            if (data.categories) {
                const { imported } = await InventoryRepository.importCategories(data.categories);
                if (imported > 0) messages.push(`تم استيراد ${imported} فئة جديدة.`);
            }
            if (data.products) {
                const { imported } = await InventoryRepository.importProducts(data.products);
                if (imported > 0) messages.push(`تم استيراد ${imported} منتج جديد.`);
            }
            if (data.expenseCategories) {
                const { imported } = await FinanceRepository.importExpenseCategories(data.expenseCategories);
                if (imported > 0) messages.push(`تم استيراد ${imported} تصنيف مصروفات جديد.`);
            }

            // Then import transactional data that depends on master data
            if (data.invoices && Array.isArray(data.invoices)) {
                const { imported, skipped } = await SalesRepository.importInvoices(data.invoices as Invoice[]);
                if (imported > 0) messages.push(`تم دمج ${imported} فاتورة جديدة.`);
                if (skipped > 0) messages.push(`تم تخطي ${skipped} فاتورة موجودة مسبقًا.`);
            }
            if (data.expenses) {
                 const { imported } = await FinanceRepository.importExpenses(data.expenses);
                 if (imported > 0) messages.push(`تم دمج ${imported} مصروف جديد.`);
            }
            // Note: We don't import cash registers or cash transactions directly.
            // They are affected by importing invoices and expenses.

            if (messages.length === 0) {
                messages.push("لم يتم العثور على بيانات جديدة لدمجها.");
            } else {
                messages.push("سيتم إعادة تحميل التطبيق لتطبيق التغييرات.")
            }

            return { success: true, message: `اكتمل الدمج: ${messages.join(' ')}` };
        } catch (error) {
            console.error("Failed to merge data:", error);
            return { success: false, message: 'فشل في دمج البيانات. الملف قد يكون غير صالح.' };
        }
    }
}
