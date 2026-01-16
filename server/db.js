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
