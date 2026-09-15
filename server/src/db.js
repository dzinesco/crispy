import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });

export const db = new Database(config.databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run all migrations in order.
const migrationsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
  db.exec(sql);
}

// Seed admin if no users exist.
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync(config.adminPassword, 10);
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
    .run(config.adminEmail, hash, 'admin');
  console.log(`[db] seeded admin user: ${config.adminEmail}`);
}

export default db;
