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

import { pool } from "./db.js";
import { requireAuth } from "./middleware.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, "..", "public");

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = express();

app.use(helmet());
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

// serve frontend + uploaded images
app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadsDir));

// ---------- Multer for hoodie image upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
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
    await pool.query(
      "INSERT INTO customers (email, password_hash) VALUES ($1, $2)",
      [email, hash]
    );
    res.json({ message: "Customer registered successfully" });
  } catch (err) {
    if (err.code === '23505') { // PostgreSQL unique violation
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
    const result = await pool.query("SELECT password_hash FROM customers WHERE email = $1", [email]);
    const rows = result.rows;
    if (rows.length === 0) return res.status(401).json({ message: "Customer not found. Please register first." });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
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

// ---------- Hoodies (public) ----------
app.get("/api/hoodies", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM hoodies ORDER BY id DESC");
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "DB error" });
  }
});

// ---------- Hoodies (employee/admin) ----------
app.post("/api/hoodies", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, description, price } = req.body ?? {};
    if (!name || !price || !req.file) return res.status(400).json({ message: "Name, price, and image are required" });

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) return res.status(400).json({ message: "Price must be a positive number" });

    const image_path = `/uploads/${req.file.filename}`;
    await pool.query(
      "INSERT INTO hoodies (name, description, price, image_path) VALUES ($1, $2, $3, $4)",
      [String(name).trim(), description ? String(description).trim() : null, numPrice, image_path]
    );

    res.json({ message: "Hoodie added" });
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

app.patch("/api/hoodies/:id", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const { name, price } = req.body ?? {};

    // Load current hoodie to delete old image if needed
    const result = await pool.query("SELECT * FROM hoodies WHERE id=$1", [id]);
    const rows = result.rows;
    if (!rows.length) return res.status(404).json({ message: "Not found" });

    const current = rows[0];

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name && String(name).trim().length > 0) {
      fields.push(`name=$${paramIndex++}`);
      values.push(String(name).trim());
    }

    if (price !== undefined && price !== "" && !Number.isNaN(Number(price))) {
      fields.push(`price=$${paramIndex++}`);
      values.push(Number(price));
    }

    if (req.file) {
      const newImagePath = `/uploads/${req.file.filename}`;
      fields.push(`image_path=$${paramIndex++}`);
      values.push(newImagePath);

      // Delete old image file
      const oldPath = path.join(uploadsDir, path.basename(current.image_path));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    values.push(id);
    await pool.query(`UPDATE hoodies SET ${fields.join(", ")} WHERE id=$${paramIndex}`, values);

    res.json({ message: "Hoodie updated" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});


app.delete("/api/hoodies/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const result = await pool.query("SELECT image_path FROM hoodies WHERE id=$1", [id]);
    const rows = result.rows;
    if (!rows.length) return res.status(404).json({ message: "Not found" });

    await pool.query("DELETE FROM hoodies WHERE id=$1", [id]);

    const image_path = rows[0].image_path;
    const filePath = path.join(uploadsDir, path.basename(image_path));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: "Hoodie deleted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- Orders (employee/admin) ----------
app.get("/api/orders", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM orders ORDER BY id DESC");
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "DB error" });
  }
});
app.post("/api/orders", async (req, res) => {
  try {
    const { fullName, phone, email, address, items, notes } = req.body ?? {};
    
    // Basic required field validation
    if (!fullName || !phone || !email || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Missing required order data" });
    }

    // Validate email format
    if (!validateEmail(email.trim())) {
      return res.status(400).json({ message: "Invalid email address format" });
    }

    // Validate phone format
    if (!validatePhone(phone.trim())) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    const payloadItems = items.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price
    }));

    const total_price = payloadItems.reduce((sum, i) => sum + Number(i.price), 0);

    const itemsJson = JSON.stringify(payloadItems);

    await pool.query(
      "INSERT INTO orders (full_name, phone, email, address, notes, itemsJson, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [String(fullName).trim(), String(phone).trim(), String(email).trim(), String(address).trim(), notes || '', itemsJson, total_price]
    );

    res.json({ message: "Order received" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/orders/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || isNaN(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const result = await pool.query("DELETE FROM orders WHERE id=$1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order deleted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
