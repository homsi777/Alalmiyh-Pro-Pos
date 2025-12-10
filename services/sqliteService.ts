
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection, CapacitorSQLitePlugin } from '@capacitor-community/sqlite';
import { isCapacitor } from './platform';

class SqliteService {
    private static instance: SqliteService;
    private sqlite: SQLiteConnection;
    private db!: SQLiteDBConnection;
    private readonly dbName = "pos_db";

    private constructor() {
        const sqlitePlugin: CapacitorSQLitePlugin = CapacitorSQLite as any;
        this.sqlite = new SQLiteConnection(sqlitePlugin);
    }

    public static getInstance(): SqliteService {
        if (!SqliteService.instance) {
            SqliteService.instance = new SqliteService();
        }
        return SqliteService.instance;
    }
    
    async initialize() {
        if (!isCapacitor) return;
        try {
            // Check if the connection exists (checking the connection map in the plugin)
            const isConn = (await this.sqlite.isConnection(this.dbName, false)).result;

            if (isConn) {
                // If it exists, retrieve it
                this.db = await this.sqlite.retrieveConnection(this.dbName, false);
            } else {
                // If not, create it
                this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
            }

            // Ensure the DB is actually open
            const isOpen = (await this.db.isDBOpen()).result;
            if (!isOpen) {
                await this.db.open();
            }
            
        } catch (err: any) {
            // Fallback: If createConnection failed claiming it exists (race condition), try retrieve
            const msg = err.message || JSON.stringify(err);
            if (msg.includes('exists')) {
                try {
                    this.db = await this.sqlite.retrieveConnection(this.dbName, false);
                    if (!(await this.db.isDBOpen()).result) {
                        await this.db.open();
                    }
                    return; // Recovered successfully
                } catch (retrieveErr) {
                    console.error("Failed to recover existing connection", retrieveErr);
                    throw retrieveErr;
                }
            }
            console.error("Error initializing SQLite DB", err);
            throw err;
        }
    }

    getDb(): SQLiteDBConnection {
        if (!this.db) {
            throw new Error("Database not initialized. Call initialize() first.");
        }
        return this.db;
    }
    
    async isInitialized(): Promise<boolean> {
        if (!isCapacitor) return false;
        try {
            if(!this.db) return false;
            // Check if the 'users' table exists as an indicator of initialization
            const result = await this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users';");
            return result.values !== undefined && result.values.length > 0;
        } catch (e) {
            return false;
        }
    }
}

export const sqliteService = SqliteService.getInstance();
