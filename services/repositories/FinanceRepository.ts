import { ExpenseCategory, Expense, CashRegister, CashTransaction, Currency, CashTransactionType, Price } from '../../types';
import { BaseRepository } from './BaseRepository';
import { SettingsRepository } from './SettingsRepository';
import { LedgerRepository } from './LedgerRepository';

export class FinanceRepository extends BaseRepository {

    public static getCreateTableSql(): string {
        return `
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
            linkedInvoiceId TEXT,
            FOREIGN KEY (registerId) REFERENCES cash_registers(id)
        );`;
    }

    public static getSeedSql(): { stmt: string, values: any[] } {
        const defaultBalances = JSON.stringify({ [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 });
        return {
            stmt: 'INSERT OR IGNORE INTO cash_registers (id, name, balances) VALUES (?, ?, ?);',
            values: ['cr-1', 'الصندوق الرئيسي', defaultBalances]
        };
    }

    private static parseRegister(dbRegister: any): CashRegister {
        if (!dbRegister) return null as any;
        return { ...dbRegister, balances: JSON.parse(dbRegister.balances) };
    }

    // Expense Categories
    public static async getExpenseCategories(): Promise<ExpenseCategory[]> {
        return this.execute({
            electron: async () => this.dbQuery('SELECT * FROM expense_categories;'),
            capacitor: async () => (await this.getDb().query('SELECT * FROM expense_categories;')).values || [],
            web: async () => [],
        });
    }
    public static async addExpenseCategory(category: ExpenseCategory): Promise<void> {
        const stmt = 'INSERT INTO expense_categories (id, name) VALUES (?, ?);';
        const values = [category.id, category.name];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: addExpenseCategory skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }
     public static async setExpenseCategories(categories: ExpenseCategory[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [
            { statement: 'DELETE FROM expense_categories;' },
            ...categories.map(c => ({ statement: 'INSERT INTO expense_categories (id, name) VALUES (?, ?);', values: [c.id, c.name] }))
        ];
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setExpenseCategories skipped"); }
        });
    }

