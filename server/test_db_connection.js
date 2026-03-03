import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM hard_assets');
    console.log('Database connected! hard_assets count:', res.rows[0].count);
    const soft = await pool.query('SELECT COUNT(*) FROM soft_assets');
    console.log('soft_assets count:', soft.rows[0].count);
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await pool.end();
  }
}

test();
