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
  imageModalImg.classList.remove('zoomed');
  imageModalTitle.textContent = imageAlt;
  imageModal.classList.add("show");
  imageModal.setAttribute("aria-hidden", "false");
}

function closeImageModal() {
  imageModal.classList.remove("show");
  imageModal.setAttribute("aria-hidden", "true");
  imageModalImg.classList.remove('zoomed');
}

// Image zoom toggle
imageModalImg.addEventListener('click', (e) => {
  e.stopPropagation();
  imageModalImg.classList.toggle('zoomed');
});

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
window.navigateGallery = navigateGallery;
window.goToImage = goToImage;

function navigateGallery(button, direction) {
  const gallery = button.closest('.image-gallery');
  const container = gallery.querySelector('.image-container');
  const images = container.querySelectorAll('img');
  const dots = gallery.querySelectorAll('.dot');

  let currentIndex = Array.from(dots).findIndex(dot => dot.classList.contains('active'));
  currentIndex = (currentIndex + direction + images.length) % images.length;

  container.style.transform = `translateX(-${currentIndex * 100}%)`;

  // Update dots
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentIndex);
    dot.style.background = index === currentIndex ? 'white' : 'rgba(255,255,255,0.5)';
  });
}

function goToImage(dot, index) {
  const gallery = dot.closest('.image-gallery');
  const container = gallery.querySelector('.image-container');
  const dots = gallery.querySelectorAll('.dot');

  container.style.transform = `translateX(-${index * 100}%)`;

  // Update dots
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === index);
    d.style.background = i === index ? 'white' : 'rgba(255,255,255,0.5)';
  });
}

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
    res = await fetch("/api/products");
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
    grid.innerHTML = `<div class="muted">No products available yet.</div>`;
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="card">
      <div class="image-gallery" style="position: relative; overflow: hidden; height: 200px;">
        <div class="image-container" style="display: flex; height: 100%; transition: transform 0.3s ease;">
          ${p.images.map((img, index) => `
            <img src="${img}" alt="${escapeHtml(p.name)} - Image ${index + 1}"
                 style="min-width: 100%; height: 100%; object-fit: cover; flex-shrink: 0;"
                 onclick="openImageModal('${img}', '${escapeHtml(p.name)}')" />
          `).join('')}
        </div>
        ${p.images.length > 1 ? `
          <button class="gallery-nav prev" onclick="navigateGallery(this, -1)" style="position: absolute; left: 5px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; padding: 8px; cursor: pointer; border-radius: 50%;">&larr;</button>
          <button class="gallery-nav next" onclick="navigateGallery(this, 1)" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; padding: 8px; cursor: pointer; border-radius: 50%;">&rarr;</button>
          <div class="gallery-dots" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px;">
            ${p.images.map((_, index) => `<span class="dot ${index === 0 ? 'active' : ''}" onclick="goToImage(this, ${index})" style="width: 8px; height: 8px; border-radius: 50%; background: ${index === 0 ? 'white' : 'rgba(255,255,255,0.5)'}; cursor: pointer;"></span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="card-body">
        <div class="name">${escapeHtml(p.name)}</div>
        ${p.description ? `<div class="desc">${escapeHtml(p.description)}</div>` : ''}
        ${p.price ? `<div class="price">$${parseFloat(p.price).toFixed(2)}</div>` : ''}
      </div>
    </div>
  `).join("");
}

loadPhotos();
