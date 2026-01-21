import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs/promises';

import { all as dbAll, get as dbGet, run as dbRun, testConnection } from "./db.js";
import { requireAuth } from "./middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const publicDir = path.join(__dirname, "..", "public");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(publicDir));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Validation functions
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone) {
  // Remove all non-digit characters except + and spaces
  const cleanPhone = phone.replace(/[^\d+\-\s()]/g, '');
  
  // Check for valid phone number patterns
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,15}$/;
  
  return phoneRegex.test(cleanPhone) && cleanPhone.replace(/\D/g, '').length >= 10;
}
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120
  })
);

// Test database connection
app.get("/api/test-db", async (req, res) => {
  try {
    const tables = dbAll("SELECT name FROM sqlite_master WHERE type='table'");
    const names = tables.map(t => t.name);
    res.json({ tables: names, photosCount: names.includes('photos') ? 'Table exists' : 'Table missing' });
  } catch (err) {
    console.error("DB test error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Multer for photo image upload ----------
// Use disk storage for local uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.originalname}`);
  }
});

function fileFilter(req, file, cb) {
  const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Only PNG/JPG/WEBP allowed"), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Allow multiple image uploads (up to 10 images)
const uploadMultiple = upload.array('images', 10);

// ---------- Auth ----------
const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd
  };
}

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  // Validate email format
  if (!validateEmail(email.trim())) {
    return res.status(400).json({ message: "Invalid email address format" });
  }

  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    try {
      dbRun("INSERT INTO customers (email, password_hash) VALUES (?, ?)", [email.trim(), hash]);
      res.json({ message: "Customer registered successfully" });
    } catch (err) {
      if (err && err.message && err.message.includes('UNIQUE')) {
        res.status(400).json({ message: "Email already exists" });
      } else {
        console.error(err);
        res.status(500).json({ message: "Registration failed" });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  if (email === process.env.ADMIN_EMAIL) {
    const ok = await bcrypt.compare(password, adminHash);
    if (!ok) return res.status(401).json({ message: "Wrong admin credentials" });
    const token = jwt.sign({ role: "admin", email }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("token", token, cookieOptions());
    return res.json({ message: "Admin logged in" });
  } else {
    // Customer login - check DB
    const row = dbGet("SELECT password_hash FROM customers WHERE email = ?", [email.trim()]);
    if (!row) return res.status(401).json({ message: "Customer not found. Please register first." });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ message: "Wrong password" });

    const token = jwt.sign({ role: "customer", email }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.cookie("token", token, cookieOptions());
    return res.json({ message: "Customer logged in" });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token", cookieOptions());
  res.json({ message: "Logged out" });
});

// ---------- Products (public) ----------
app.get("/api/products", async (req, res) => {
  try {
    // Get all products with their photos using SQLite group_concat
    const rows = dbAll(`
      SELECT p.id, p.name, p.description, p.price, p.created_at, p.updated_at,
             group_concat(ph.image_path, ',') as image_paths,
             group_concat(ph.id, ',') as photo_ids
      FROM products p
      LEFT JOIN photos ph ON p.id = ph.product_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `);

    const products = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      images: row.image_paths ? String(row.image_paths).split(',') : [],
      photoIds: row.photo_ids ? String(row.photo_ids).split(',').map(id => parseInt(id)) : [],
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// ---------- Products (employee/admin) ----------
app.post("/api/products", requireAuth, uploadMultiple, async (req, res) => {
  try {
    console.log("Upload attempt:", { name: req.body?.name, files: req.files ? req.files.length : 0 });
    const { name, description, price } = req.body ?? {};
    if (!name || !req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Name and at least one image are required" });
    }

    // Insert product
    const info = dbRun(
      "INSERT INTO products (name, description, price) VALUES (?, ?, ?)",
      [name.trim(), description ? description.trim() : null, price ? parseFloat(price) : null]
    );

    const productId = info.lastInsertRowid;
    console.log("Product inserted with ID:", productId);

    // Insert photos
    for (let index = 0; index < req.files.length; index++) {
      const file = req.files[index];
      const imagePath = `/uploads/${file.filename}`;
      const isPrimary = index === 0 ? 1 : 0;
      dbRun(
        "INSERT INTO photos (product_id, image_path, is_primary, sort_order) VALUES (?, ?, ?, ?)",
        [productId, imagePath, isPrimary, index]
      );
    }

    res.json({ message: "Product added successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: "Image too large. Max 5MB allowed." });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: "Invalid image type. Only PNG, JPEG, WebP allowed." });
    }
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

app.patch("/api/products/:id", requireAuth, uploadMultiple, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const { name, description, price } = req.body ?? {};

    // Load current product
    const current = dbGet("SELECT * FROM products WHERE id = ?", [id]);
    if (!current) return res.status(404).json({ message: "Product not found" });

    const updates = {};
    if (name && String(name).trim().length > 0) updates.name = String(name).trim();
    if (description !== undefined) updates.description = description ? String(description).trim() : null;
    if (price !== undefined && price !== '') updates.price = parseFloat(price);

    // Update product info
    if (Object.keys(updates).length > 0) {
      const keys = Object.keys(updates);
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
      const values = Object.values(updates);
      values.push(id);
      await pool.query(`UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`, values);
    }

    // Handle new photos if uploaded
    if (req.files && req.files.length > 0) {
      // Get current max sort_order
      const sortRow = dbGet("SELECT MAX(sort_order) as max_sort FROM photos WHERE product_id = ?", [id]);
      let nextSortOrder = (sortRow?.max_sort || 0) + 1;

      // Insert new photos
      for (let index = 0; index < req.files.length; index++) {
        const file = req.files[index];
        const imagePath = `/uploads/${file.filename}`;
        dbRun("INSERT INTO photos (product_id, image_path, is_primary, sort_order) VALUES (?, ?, ?, ?)", [id, imagePath, 0, nextSortOrder + index]);
      }
    }

    res.json({ message: "Product updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});


app.delete("/api/products/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    // Get all photos for this product to delete files
    const photosResult = await pool.query("SELECT image_path FROM photos WHERE product_id = $1", [id]);
    const photos = photosResult.rows;

    // Delete image files
    for (const photo of photos) {
      if (photo.image_path && photo.image_path.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, photo.image_path);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }
    }

    // Delete product (photos will be deleted automatically due to CASCADE)
    const deleteResult = await pool.query("DELETE FROM products WHERE id = $1", [id]);
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// Delete individual photo/image from product
app.delete("/api/products/:id/photos/:photoId", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const photoId = Number(req.params.photoId);
    if (!id || !photoId) return res.status(400).json({ message: "Invalid id or photoId" });

    // Get the photo to delete file
    const photoResult = await pool.query("SELECT image_path FROM photos WHERE id = $1 AND product_id = $2", [photoId, id]);
    const photo = photoResult.rows[0];
    if (!photo) return res.status(404).json({ message: "Photo not found" });

    // Delete image file
    if (photo.image_path && photo.image_path.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, photo.image_path);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error("Error deleting file:", err);
      }
    }

    // Delete photo record
    const deleteResult = await pool.query("DELETE FROM photos WHERE id = $1 AND product_id = $2", [photoId, id]);
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "Photo not found" });
    }

    res.json({ message: "Photo deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});



const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  testConnection();
});
