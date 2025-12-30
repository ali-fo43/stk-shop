const loginPanel = document.getElementById("loginPanel");
const dashPanel = document.getElementById("dashPanel");
const loginForm = document.getElementById("loginForm");
const addForm = document.getElementById("addForm");
const grid = document.getElementById("hoodiesGrid");
const ordersList = document.getElementById("ordersList");
const archivedList = document.getElementById("archivedList");
const archivedContainer = document.getElementById("archivedContainer");
const toggleArchivedBtn = document.getElementById("toggleArchivedBtn");
const logoutBtn = document.getElementById("logoutBtn");
const refreshOrdersBtn = document.getElementById("refreshOrders");

// Modal elements
const editModal = document.getElementById("editModal");
const editCloseBg = document.getElementById("editCloseBg");
const editCloseBtn = document.getElementById("editCloseBtn");
const editForm = document.getElementById("editForm");
const editSaveBtn = document.getElementById("editSaveBtn");
const editId = document.getElementById("editId");
const editName = document.getElementById("editName");
const editPrice = document.getElementById("editPrice");
const editImage = document.getElementById("editImage");
const editHint = document.getElementById("editHint");

// Image modal elements
const imageModal = document.getElementById("imageModal");
const imageModalBackdrop = document.getElementById("imageModalBackdrop");
const imageModalClose = document.getElementById("imageModalClose");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalTitle = document.getElementById("imageModalTitle");

function toast(title, desc) {
  const el = document.getElementById("toast");
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastDesc").textContent = desc;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function openEditModal(hoodie) {
  editId.value = hoodie.id;
  editName.value = hoodie.name;
  editPrice.value = Number(hoodie.price).toFixed(2);
  editImage.value = "";
  editHint.textContent = `Editing: ${hoodie.name}`;
  editModal.classList.add("show");
  editModal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  editModal.classList.remove("show");
  editModal.setAttribute("aria-hidden", "true");
}

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

// Make functions globally accessible
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;

editCloseBg.addEventListener("click", closeEditModal);
editCloseBtn.addEventListener("click", closeEditModal);

// Image modal event listeners
imageModalBackdrop.addEventListener("click", closeImageModal);
imageModalClose.addEventListener("click", closeImageModal);

// Close image modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imageModal.classList.contains("show")) {
    closeImageModal();
  }
});

async function checkAuth() {
  const res = await fetch("/api/auth/me");
  if (res.ok) {
    loginPanel.style.display = "none";
    dashPanel.style.display = "block";
    logoutBtn.style.display = "inline-block";
    loadHoodies();
    loadOrders();
    return true;
  }
  loginPanel.style.display = "block";
  dashPanel.style.display = "none";
  logoutBtn.style.display = "none";
  return false;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(loginForm).entries());

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    toast("Login failed", "Wrong email or password.");
    return;
  }
  toast("Welcome", "Logged in successfully.");
  await checkAuth();
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  toast("Logged out", "You have been logged out.");
  checkAuth();
});

refreshOrdersBtn.addEventListener("click", loadOrders);

toggleArchivedBtn.addEventListener("click", () => {
  const isHidden = archivedContainer.style.display === "none";
  archivedContainer.style.display = isHidden ? "block" : "none";
  toggleArchivedBtn.textContent = isHidden ? "Toggle Archived ▲" : "Toggle Archived ▼";
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(addForm);

  const res = await fetch("/api/hoodies", {
    method: "POST",
    body: fd
  });

  if (!res.ok) {
    toast("Error", "Could not add hoodie. Check image size/type.");
    return;
  }

  addForm.reset();
  toast("Added", "Hoodie added successfully.");
  loadHoodies();
});

