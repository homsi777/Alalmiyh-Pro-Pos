import { Product, Category, Price } from '../../types';
import { BaseRepository } from './BaseRepository';

export class InventoryRepository extends BaseRepository {

    public static getCreateTableSql(): string {
        return `
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
        );`;
    }

    private static parseProduct(dbProduct: any): Product {
        if (!dbProduct) return null as any;
        return {
            ...dbProduct,
            costPrice: JSON.parse(dbProduct.costPrice),
            wholesalePrice: JSON.parse(dbProduct.wholesalePrice),
            sellingPrice: JSON.parse(dbProduct.sellingPrice),
        };
    }

    public static async getProducts(): Promise<Product[]> {
        return this.execute({
            electron: async () => (await this.dbQuery('SELECT * FROM products;')).map(this.parseProduct),
            capacitor: async () => ((await this.getDb().query('SELECT * FROM products;')).values || []).map(this.parseProduct),
            web: async () => [],
        });
    }
    
    public static async addProduct(product: Product): Promise<void> {
        const { id, name, sku, stock, categoryId, costPrice, wholesalePrice, sellingPrice } = product;
        const stmt = 'INSERT INTO products (id, name, sku, stock, categoryId, costPrice, wholesalePrice, sellingPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?);';
        const values = [id, name, sku, stock, categoryId, JSON.stringify(costPrice), JSON.stringify(wholesalePrice), JSON.stringify(sellingPrice)];
        
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: addProduct skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }
    
    public static async updateProduct(product: Product): Promise<void> {
        const { id, name, sku, stock, categoryId, costPrice, wholesalePrice, sellingPrice } = product;
        const stmt = 'UPDATE products SET name = ?, sku = ?, stock = ?, categoryId = ?, costPrice = ?, wholesalePrice = ?, sellingPrice = ? WHERE id = ?;';
        const values = [name, sku, stock, categoryId, JSON.stringify(costPrice), JSON.stringify(wholesalePrice), JSON.stringify(sellingPrice), id];

        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: updateProduct skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

    public static async updateProductStock(productId: string, newStock: number): Promise<void> {
        await this.execute({
            electron: async () => this.dbRun('UPDATE products SET stock = ? WHERE id = ?;', [newStock, productId]),
            capacitor: async () => {
                const result = await this.getDb().run('UPDATE products SET stock = ? WHERE id = ?;', [newStock, productId]);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: updateProductStock skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

    public static async deleteProduct(productId: string): Promise<void> {
         await this.execute({
            electron: async () => this.dbRun('DELETE FROM products WHERE id = ?;', [productId]),
            capacitor: async () => {
                const result = await this.getDb().run('DELETE FROM products WHERE id = ?;', [productId]);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: deleteProduct skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }
    
    public static async setProducts(products: Product[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [];
        operations.push({ statement: 'DELETE FROM products;' });
        for (const p of products) {
            operations.push({
                statement: 'INSERT INTO products (id, name, sku, stock, categoryId, costPrice, wholesalePrice, sellingPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
                values: [p.id, p.name, p.sku, p.stock, p.categoryId, JSON.stringify(p.costPrice), JSON.stringify(p.wholesalePrice), JSON.stringify(p.sellingPrice)]
            });
        }
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setProducts skipped"); }
        });
    }

    // Categories
    public static async getCategories(): Promise<Category[]> {
         return this.execute({
            electron: async () => this.dbQuery('SELECT * FROM categories;'),
            capacitor: async () => (await this.getDb().query('SELECT * FROM categories;')).values || [],
            web: async () => [],
        });
    }
    
    public static async addCategory(category: Category): Promise<void> {
        const stmt = 'INSERT INTO categories (id, name, parentId) VALUES (?, ?, ?);';
        const values = [category.id, category.name, category.parentId];
        await this.execute({
            electron: async () => this.dbRun(stmt, values),
            capacitor: async () => {
                const result = await this.getDb().run(stmt, values);
                return {
                    changes: result.changes?.changes ?? 0,
                    lastInsertRowid: result.changes?.lastId ?? 0,
                };
            },
            web: async () => { console.warn("Web mode: addCategory skipped"); return { changes: 0, lastInsertRowid: 0 }; }
        });
    }

     public static async setCategories(categories: Category[]): Promise<void> {
        const operations: { statement: string; values?: any[] }[] = [];
        operations.push({ statement: 'DELETE FROM categories;' });
        for (const c of categories) {
            operations.push({
                statement: 'INSERT INTO categories (id, name, parentId) VALUES (?, ?, ?);',
                values: [c.id, c.name, c.parentId]
            });
        }
        await this.execute({
            electron: async () => this.dbExecuteTransaction(operations),
            capacitor: async () => this.getDb().executeTransaction(operations),
            web: async () => { console.warn("Web mode: setCategories skipped"); }
        });
    }
    
    // --- Import Methods ---
    public static async importProducts(products: Product[]): Promise<{ imported: number, skipped: number }> {
        return this.execute({
            electron: async () => {
                const existingIdsRes = await this.dbQuery('SELECT id FROM products;');
                const existingIds = new Set(existingIdsRes?.map(v => v.id));
                const toImport = products.filter(p => !existingIds.has(p.id));
                
                const operations = toImport.map(p => ({
                    statement: 'INSERT INTO products (id, name, sku, stock, categoryId, costPrice, wholesalePrice, sellingPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
                    values: [p.id, p.name, p.sku, p.stock, p.categoryId, JSON.stringify(p.costPrice), JSON.stringify(p.wholesalePrice), JSON.stringify(p.sellingPrice)]
                }));
                if(operations.length > 0) await this.dbExecuteTransaction(operations);
                
                return { imported: toImport.length, skipped: products.length - toImport.length };
            },
            capacitor: async () => {
                const existingIdsRes = await this.getDb().query('SELECT id FROM products;');
                const existingIds = new Set(existingIdsRes.values?.map(v => v.id));
                let imported = 0, skipped = 0;
                for (const product of products) {
                    if (existingIds.has(product.id)) {
                        skipped++;
                        continue;
                    }
                    await this.addProduct(product);
                    imported++;
                }
                return { imported, skipped };
            },
            web: async () => ({ imported: 0, skipped: products.length }),
        });
    }

    public static async importCategories(categories: Category[]): Promise<{ imported: number, skipped: number }> {
        return this.execute({
            electron: async () => {
                const existingIdsRes = await this.dbQuery('SELECT id FROM categories;');
                const existingIds = new Set(existingIdsRes?.map(v => v.id));
                const toImport = categories.filter(c => !existingIds.has(c.id));
                
                const operations = toImport.map(c => ({
                    statement: 'INSERT INTO categories (id, name, parentId) VALUES (?, ?, ?);',
                    values: [c.id, c.name, c.parentId]
                }));
                if(operations.length > 0) await this.dbExecuteTransaction(operations);

                return { imported: toImport.length, skipped: categories.length - toImport.length };
            },
            capacitor: async () => {
                const existingIdsRes = await this.getDb().query('SELECT id FROM categories;');
                const existingIds = new Set(existingIdsRes.values?.map(v => v.id));
                let imported = 0, skipped = 0;
                for (const category of categories) {
                    if (existingIds.has(category.id)) {
                        skipped++;
                        continue;
                    }
                    await this.addCategory(category);
                    imported++;
                }
                return { imported, skipped };
            },
            web: async () => ({ imported: 0, skipped: categories.length }),
        });
    }
}