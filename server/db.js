import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'db.sqlite');
const db = new Database(dbPath);

// Initialize schema if missing
db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photos_product_id ON photos(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
`);

export function testConnection() {
  try {
    db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
    console.log('✓ SQLite DB ready');
  } catch (err) {
    console.error('✗ SQLite init error:', err.message);
  }
}

export function all(sql, params = []) {
  return db.prepare(sql).all(params);
}

export function get(sql, params = []) {
  return db.prepare(sql).get(params);
}

export function run(sql, params = []) {
  return db.prepare(sql).run(params);
}

export default db;
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false }
});

// Test connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✓ Database connected successfully');
    client.release();
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
  }
}
