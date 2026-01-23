import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize default DB structure
let db = {
  customers: [],
  products: [],
  photos: [],
  _nextProductId: 1,
  _nextPhotoId: 1,
  _nextCustomerId: 1
};

// Load DB from file if it exists
function load() {
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(content);
    } else {
      save();
    }
  } catch (err) {
    console.error('Error loading DB:', err.message);
    save();
  }
}

// Save DB to file
function save() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB:', err.message);
  }
}

export function testConnection() {
  try {
    load();
    console.log('✓ JSON DB ready');
  } catch (err) {
    console.error('✗ JSON DB init error:', err.message);
  }
}

// Query helpers that mimic SQLite interface

export function all(sql, params = []) {
  load();
  
  if (sql.includes('FROM customers')) {
    return db.customers;
  } else if (sql.includes('FROM products')) {
    if (sql.includes('LEFT JOIN photos')) {
      // Get products with photos
      return db.products.map(p => {
        const photos = db.photos.filter(ph => ph.product_id === p.id);
        const image_paths = photos.map(ph => ph.image_path).join(',') || null;
        const photo_ids = photos.map(ph => ph.id).join(',') || null;
        return {
          ...p,
          image_paths,
          photo_ids
        };
      }).reverse();
    }
    return db.products.reverse();
  } else if (sql.includes('FROM photos')) {
    return db.photos;
  } else if (sql.includes('FROM sqlite_master')) {
    return [
      { name: 'customers' },
      { name: 'products' },
      { name: 'photos' }
    ];
  }
  return [];
}

export function get(sql, params = []) {
  load();
  
  if (sql.includes('FROM customers WHERE email')) {
    return db.customers.find(c => c.email === params[0]) || null;
  } else if (sql.includes('FROM products WHERE id')) {
    return db.products.find(p => p.id === params[0]) || null;
  } else if (sql.includes('FROM photos WHERE id')) {
    return db.photos.find(ph => ph.id === params[0] && ph.product_id === params[1]) || null;
  } else if (sql.includes('MAX(sort_order)')) {
    const photos = db.photos.filter(ph => ph.product_id === params[0]);
    const max = photos.length > 0 ? Math.max(...photos.map(ph => ph.sort_order)) : 0;
    return { max_sort: max };
  }
  return null;
}

export function run(sql, params = []) {
  load();
  let changes = 0;
  let lastInsertRowid = null;

  try {
    if (sql.includes('INSERT INTO customers')) {
      const id = db._nextCustomerId++;
      db.customers.push({
        id,
        email: params[0],
        password_hash: params[1],
        created_at: new Date().toISOString()
      });
      changes = 1;
      lastInsertRowid = id;
    } else if (sql.includes('INSERT INTO products')) {
      const id = db._nextProductId++;
      db.products.push({
        id,
        name: params[0],
        description: params[1] || null,
        price: params[2] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      changes = 1;
      lastInsertRowid = id;
    } else if (sql.includes('INSERT INTO photos')) {
      const id = db._nextPhotoId++;
      db.photos.push({
        id,
        product_id: params[0],
        image_path: params[1],
        is_primary: params[2] || 0,
        sort_order: params[3] || 0,
        created_at: new Date().toISOString()
      });
      changes = 1;
      lastInsertRowid = id;
    } else if (sql.includes('UPDATE products')) {
      const product = db.products.find(p => p.id === params[params.length - 1]);
      if (product) {
        if (params[0]) product.name = params[0];
        if (params[1] !== undefined) product.description = params[1];
        if (params[2] !== undefined) product.price = params[2];
        product.updated_at = new Date().toISOString();
        changes = 1;
      }
    } else if (sql.includes('DELETE FROM products WHERE id')) {
      const idx = db.products.findIndex(p => p.id === params[0]);
      if (idx !== -1) {
        db.products.splice(idx, 1);
        db.photos = db.photos.filter(ph => ph.product_id !== params[0]);
        changes = 1;
      }
    } else if (sql.includes('DELETE FROM photos WHERE id')) {
      const idx = db.photos.findIndex(ph => ph.id === params[0] && ph.product_id === params[1]);
      if (idx !== -1) {
        db.photos.splice(idx, 1);
        changes = 1;
      }
    }

    if (changes > 0) {
      save();
    }
  } catch (err) {
    console.error('DB operation error:', err.message);
    if (err.message.includes('UNIQUE') || sql.includes('email') && db.customers.some(c => c.email === params[0])) {
      throw new Error('UNIQUE constraint failed');
    }
    throw err;
  }

  return { changes, lastInsertRowid };
}

// Load on startup
load();