async function loadHoodies() {
  grid.innerHTML = `<div class="muted">Loading...</div>`;
  const res = await fetch("/api/hoodies");
  const items = await res.json();

  if (!Array.isArray(items) || items.length === 0) {
    grid.innerHTML = `<div class="muted">No hoodies yet.</div>`;
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

        <div class="row" style="margin-top:12px">
          <button class="btn primary" type="button" data-edit="${h.id}">Edit</button>
          <button class="btn danger" type="button" data-del="${h.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join("");

  // Bind edit/delete buttons safely
  items.forEach(h => {
    const editBtn = grid.querySelector(`[data-edit="${h.id}"]`);
    const delBtn = grid.querySelector(`[data-del="${h.id}"]`);

    editBtn.addEventListener("click", () => openEditModal(h));
    delBtn.addEventListener("click", () => deleteHoodie(h.id));
  });
}

async function loadOrders() {
  ordersList.innerHTML = `<div class="muted">Loading...</div>`;
  const res = await fetch("/api/orders");
  const orders = await res.json();

  if (!Array.isArray(orders) || orders.length === 0) {
    ordersList.innerHTML = `<div class="muted">No orders yet.</div>`;
    return;
  }

  ordersList.innerHTML = orders.map(o => {
    const items = JSON.parse(o.itemsJson);
    const total = items.items.reduce((sum, it) => sum + Number(it.price), 0);
    return `
      <div class="card" data-order-id="${o.id}">
        <div class="card-body">
          <div class="row">
            <div class="name">${escapeHtml(o.fullName)}</div>
            <div class="price">$${total.toFixed(2)}</div>
          </div>
          <div class="muted">${escapeHtml(o.phone)} • ${escapeHtml(o.email)}</div>
          <div class="muted">${escapeHtml(o.address)}</div>
          <div class="small">Items: ${items.items.map(it => escapeHtml(it.name)).join(", ")}</div>
          ${o.notes ? `<div class="small">Notes: ${escapeHtml(o.notes)}</div>` : ""}
          <div class="row" style="margin-top:12px">
            <button class="btn success" type="button" data-deliver="${o.id}">Mark Delivered</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Bind deliver buttons
  ordersList.querySelectorAll("[data-deliver]").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderCard = btn.closest(".card");
      const orderId = orderCard.dataset.orderId;
      
      // Update the card with archived buttons
      orderCard.innerHTML = `
        <div class="card-body">
          ${orderCard.querySelector(".card-body").innerHTML}
          <div class="row" style="margin-top:12px">
            <button class="btn primary" type="button" data-restore="${orderId}">Restore to Orders</button>
            <button class="btn danger" type="button" data-delete="${orderId}">Delete Permanently</button>
          </div>
        </div>
      `;
      
      archivedList.appendChild(orderCard);
      archivedContainer.style.display = "block";
      toggleArchivedBtn.textContent = "Toggle Archived ▲";
      toast("Archived", "Order marked as delivered.");
      
      // Bind new buttons
      bindArchivedButtons();
    });
  });
}

function bindArchivedButtons() {
  // Bind restore buttons
  archivedList.querySelectorAll("[data-restore]").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderCard = btn.closest(".card");
      const orderId = orderCard.dataset.orderId;
      
      // Update the card with deliver button
      const cardBody = orderCard.querySelector(".card-body");
      const originalContent = cardBody.innerHTML.replace(
        /<div class="row" style="margin-top:12px">\s*<button class="btn primary"[^>]*>Restore to Orders<\/button>\s*<button class="btn danger"[^>]*>Delete Permanently<\/button>\s*<\/div>/,
        `<div class="row" style="margin-top:12px">
            <button class="btn success" type="button" data-deliver="${orderId}">Mark Delivered</button>
          </div>`
      );
      
      orderCard.innerHTML = `<div class="card-body">${originalContent}</div>`;
      ordersList.appendChild(orderCard);
      toast("Restored", "Order restored to active orders.");
      
      // Re-bind deliver buttons
      ordersList.querySelectorAll("[data-deliver]").forEach(deliverBtn => {
        deliverBtn.addEventListener("click", () => {
          const card = deliverBtn.closest(".card");
          const id = card.dataset.orderId;
          
          const body = card.querySelector(".card-body");
          body.innerHTML += `
            <div class="row" style="margin-top:12px">
              <button class="btn primary" type="button" data-restore="${id}">Restore to Orders</button>
              <button class="btn danger" type="button" data-delete="${id}">Delete Permanently</button>
            </div>
          `;
          
          archivedList.appendChild(card);
          archivedContainer.style.display = "block";
          toggleArchivedBtn.textContent = "Toggle Archived ▲";
          toast("Archived", "Order marked as delivered.");
          bindArchivedButtons();
        });
      });
    });
  });
  
  // Bind delete buttons
  archivedList.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const orderCard = btn.closest(".card");
      const orderId = orderCard.dataset.orderId;
      
      if (!confirm("Are you sure you want to permanently delete this order?")) return;
      
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        orderCard.remove();
        toast("Deleted", "Order permanently deleted.");
      } else {
        toast("Error", "Failed to delete order.");
      }
    });
  });
}

async function deleteHoodie(id) {
  if (!confirm("Delete this hoodie?")) return;

  const res = await fetch(`/api/hoodies/${id}`, { method: "DELETE" });
  if (!res.ok) {
    toast("Error", "Delete failed.");
    return;
  }
  toast("Deleted", "Hoodie removed.");
  loadHoodies();
}

// Save from the modal (supports optional new image)
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = editId.value;
  const fd = new FormData();
  fd.append("name", editName.value);
  fd.append("price", editPrice.value);

  if (editImage.files && editImage.files[0]) {
    fd.append("image", editImage.files[0]);
  }

  editSaveBtn.disabled = true;

  const res = await fetch(`/api/hoodies/${id}`, {
    method: "PATCH",
    body: fd
  });

  editSaveBtn.disabled = false;

  if (!res.ok) {
    toast("Error", "Update failed. Check fields and try again.");
    return;
  }

  toast("Updated", "Hoodie updated successfully.");
  closeEditModal();
  loadHoodies();
});

checkAuth();
