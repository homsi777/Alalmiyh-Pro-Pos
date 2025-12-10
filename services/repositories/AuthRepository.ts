
import { BaseRepository } from './BaseRepository';
import { User } from '../../types';
import { isElectron, isCapacitor, isWeb } from '../platform';

export class AuthRepository extends BaseRepository {

    public static getCreateTableSql(): string {
        return `
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        );`;
    }

    public static getSeedSql(): { stmt: string, values: any[] } {
        // In a real app, 'admin' password should be a strong hash (e.g., bcrypt)
        return {
            stmt: 'INSERT OR IGNORE INTO users (id, username, password, role) VALUES (?, ?, ?, ?);',
            values: ['u-1', 'admin', 'admin', 'admin']
        };
    }

    public static async login(username: string, password: string): Promise<{ success: boolean, user?: User }> {
        if (isElectron) {
            const result = await this.dbGet('SELECT * FROM users WHERE username = ? AND password = ?;', [username, password]);
            return { success: !!result, user: result };
        }

        if (isCapacitor) {
            const db = this.getDb();
            try {
                const result = await db.query('SELECT * FROM users WHERE username = ?;', [username]);
                const user = result.values?.[0] as User;

                // In a real app, use a library like bcrypt to compare hashes
                if (user && user.password === password) {
                    return { success: true, user };
                }
                return { success: false };
            } catch (error) {
                console.error('Login query failed', error);
                return { success: false };
            }
        }

        // Web fallback
        if (isWeb) {
            console.warn("DB operations disabled on web. Using mock login.");
            if (username.toLowerCase() === 'admin' && password === 'admin') {
                return { success: true, user: { id: 'u-1', username: 'admin', password: '', role: 'admin' } };
            }
        }
        
        return { success: false };
    }

    public static async updateUser(id: string, username: string, password: string): Promise<boolean> {
        const stmt = 'INSERT OR REPLACE INTO users (id, username, password, role) VALUES (?, ?, ?, ?);';
        const values = [id, username, password, 'admin'];

        try {
            await this.execute({
                electron: async () => this.dbRun(stmt, values),
                capacitor: async () => {
                    const res = await this.getDb().run(stmt, values);
                    return { changes: res.changes?.changes ?? 0, lastInsertRowid: 0 };
                },
                web: async () => ({ changes: 1, lastInsertRowid: 0 })
            });
            return true;
        } catch (error) {
            console.error("Failed to update user", error);
            return false;
        }
    }
}