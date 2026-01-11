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
import { createClient } from '@supabase/supabase-js';

import { pool } from "./db.js";
import { requireAuth } from "./middleware.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

// ---------- Photos (public) ----------
app.get("/api/photos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM photos ORDER BY id DESC");
    const rows = result.rows;
    const photos = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_path,
      price: row.price,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    res.json(photos);
  } catch {
    res.status(500).json({ message: "DB error" });
  }
});

// ---------- Photos (employee/admin) ----------
app.post("/api/photos", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, description, price } = req.body ?? {};
    if (!name || !req.file) return res.status(400).json({ message: "Name and image are required" });

    // Upload to Supabase Storage
    const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ message: "Failed to upload image" });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    const image_path = urlData.publicUrl;

    await pool.query(
      "INSERT INTO photos (name, description, image_path, price) VALUES ($1, $2, $3, $4)",
      [String(name).trim(), description ? String(description).trim() : null, image_path, price ? parseFloat(price) : null]
    );

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

    // Load current photo to delete old image if needed
    const result = await pool.query("SELECT * FROM photos WHERE id=$1", [id]);
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

    if (description !== undefined) {
      fields.push(`description=$${paramIndex++}`);
      values.push(description ? String(description).trim() : null);
    }

    if (price !== undefined && price !== '') {
      fields.push(`price=$${paramIndex++}`);
      values.push(parseFloat(price));
    }

    if (req.file) {
      // Upload new image to Supabase Storage
      const fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data, error } = await supabase.storage
        .from('photos')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ message: "Failed to upload image" });
      }

      // Get public URL for new image
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const newImagePath = urlData.publicUrl;
      fields.push(`image_path=$${paramIndex++}`);
      values.push(newImagePath);

      // Delete old image from Supabase Storage
      if (current.image_path) {
        // Extract filename from URL
        const oldFileName = current.image_path.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('photos')
            .remove([oldFileName]);
        }
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    values.push(id);
    await pool.query(`UPDATE photos SET ${fields.join(", ")} WHERE id=$${paramIndex}`, values);

    res.json({ message: "Photo updated" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});


app.delete("/api/photos/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const result = await pool.query("SELECT image_path FROM photos WHERE id=$1", [id]);
    const rows = result.rows;
    if (!rows.length) return res.status(404).json({ message: "Not found" });

    // Delete from database first
    await pool.query("DELETE FROM photos WHERE id=$1", [id]);

    // Delete image from Supabase Storage
    const image_path = rows[0].image_path;
    if (image_path) {
      // Extract filename from URL
      const fileName = image_path.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('photos')
          .remove([fileName]);
      }
    }

    res.json({ message: "Photo deleted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});



const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
