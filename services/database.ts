import { sqliteService } from './sqliteService';
import { AuthRepository } from './repositories/AuthRepository';
import { FinanceRepository } from './repositories/FinanceRepository';
import { InventoryRepository } from './repositories/InventoryRepository';
import { LedgerRepository } from './repositories/LedgerRepository';
import { SalesRepository } from './repositories/SalesRepository';
import { SettingsRepository } from './repositories/SettingsRepository';
import { isCapacitor } from './platform';
import { Currency } from '../types';

export class DatabaseService {
    public static async initialize() {
        if (!isCapacitor) {
            console.log("Skipping Capacitor DB initialization on this platform.");
            return;
        }

        try {
            await sqliteService.initialize();
            const db = sqliteService.getDb();

            // This logic should run every time to ensure all tables exist.
            // It's safe because of "IF NOT EXISTS".
            const schemaStatements = [
                AuthRepository.getCreateTableSql(),
                InventoryRepository.getCreateTableSql(),
                LedgerRepository.getCreateTableSql(),
                FinanceRepository.getCreateTableSql(),
                SalesRepository.getCreateTableSql(),
                SettingsRepository.getCreateTableSql(),
            ].join('');
            
            await db.execute(schemaStatements);

            // --- Migrations ---
            
            // 1. Vendor Invoice Number
            try {
                await db.run("ALTER TABLE invoices ADD COLUMN vendorInvoiceNumber TEXT;");
                console.log("Migration: Added vendorInvoiceNumber column.");
            } catch (e) { /* Ignore */ }

            // 2. Multi-currency for Customers
            try {
                await db.run("ALTER TABLE customers ADD COLUMN balances TEXT;");
                console.log("Migration: Added balances column to customers.");
                // Migrate existing data
                const customers = await db.query("SELECT id, balance, balanceCurrency FROM customers WHERE balances IS NULL;");
                if (customers.values && customers.values.length > 0) {
                     const operations = customers.values.map(c => {
                        const bal = { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 };
                        bal[c.balanceCurrency as Currency] = c.balance;
                        return {
                            statement: "UPDATE customers SET balances = ? WHERE id = ?;",
                            values: [JSON.stringify(bal), c.id]
                        };
                    });
                    await db.executeTransaction(operations);
                    console.log(`Migrated ${operations.length} customers to multi-currency.`);
                }
            } catch (e) { /* Ignore */ }

             // 3. Multi-currency for Suppliers
             try {
                await db.run("ALTER TABLE suppliers ADD COLUMN balances TEXT;");
                console.log("Migration: Added balances column to suppliers.");
                // Migrate existing data
                const suppliers = await db.query("SELECT id, balance, balanceCurrency FROM suppliers WHERE balances IS NULL;");
                if (suppliers.values && suppliers.values.length > 0) {
                     const operations = suppliers.values.map(s => {
                        const bal = { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 };
                        bal[s.balanceCurrency as Currency] = s.balance;
                        return {
                            statement: "UPDATE suppliers SET balances = ? WHERE id = ?;",
                            values: [JSON.stringify(bal), s.id]
                        };
                    });
                    await db.executeTransaction(operations);
                    console.log(`Migrated ${operations.length} suppliers to multi-currency.`);
                }
            } catch (e) { /* Ignore */ }

            // 4. Linked Invoice ID
            try {
                await db.run("ALTER TABLE cash_transactions ADD COLUMN linkedInvoiceId TEXT;");
                console.log("Migration: Added linkedInvoiceId column to cash_transactions.");
            } catch (e) { /* Ignore */ }


            // Seeding should only happen if data doesn't exist.
            const checkSeed = await db.query("SELECT id FROM users WHERE id = 'u-1';");
            if (checkSeed.values && checkSeed.values.length === 0) {
                console.log("Seeding initial data for Capacitor...");
                const seedStatements: { statement: string; values?: any[] }[] = [];
                
                const authSeed = AuthRepository.getSeedSql();
                seedStatements.push({ statement: authSeed.stmt, values: authSeed.values });
                
                const ledgerSeed = LedgerRepository.getSeedSql();
                seedStatements.push({ statement: ledgerSeed.stmt, values: ledgerSeed.values });
                
                const financeSeed = FinanceRepository.getSeedSql();
                seedStatements.push({ statement: financeSeed.stmt, values: financeSeed.values });

                const settingsSeed = SettingsRepository.getSeedSql();
                for (const seed of settingsSeed) {
                    seedStatements.push({ statement: seed.stmt, values: seed.values });
                }
                
                const salesSeed = SalesRepository.getSeedSql();
                seedStatements.push({ statement: salesSeed.stmt, values: salesSeed.values });

                await db.executeTransaction(seedStatements);
                console.log("Capacitor data seeded successfully.");
            }
            
            console.log("Capacitor Database is ready.");

        } catch (error) {
            console.error("CAPACITOR DATABASE INITIALIZATION FAILED:", error);
            alert('فشل تهيئة قاعدة البيانات. قد تحتاج إلى إعادة تشغيل التطبيق.');
        }
    }
}