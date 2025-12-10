import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { sqliteService } from '../sqliteService';
import { isElectron, isCapacitor } from '../platform';

export abstract class BaseRepository {
    // ---- Capacitor Specific ----
    protected static getDb(): SQLiteDBConnection {
        return sqliteService.getDb();
    }

    // ---- Electron Specific (via IPC) ----
    protected static dbQuery(sql: string, params?: any[]): Promise<any[]> {
        return window.electronAPI!.query(sql, params);
    }
    protected static dbRun(sql: string, params?: any[]): Promise<{ changes: number, lastInsertRowid: number }> {
        return window.electronAPI!.run(sql, params);
    }
    protected static dbGet(sql: string, params?: any[]): Promise<any> {
        return window.electronAPI!.get(sql, params);
    }
    protected static dbExecuteTransaction(operations: { statement: string; values?: any[] }[]): Promise<any> {
        return window.electronAPI!.executeTransaction(operations);
    }

    // ---- Platform-agnostic helpers ----
    protected static async execute<T>(logic: {
        electron: () => Promise<T>,
        capacitor: () => Promise<T>,
        web: () => Promise<T>,
    }): Promise<T> {
        if (isElectron) {
            return logic.electron();
        }
        if (isCapacitor) {
            // Do not swallow errors. Let them propagate to be handled by the UI.
            return logic.capacitor();
        }
        // Fallback to web mock only if not on Electron or Capacitor
        return logic.web();
    }
}
