const grid = document.getElementById("photosGrid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

// Image modal elements
const imageModal = document.getElementById("imageModal");
const imageModalBackdrop = document.getElementById("imageModalBackdrop");
const imageModalClose = document.getElementById("imageModalClose");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalTitle = document.getElementById("imageModalTitle");

document.getElementById("year").textContent = new Date().getFullYear();

let allItems = [];

function toast(title, desc) {
  const el = document.getElementById("toast");
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastDesc").textContent = desc;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

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

function filterPhotos() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = allItems.filter(p => p.name.toLowerCase().includes(query));
  renderGrid(filtered);
}

searchInput.addEventListener("input", filterPhotos);
searchBtn.addEventListener("click", filterPhotos);

async function loadPhotos() {
  grid.innerHTML = `<div class="muted">Loading...</div>`;
  let res;
  try {
    res = await fetch("/api/photos");
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
    grid.innerHTML = `<div class="muted">No photos available yet.</div>`;
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="card">
      <img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" onclick="openImageModal('${p.imageUrl}', '${escapeHtml(p.name)}')" style="cursor: pointer;" />
      <div class="card-body">
        <div class="name">${escapeHtml(p.name)}</div>
      </div>
    </div>
  `).join("");
}

loadPhotos();
