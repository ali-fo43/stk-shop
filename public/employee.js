const loginPanel = document.getElementById("loginPanel");
const dashPanel = document.getElementById("dashPanel");
const loginForm = document.getElementById("loginForm");
const addForm = document.getElementById("addForm");
const grid = document.getElementById("photosGrid");
const logoutBtn = document.getElementById("logoutBtn");

// Modal elements
const editModal = document.getElementById("editModal");
const editCloseBg = document.getElementById("editCloseBg");
const editCloseBtn = document.getElementById("editCloseBtn");
const editForm = document.getElementById("editForm");
const editSaveBtn = document.getElementById("editSaveBtn");
const editId = document.getElementById("editId");
const editName = document.getElementById("editName");
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

function openEditModal(photo) {
  editId.value = photo.id;
  editName.value = photo.name;
  editImage.value = "";
  editHint.textContent = `Editing: ${photo.name}`;
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
    loadPhotos();
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

  const res = await fetch("/api/photos", {
    method: "POST",
    body: fd
  });

  if (!res.ok) {
    toast("Error", "Could not add photo. Check image size/type.");
    return;
  }

  addForm.reset();
  toast("Added", "Photo added successfully.");
  loadPhotos();
});

async function loadPhotos() {
  grid.innerHTML = `<div class="muted">Loading...</div>`;
  const res = await fetch("/api/photos");
  const items = await res.json();

  if (!Array.isArray(items) || items.length === 0) {
    grid.innerHTML = `<div class="muted">No photos yet.</div>`;
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="card">
      <img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" onclick="openImageModal('${p.imageUrl}', '${escapeHtml(p.name)}')" style="cursor: pointer;" />
      <div class="card-body">
        <div class="name">${escapeHtml(p.name)}</div>

        <div class="row" style="margin-top:12px">
          <button class="btn primary" type="button" data-edit="${p.id}">Edit</button>
          <button class="btn danger" type="button" data-del="${p.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join("");

  // Bind edit/delete buttons safely
  items.forEach(p => {
    const editBtn = grid.querySelector(`[data-edit="${p.id}"]`);
    const delBtn = grid.querySelector(`[data-del="${p.id}"]`);

    editBtn.addEventListener("click", () => openEditModal(p));
    delBtn.addEventListener("click", () => deletePhoto(p.id));
  });
}



async function deletePhoto(id) {
  if (!confirm("Delete this photo?")) return;

  const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    toast("Error", "Delete failed.");
    return;
  }
  toast("Deleted", "Photo removed.");
  loadPhotos();
}

// Save from the modal (supports optional new image)
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = editId.value;
  const fd = new FormData();
  fd.append("name", editName.value);

  if (editImage.files && editImage.files[0]) {
    fd.append("image", editImage.files[0]);
  }

  editSaveBtn.disabled = true;

  const res = await fetch(`/api/photos/${id}`, {
    method: "PATCH",
    body: fd
  });

  editSaveBtn.disabled = false;

  if (!res.ok) {
    toast("Error", "Update failed. Check fields and try again.");
    return;
  }

  toast("Updated", "Photo updated successfully.");
  closeEditModal();
  loadPhotos();
});

checkAuth();
