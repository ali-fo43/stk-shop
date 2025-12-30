const grid = document.getElementById("hoodiesGrid");
const orderList = document.getElementById("orderList");
const countBadge = document.getElementById("countBadge");
const clearBtn = document.getElementById("clearBtn");
const form = document.getElementById("orderForm");
const submitBtn = document.getElementById("submitBtn");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const totalPriceEl = document.getElementById("totalPrice");
const logoutBtn = document.getElementById("logoutBtn");

// Image modal elements
const imageModal = document.getElementById("imageModal");
const imageModalBackdrop = document.getElementById("imageModalBackdrop");
const imageModalClose = document.getElementById("imageModalClose");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalTitle = document.getElementById("imageModalTitle");

document.getElementById("year").textContent = new Date().getFullYear();

let selected = JSON.parse(localStorage.getItem("staxllc_order_items") || "[]");
let allItems = [];

function toast(title, desc) {
  const el = document.getElementById("toast");
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastDesc").textContent = desc;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone) {
  // Remove all non-digit characters except + and spaces
  const cleanPhone = phone.replace(/[^\d+\-\s()]/g, '');
  
  // Check for valid phone number patterns
  // Accepts formats like: +1234567890, 123-456-7890, (123) 456-7890, +1 234 567 890
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,15}$/;
  
  return phoneRegex.test(cleanPhone) && cleanPhone.replace(/\D/g, '').length >= 10;
}

// Real-time validation
document.getElementById("email").addEventListener("input", function() {
  const email = this.value.trim();
  const isValid = validateEmail(email);
  this.style.borderColor = email && !isValid ? "#ef4444" : email && isValid ? "#10b981" : "";
});

document.getElementById("phone").addEventListener("input", function() {
  const phone = this.value.trim();
  const isValid = validatePhone(phone);
  this.style.borderColor = phone && !isValid ? "#ef4444" : phone && isValid ? "#10b981" : "";
});

// Image modal functions
function openImageModal(imageSrc, imageAlt) {
  imageModalImg.src = imageSrc;
  imageModalImg.alt = imageAlt;
  imageModalTitle.textContent = imageAlt;
  imageModal.classList.add("show");
  imageModal.setAttribute("aria-hidden", "false");
}

function closeImageModal() {
  imageModal.classList.remove("show");
  imageModal.setAttribute("aria-hidden", "true");
}

// Image modal event listeners
imageModalBackdrop.addEventListener("click", closeImageModal);
imageModalClose.addEventListener("click", closeImageModal);

// Close image modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imageModal.classList.contains("show")) {
    closeImageModal();
  }
});

// Make functions globally accessible
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function saveSelected() {
  localStorage.setItem("staxllc_order_items", JSON.stringify(selected));
  renderOrderList();
}

function renderOrderList() {
  const total = selected.reduce((sum, it) => sum + Number(it.price), 0);
  countBadge.textContent = `${selected.length} items`;
  totalPriceEl.textContent = total.toFixed(2);

  if (selected.length === 0) {
    orderList.textContent = "No items yet.";
    return;
  }

  orderList.innerHTML = selected.map((it, idx) => `
    <div class="row" style="padding:8px 0">
      <div>
        <div class="name">${escapeHtml(it.name)}</div>
        <div class="muted">$${Number(it.price).toFixed(2)}</div>
      </div>
      <button class="btn danger" type="button" data-remove="${idx}">Remove</button>
    </div>
  `).join("");

  // bind remove buttons safely
  orderList.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-remove"));
      selected.splice(idx, 1);
      saveSelected();
    });
  });
}

clearBtn.addEventListener("click", () => {
  selected = [];
  saveSelected();
  toast("Cleared", "Order list cleared.");
});

function filterHoodies() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = allItems.filter(h => h.name.toLowerCase().includes(query));
  renderGrid(filtered);
}

searchInput.addEventListener("input", filterHoodies);
searchBtn.addEventListener("click", filterHoodies);

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  toast("Logged out", "You have been logged out.");
  window.location.href = "/login.html";
});

async function loadHoodies() {
  grid.innerHTML = `<div class="muted">Loading...</div>`;
  let res;
  try {
    res = await fetch("/api/hoodies");
  } catch {
    grid.innerHTML = `<div class="muted">Could not reach the server.</div>`;
    return;
  }

  const items = await res.json();
  allItems = items;
  renderGrid(items);
}

function renderGrid(items) {
  if (!Array.isArray(items) || items.length === 0) {
    grid.innerHTML = `<div class="muted">No hoodies available yet.</div>`;
    return;
  }

  grid.innerHTML = items.map(h => `
    <div class="card">
      <img src="${h.imageUrl}" alt="${escapeHtml(h.name)}" onclick="openImageModal('${h.imageUrl}', '${escapeHtml(h.name)}')" style="cursor: pointer;" />
      <div class="card-body">
        <div class="row">
          <div class="name">${escapeHtml(h.name)}</div>
          <div class="price">$${Number(h.price).toFixed(2)}</div>
        </div>

        <div class="row" style="margin-top:10px">
          <div class="muted">In stock</div>
          <button class="btn primary" type="button"
            data-add-id="${h.id}"
            data-add-name="${escapeHtml(h.name)}"
            data-add-price="${Number(h.price)}"
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  `).join("");

  // bind add buttons safely
  grid.querySelectorAll("[data-add-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-add-id"));
      const name = btn.getAttribute("data-add-name");
      const price = Number(btn.getAttribute("data-add-price"));

      selected.push({ id, name, price });
      saveSelected();
      toast("Added", `${name} added to your order.`);
    });
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (selected.length === 0) {
    toast("No items", "Please add at least one hoodie to your order.");
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());

  // Validate required fields
  if (!data.fullName?.trim()) {
    toast("Missing Info", "Please enter your full name.");
    return;
  }

  if (!data.phone?.trim()) {
    toast("Missing Info", "Please enter your phone number.");
    return;
  }

  if (!data.email?.trim()) {
    toast("Missing Info", "Please enter your email address.");
    return;
  }

  if (!data.address?.trim()) {
    toast("Missing Info", "Please enter your address.");
    return;
  }

  // Validate email format
  if (!validateEmail(data.email.trim())) {
    toast("Invalid Email", "Please enter a valid email address.");
    return;
  }

  // Validate phone format
  if (!validatePhone(data.phone.trim())) {
    toast("Invalid Phone", "Please enter a valid phone number (at least 10 digits).");
    return;
  }

  submitBtn.disabled = true;
  const payload = {
    fullName: data.fullName?.trim(),
    phone: data.phone?.trim(),
    email: data.email?.trim(),
    address: data.address?.trim(),
    items: selected,
    notes: (data.notes || "").trim()
  };

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let msg = "";
    try {
      const j = await res.json();
      msg = j?.message || "";
    } catch {}

    if (!res.ok) {
      toast("Order failed", msg || "Please check your fields and try again.");
      submitBtn.disabled = false;
      return;
    }

    selected = [];
    saveSelected();
    form.reset();
    toast("Success", "Order submitted. We will contact you soon.");
    setTimeout(() => window.location.reload(), 2000); // reload after 2 seconds to show the toast
  } catch {
    toast("Network error", "Server not reachable. Try again.");
  } finally {
    submitBtn.disabled = false;
  }
});

renderOrderList();
loadHoodies();
