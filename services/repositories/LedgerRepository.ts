import { Customer, Supplier, Currency } from '../../types';
import { BaseRepository } from './BaseRepository';

export class LedgerRepository extends BaseRepository {
    
    public static getCreateTableSql(): string {
        return `
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            balance REAL DEFAULT 0,
            balanceCurrency TEXT DEFAULT 'SYP',
            balances TEXT -- JSON Object for multi-currency
        );
        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            balance REAL DEFAULT 0,
            balanceCurrency TEXT DEFAULT 'SYP',
            balances TEXT -- JSON Object
        );`;
    }

    public static getSeedSql(): { stmt: string, values: any[] } {
        const defaultBalances = JSON.stringify({ [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 });
        return {
            stmt: 'INSERT OR IGNORE INTO customers (id, name, phone, balances, balance, balanceCurrency) VALUES (?, ?, ?, ?, ?, ?);',
            values: ['c-cash', 'عميل نقدي سريع', '', defaultBalances, 0, 'SYP']
        };
    }

    private static parseParty(party: any): any {
        if (!party) return null;
        let balances = { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 };
        
        if (party.balances) {
            try {
                balances = { ...balances, ...JSON.parse(party.balances) };
            } catch (e) { console.error("Error parsing balances", e); }
        } else if (party.balance !== undefined && party.balanceCurrency) {
            // Fallback for old data not migrated
            balances[party.balanceCurrency as Currency] = party.balance;
        }

        return {
            ...party,
            balances
        };
    }

    // Customers
    public static async getCustomers(): Promise<Customer[]> {
        return this.execute({
            electron: async () => (await this.dbQuery('SELECT * FROM customers;')).map(this.parseParty),
            capacitor: async () => ((await this.getDb().query('SELECT * FROM customers;')).values || []).map(this.parseParty),
            web: async () => [],
        });
    }

    public static async addCustomer(customer: Customer): Promise<void> {
        // Fix: Explicitly insert 0 and 'SYP' for balance/balanceCurrency to satisfy NOT NULL constraint on older DB schemas
        const stmt = 'INSERT INTO customers (id, name, phone, balances, balance, balanceCurrency) VALUES (?, ?, ?, ?, 0, "SYP");';
        const values = [customer.id, customer.name, customer.phone, JSON.stringify(customer.balances)];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: addCustomer skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

    public static async updateCustomer(customer: Customer): Promise<void> {
        const stmt = 'UPDATE customers SET name = ?, phone = ?, balances = ? WHERE id = ?;';
        const values = [customer.name, customer.phone, JSON.stringify(customer.balances), customer.id];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: updateCustomer skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }
    
    public static async setCustomers(customers: Customer[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [
            { statement: 'DELETE FROM customers;' },
            ...customers.map(c => ({
                statement: 'INSERT INTO customers (id, name, phone, balances, balance, balanceCurrency) VALUES (?, ?, ?, ?, 0, "SYP");',
                values: [c.id, c.name, c.phone, JSON.stringify(c.balances)]
            }))
        ];
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setCustomers skipped"); }
        });
    }

    // Suppliers
    public static async getSuppliers(): Promise<Supplier[]> {
        return this.execute({
            electron: async () => (await this.dbQuery('SELECT * FROM suppliers;')).map(this.parseParty),
            capacitor: async () => ((await this.getDb().query('SELECT * FROM suppliers;')).values || []).map(this.parseParty),
            web: async () => [],
        });
    }

    public static async addSupplier(supplier: Supplier): Promise<void> {
        // Fix: Explicitly insert 0 and 'SYP' for balance/balanceCurrency
        const stmt = 'INSERT INTO suppliers (id, name, phone, balances, balance, balanceCurrency) VALUES (?, ?, ?, ?, 0, "SYP");';
        const values = [supplier.id, supplier.name, supplier.phone, JSON.stringify(supplier.balances)];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: addSupplier skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

    public static async updateSupplier(supplier: Supplier): Promise<void> {
        const stmt = 'UPDATE suppliers SET name = ?, phone = ?, balances = ? WHERE id = ?;';
        const values = [supplier.name, supplier.phone, JSON.stringify(supplier.balances), supplier.id];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: updateSupplier skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

    public static async setSuppliers(suppliers: Supplier[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [
            { statement: 'DELETE FROM suppliers;' },
            ...suppliers.map(s => ({
                 statement: 'INSERT INTO suppliers (id, name, phone, balances, balance, balanceCurrency) VALUES (?, ?, ?, ?, 0, "SYP");',
                 values: [s.id, s.name, s.phone, JSON.stringify(s.balances)]
             }))
        ];
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setSuppliers skipped"); }
        });
    }
    
    // --- Import Methods ---
    public static async importCustomers(customers: Customer[]): Promise<{ imported: number, skipped: number }> {
        return this.execute({
            electron: async () => {
                const existingIdsRes = await this.dbQuery('SELECT id FROM customers;');
                const existingIds = new Set(existingIdsRes?.map(v => v.id));
                const toImport = customers.filter(c => !existingIds.has(c.id));
                const operations = toImport.map(c => ({
                    statement: 'INSERT INTO customers (id, name, phone, balances, balance, balanceCurrency) VALUES (?, ?, ?, ?, 0, "SYP");',
                    values: [c.id, c.name, c.phone, JSON.stringify(c.balances)]
                }));
                if(operations.length > 0) await this.dbExecuteTransaction(operations);
                return { imported: toImport.length, skipped: customers.length - toImport.length };
            },
            capacitor: async () => {
                const existingIdsRes = await this.getDb().query('SELECT id FROM customers;');
                const existingIds = new Set(existingIdsRes.values?.map(v => v.id));
                let imported = 0, skipped = 0;
                for (const customer of customers) {
                    if (existingIds.has(customer.id)) {
                        skipped++;
                        continue;
                    }
                    await this.addCustomer(customer);
                    imported++;
                }
                return { imported, skipped };
            },
            web: async () => ({ imported: 0, skipped: customers.length })
        });
    }

    public static async importSuppliers(suppliers: Supplier[]): Promise<{ imported: number, skipped: number }> {
        return this.execute({
            electron: async () => {
                const existingIdsRes = await this.dbQuery('SELECT id FROM suppliers;');
                const existingIds = new Set(existingIdsRes?.map(v => v.id));
                const toImport = suppliers.filter(s => !existingIds.has(s.id));
                const operations = toImport.map(s => ({
                    statement: 'INSERT INTO suppliers (id, name, phone, balances, balance, balanceCurrency) VALUES (?, ?, ?, ?, 0, "SYP");',
                    values: [s.id, s.name, s.phone, JSON.stringify(s.balances)]
                }));
                if(operations.length > 0) await this.dbExecuteTransaction(operations);
                return { imported: toImport.length, skipped: suppliers.length - toImport.length };
            },
            capacitor: async () => {
                const existingIdsRes = await this.getDb().query('SELECT id FROM suppliers;');
                const existingIds = new Set(existingIdsRes.values?.map(v => v.id));
                let imported = 0, skipped = 0;
                for (const supplier of suppliers) {
                    if (existingIds.has(supplier.id)) {
                        skipped++;
                        continue;
                    }
                    await this.addSupplier(supplier);
                    imported++;
                }
                return { imported, skipped };
            },
            web: async () => ({ imported: 0, skipped: suppliers.length })
        });
    }
}