    // Expenses
    public static async getExpenses(): Promise<Expense[]> {
        return this.execute({
            electron: async () => this.dbQuery('SELECT * FROM expenses;'),
            capacitor: async () => (await this.getDb().query('SELECT * FROM expenses;')).values || [],
            web: async () => [],
        });
    }
     public static async setExpenses(expenses: Expense[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [
            { statement: 'DELETE FROM expenses;' },
            ...expenses.map(e => ({
                 statement: 'INSERT INTO expenses (id, date, description, categoryId, cashRegisterId, amount, currency, amountInSyp) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
                 values: [e.id, e.date, e.description, e.categoryId, e.cashRegisterId, e.amount, e.currency, e.amountInSyp]
             }))
        ];
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setExpenses skipped"); }
        });
    }

    public static async recordExpense(expense: Expense): Promise<void> {
        const newTransaction: Omit<CashTransaction, 'id'> = {
            date: expense.date,
            registerId: expense.cashRegisterId,
            type: CashTransactionType.Expense,
            amount: expense.amount,
            currency: expense.currency,
            amountInSyp: expense.amountInSyp,
            description: expense.description,
            relatedId: expense.id
        };

        await this.execute({
            electron: async () => {
                const register = await this.dbGet('SELECT balances FROM cash_registers WHERE id = ?;', [expense.cashRegisterId]);
                const balances = JSON.parse(register.balances);
                balances[expense.currency] -= expense.amount;

                const operations = [
                    { statement: 'INSERT INTO expenses (id, date, description, categoryId, cashRegisterId, amount, currency, amountInSyp) VALUES (?, ?, ?, ?, ?, ?, ?, ?);', values: [expense.id, expense.date, expense.description, expense.categoryId, expense.cashRegisterId, expense.amount, expense.currency, expense.amountInSyp] },
                    { statement: 'UPDATE cash_registers SET balances = ? WHERE id = ?;', values: [JSON.stringify(balances), expense.cashRegisterId] },
                    { statement: 'INSERT INTO cash_transactions (id, date, registerId, type, amount, currency, amountInSyp, description, relatedId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);', values: [`ct-${Date.now()}`, newTransaction.date, newTransaction.registerId, newTransaction.type, newTransaction.amount, newTransaction.currency, newTransaction.amountInSyp, newTransaction.description, newTransaction.relatedId] }
                ];
                await this.dbExecuteTransaction(operations);
            },
            capacitor: async () => {
                try {
                    await this.getDb().beginTransaction();
                    const res = await this.getDb().query('SELECT balances FROM cash_registers WHERE id = ?;', [expense.cashRegisterId]);
                    const balances = JSON.parse(res.values![0].balances);
                    balances[expense.currency] -= expense.amount;

                    await this.getDb().run('INSERT INTO expenses (id, date, description, categoryId, cashRegisterId, amount, currency, amountInSyp) VALUES (?, ?, ?, ?, ?, ?, ?, ?);', [expense.id, expense.date, expense.description, expense.categoryId, expense.cashRegisterId, expense.amount, expense.currency, expense.amountInSyp]);
                    await this.getDb().run('UPDATE cash_registers SET balances = ? WHERE id = ?;', [JSON.stringify(balances), expense.cashRegisterId]);
                    await this.addCashTransaction(newTransaction);
                    await this.getDb().commitTransaction();
                } catch (err) {
                    await this.getDb().rollbackTransaction();
                    throw err;
                }
            },
            web: async () => { console.warn("Web mode: recordExpense skipped"); }
        });
    }

    // Cash Registers
    public static async getCashRegisters(): Promise<CashRegister[]> {
        return this.execute({
            electron: async () => (await this.dbQuery('SELECT * FROM cash_registers;')).map(this.parseRegister),
            capacitor: async () => ((await this.getDb().query('SELECT * FROM cash_registers;')).values || []).map(this.parseRegister),
            web: async () => [],
        });
    }
    public static async addCashRegister(register: CashRegister): Promise<void> {
        const stmt = 'INSERT INTO cash_registers (id, name, balances) VALUES (?, ?, ?);';
        const values = [register.id, register.name, JSON.stringify(register.balances)];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: addCashRegister skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }
    public static async setCashRegisters(registers: CashRegister[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [
            { statement: 'DELETE FROM cash_registers;' },
            ...registers.map(r => ({
                 statement: 'INSERT INTO cash_registers (id, name, balances) VALUES (?, ?, ?);',
                 values: [r.id, r.name, JSON.stringify(r.balances)]
             }))
        ];
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setCashRegisters skipped"); }
        });
    }

    // Cash Transactions
    public static async getCashTransactions(): Promise<CashTransaction[]> {
        return this.execute({
            electron: async () => this.dbQuery('SELECT * FROM cash_transactions;'),
            capacitor: async () => (await this.getDb().query('SELECT * FROM cash_transactions;')).values || [],
            web: async () => [],
        });
    }
    public static async setCashTransactions(transactions: CashTransaction[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [
            { statement: 'DELETE FROM cash_transactions;' },
            ...transactions.map(t => ({
                statement: 'INSERT INTO cash_transactions (id, date, registerId, type, amount, currency, amountInSyp, description, relatedId, linkedInvoiceId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
                values: [t.id, t.date, t.registerId, t.type, t.amount, t.currency, t.amountInSyp, t.description, t.relatedId, (t as any).linkedInvoiceId || null]
            }))
        ];
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setCashTransactions skipped"); }
        });
    }
    
    public static async addCashTransaction(transaction: Omit<CashTransaction, 'id'> & { linkedInvoiceId?: string }): Promise<void> {
        const fullTransaction = { id: `ct-${Date.now()}-${Math.random()}`, ...transaction };
        const stmt = 'INSERT INTO cash_transactions (id, date, registerId, type, amount, currency, amountInSyp, description, relatedId, linkedInvoiceId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
        const values = [fullTransaction.id, fullTransaction.date, fullTransaction.registerId, fullTransaction.type, fullTransaction.amount, fullTransaction.currency, fullTransaction.amountInSyp, fullTransaction.description, fullTransaction.relatedId, transaction.linkedInvoiceId || null];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: addCashTransaction skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

    // Complex Operations
    public static async transferFunds(fromId: string, toId: string, amount: number, currency: Currency): Promise<void> {
        const rates = await SettingsRepository.getExchangeRates();
        if (!rates) throw new Error("Rates not found");
        const convertToSyp = (price: Price): number => {
            if (price.currency === Currency.SYP) return price.amount;
            if (price.currency === Currency.USD) return price.amount * rates.USD;
            if (price.currency === Currency.TRY) return price.amount * rates.TRY;
            return price.amount;
        };
        const amountInSyp = convertToSyp({ amount, currency });

        await this.execute({
            electron: async () => {
                const fromRegister = this.parseRegister(await this.dbGet('SELECT * FROM cash_registers WHERE id = ?;', [fromId]));
                const toRegister = this.parseRegister(await this.dbGet('SELECT * FROM cash_registers WHERE id = ?;', [toId]));
                
                fromRegister.balances[currency] -= amount;
                toRegister.balances[currency] += amount;
                const date = new Date().toISOString();

                const operations = [
                    { statement: 'UPDATE cash_registers SET balances = ? WHERE id = ?;', values: [JSON.stringify(fromRegister.balances), fromId] },
                    { statement: 'UPDATE cash_registers SET balances = ? WHERE id = ?;', values: [JSON.stringify(toRegister.balances), toId] },
                    { statement: 'INSERT INTO cash_transactions (id, date, registerId, type, amount, currency, amountInSyp, description, relatedId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);', values: [`ct-${Date.now()}-1`, date, fromId, CashTransactionType.TransferOut, amount, currency, amountInSyp, `تحويل إلى ${toRegister.name}`, null] },
                    { statement: 'INSERT INTO cash_transactions (id, date, registerId, type, amount, currency, amountInSyp, description, relatedId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);', values: [`ct-${Date.now()}-2`, date, toId, CashTransactionType.TransferIn, amount, currency, amountInSyp, `تحويل من ${fromRegister.name}`, null] }
                ];
                await this.dbExecuteTransaction(operations);
            },
            capacitor: async () => {
                try {
                    await this.getDb().beginTransaction();
                    const fromRes = await this.getDb().query('SELECT * FROM cash_registers WHERE id = ?;', [fromId]);
                    const fromRegister = this.parseRegister(fromRes.values![0]);
                    const toRes = await this.getDb().query('SELECT * FROM cash_registers WHERE id = ?;', [toId]);
                    const toRegister = this.parseRegister(toRes.values![0]);

                    fromRegister.balances[currency] -= amount;
                    toRegister.balances[currency] += amount;

                    await this.getDb().run('UPDATE cash_registers SET balances = ? WHERE id = ?;', [JSON.stringify(fromRegister.balances), fromId]);
                    await this.getDb().run('UPDATE cash_registers SET balances = ? WHERE id = ?;', [JSON.stringify(toRegister.balances), toId]);
                    
                    const date = new Date().toISOString();
                    await this.addCashTransaction({ date, registerId: fromId, type: CashTransactionType.TransferOut, amount, currency, amountInSyp, description: `تحويل إلى ${toRegister.name}` });
                    await this.addCashTransaction({ date, registerId: toId, type: CashTransactionType.TransferIn, amount, currency, amountInSyp, description: `تحويل من ${fromRegister.name}` });
                    
                    await this.getDb().commitTransaction();
                } catch(err) {
                    await this.getDb().rollbackTransaction();
                    throw err;
                }
            },
            web: async () => { console.warn("Web mode: transferFunds skipped"); }
        });
    }

    public static async recordMovement(registerId: string, type: 'deposit' | 'withdrawal', amount: number, currency: Currency, description: string): Promise<void> {
         const rates = await SettingsRepository.getExchangeRates();
        if (!rates) throw new Error("Rates not found");
        
        const convertToSyp = (price: Price): number => {
            if (price.currency === Currency.SYP) return price.amount;
            if (price.currency === Currency.USD) return price.amount * rates.USD;
            if (price.currency === Currency.TRY) return price.amount * rates.TRY;
            return price.amount;
        };
        const amountInSyp = convertToSyp({ amount, currency });
        
        await this.execute({
            electron: async () => {
                const register = this.parseRegister(await this.dbGet('SELECT * FROM cash_registers WHERE id = ?;', [registerId]));
                if (type === 'deposit') register.balances[currency] += amount;
                else register.balances[currency] -= amount;

                const transactionType = type === 'deposit' ? CashTransactionType.Deposit : CashTransactionType.Withdrawal;
                const operations = [
                    { statement: 'UPDATE cash_registers SET balances = ? WHERE id = ?;', values: [JSON.stringify(register.balances), registerId] },
                    { statement: 'INSERT INTO cash_transactions (id, date, registerId, type, amount, currency, amountInSyp, description, relatedId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);', values: [`ct-${Date.now()}`, new Date().toISOString(), registerId, transactionType, amount, currency, amountInSyp, description, null] }
                ];
                await this.dbExecuteTransaction(operations);
            },
            capacitor: async () => {
                try {
                    await this.getDb().beginTransaction();
                    const res = await this.getDb().query('SELECT * FROM cash_registers WHERE id = ?;', [registerId]);
                    const register = this.parseRegister(res.values![0]);

                    if (type === 'deposit') register.balances[currency] += amount;
                    else register.balances[currency] -= amount;

                    await this.getDb().run('UPDATE cash_registers SET balances = ? WHERE id = ?;', [JSON.stringify(register.balances), registerId]);
                    await this.addCashTransaction({ date: new Date().toISOString(), registerId, type: type === 'deposit' ? CashTransactionType.Deposit : CashTransactionType.Withdrawal, amount, currency, amountInSyp, description });
                    await this.getDb().commitTransaction();
                } catch(err) {
                    await this.getDb().rollbackTransaction();
                    throw err;
                }
            },
            web: async () => { console.warn("Web mode: recordMovement skipped"); }
        });
    }

    public static async recordPayment(
        type: 'received' | 'made',
        partyId: string,
        registerId: string,
        amount: number,
        currency: Currency,
        invoiceId?: string // Optional Invoice ID for linking
    ): Promise<void> {
        const rates = await SettingsRepository.getExchangeRates();
        if (!rates) throw new Error("Rates not found");
        const convertToSyp = (price: Price): number => {
            if (price.currency === Currency.SYP) return price.amount;
            if (price.currency === Currency.USD) return price.amount * rates.USD;
            if (price.currency === Currency.TRY) return price.amount * rates.TRY;
            return price.amount;
        };
        const amountInSyp = convertToSyp({ amount, currency });

        const updateLogic = async (
            getFn: (sql: string, params?: any[]) => Promise<any>,
            runOperations: (ops: { statement: string, values?: any[] }[]) => Promise<void>
        ) => {
             const isReceived = type === 'received';
             const partyTable = isReceived ? 'customers' : 'suppliers';
             
             // Fetch Party
             const partyRes = await getFn(`SELECT name, balances, balance, balanceCurrency FROM ${partyTable} WHERE id = ?;`, [partyId]);
             if (!partyRes) throw new Error('Party not found');
             
             // Parse party balances
             let partyBalances: Record<Currency, number> = { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 };
             if (partyRes.balances) {
                 partyBalances = { ...partyBalances, ...JSON.parse(partyRes.balances) };
             } else if (partyRes.balance !== undefined) {
                 partyBalances[partyRes.balanceCurrency as Currency] = partyRes.balance;
             }

             // Update party balance
             partyBalances[currency] = (partyBalances[currency] || 0) - amount;

             // Fetch Register
             const registerRes = await getFn('SELECT * FROM cash_registers WHERE id = ?;', [registerId]);
             if (!registerRes) throw new Error('Register not found');
             const registerBalances = JSON.parse(registerRes.balances);
             registerBalances[currency] = (registerBalances[currency] || 0) + (isReceived ? amount : -amount);

             const transactionType = isReceived ? CashTransactionType.PaymentReceived : CashTransactionType.PaymentMade;
             const description = isReceived ? `دفعة من العميل: ${partyRes.name}` : `دفعة إلى المورد: ${partyRes.name}`;
             
             // Include linkedInvoiceId in the INSERT statement
             const operations = [
                 { statement: `UPDATE ${partyTable} SET balances = ? WHERE id = ?;`, values: [JSON.stringify(partyBalances), partyId] },
                 { statement: 'UPDATE cash_registers SET balances = ? WHERE id = ?;', values: [JSON.stringify(registerBalances), registerId] },
                 { statement: 'INSERT INTO cash_transactions (id, date, registerId, type, amount, currency, amountInSyp, description, relatedId, linkedInvoiceId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', values: [`ct-${Date.now()}`, new Date().toISOString(), registerId, transactionType, amount, currency, amountInSyp, description, partyId, invoiceId || null] }
             ];
             
             await runOperations(operations);
        };

        await this.execute({
            electron: async () => {
                await updateLogic(
                    (sql, params) => this.dbGet(sql, params),
                    (ops) => this.dbExecuteTransaction(ops)
                );
            },
            capacitor: async () => {
                try {
                    await this.getDb().beginTransaction();
                    await updateLogic(
                        async (sql, params) => (await this.getDb().query(sql, params)).values?.[0],
                        async (ops) => {
                             for (const op of ops) {
                                 await this.getDb().run(op.statement, op.values);
                             }
                        }
                    );
                    await this.getDb().commitTransaction();
                } catch(err) {
                    await this.getDb().rollbackTransaction();
                    throw err;
                }
            },
            web: async () => { console.warn("Web mode: recordPayment skipped"); }
        });
    }

    // --- Import Methods ---
    public static async importExpenseCategories(categories: ExpenseCategory[]): Promise<{ imported: number; skipped: number }> {
         return { imported: 0, skipped: 0 };
    }

    public static async importExpenses(expenses: Expense[]): Promise<{ imported: number; skipped: number }> {
         return { imported: 0, skipped: 0 };
    }
}