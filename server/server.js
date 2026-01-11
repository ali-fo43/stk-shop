import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from 'better-sqlite3';

import { requireAuth } from "./middleware.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('stk_shop.db');
db.pragma('journal_mode = WAL');

// Create tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_path TEXT,
    price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const publicDir = path.join(__dirname, "..", "public");

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

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

// serve frontend
app.use(express.static(publicDir));
// serve uploads
app.use('/uploads', express.static(uploadsDir));

// ---------- Multer for photo image upload ----------
// Use memory storage since we'll upload to Supabase Storage
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Only PNG/JPG/WEBP allowed"), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

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
    const stmt = db.prepare("INSERT INTO customers (email, password_hash) VALUES (?, ?)");
    stmt.run(email, hash);
    res.json({ message: "Customer registered successfully" });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ message: "Email already exists" });
    } else {
      res.status(500).json({ message: "Registration failed" });
    }
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
    const stmt = db.prepare("SELECT password_hash FROM customers WHERE email = ?");
    const row = stmt.get(email);
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

// ---------- Photos (public) ----------
app.get("/api/photos", async (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM photos ORDER BY id DESC");
    const rows = stmt.all();
    const photos = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: `/uploads/${row.image_path}`,
      price: row.price,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    res.json(photos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// ---------- Photos (employee/admin) ----------
app.post("/api/photos", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, description, price } = req.body ?? {};
    if (!name || !req.file) return res.status(400).json({ message: "Name and image are required" });

    // Save to local uploads
    const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    const image_path = fileName;

    const stmt = db.prepare("INSERT INTO photos (name, description, image_path, price) VALUES (?, ?, ?, ?)");
    stmt.run(name.trim(), description ? description.trim() : null, image_path, price ? parseFloat(price) : null);

    res.json({ message: "Photo added" });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: "Image too large. Max 5MB allowed." });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: "Invalid image type. Only PNG, JPEG, WebP allowed." });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/api/photos/:id", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const { name, description, price } = req.body ?? {};

    // Load current photo
    const stmt = db.prepare("SELECT * FROM photos WHERE id = ?");
    const current = stmt.get(id);
    if (!current) return res.status(404).json({ message: "Not found" });

    const updates = {};
    if (name && String(name).trim().length > 0) updates.name = String(name).trim();
    if (description !== undefined) updates.description = description ? String(description).trim() : null;
    if (price !== undefined && price !== '') updates.price = parseFloat(price);

    if (req.file) {
      // Save new image locally
      const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);

      updates.image_path = fileName;

      // Delete old image
      if (current.image_path) {
        const oldPath = path.join(uploadsDir, current.image_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    const updateStmt = db.prepare(`UPDATE photos SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    updateStmt.run(...values);

    res.json({ message: "Photo updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.delete("/api/photos/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const stmt = db.prepare("SELECT image_path FROM photos WHERE id = ?");
    const row = stmt.get(id);
    if (!row) return res.status(404).json({ message: "Not found" });

    // Delete image file
    if (row.image_path) {
      const filePath = path.join(uploadsDir, row.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Delete from database
    const deleteStmt = db.prepare("DELETE FROM photos WHERE id = ?");
    deleteStmt.run(id);

    res.json({ message: "Photo deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
