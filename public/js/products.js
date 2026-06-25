// ============================================================
// products.js — New Arrivals, Product Rendering, Modal, Gallery
// ============================================================

async function loadFeaturedProducts() {
  try {
    const res = await fetch("/new-arrivals");
    const products = await res.json();

    const container = document.getElementById("featured-products");
    if (!container) return;

    container.innerHTML = "";

    const params = new URLSearchParams(window.location.search);
    const categoryFilter = params.get("category");

    let filteredProducts = products;

    if (categoryFilter) {
      filteredProducts = products.filter(product => {
        const category = (
          product.category ||
          product.type ||
          product.collection ||
          ""
        ).toLowerCase();
        return category.includes(categoryFilter.toLowerCase());
      });
    }

    filteredProducts.slice(0, 4).forEach(product => {
      const card = document.createElement("div");
card.className = "bg-neutral-900 rounded-2xl overflow-hidden border border-white/10";
card.innerHTML = `
  <img src="${product.images?.[0] || ""}" alt="${product.name}" loading="lazy" class="w-full h-72 object-cover">
  <div class="p-4">
    <h3 class="font-bold">${product.name}</h3>
    <p class="text-orange-400 font-bold mt-1">$${product.price}</p>
  </div>
`;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

function openCartOptions(product) {
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4";

  modal.innerHTML = `
    <div class="bg-neutral-900 border border-orange-500/40 rounded-2xl p-6 w-full max-w-sm mx-auto relative">
      <button onclick="this.closest('.fixed').remove()" class="absolute top-3 right-4 text-white text-2xl font-bold">×</button>
      <h2 class="text-2xl font-black mb-2">${product.name}</h2>
      <p class="text-gray-400 mb-5">$${product.price}</p>
      <label class="block text-sm text-gray-400 mb-2">Size</label>
      <select id="cart-size" class="w-full mb-4 p-3 rounded-xl bg-black border border-white/10 text-white">
        <option value="">Select Size</option>
        ${(product.sizes || []).map(size => `<option>${size}</option>`).join("")}
      </select>
      <label class="block text-sm text-gray-400 mb-2">Color</label>
      <select id="cart-color" class="w-full mb-5 p-3 rounded-xl bg-black border border-white/10 text-white">
        <option value="">Select Color</option>
        ${(product.colors || []).map(color => `<option>${color}</option>`).join("")}
      </select>
      <button
        onclick="confirmCartOptions('${product.name}', ${product.price}, this)"
        class="bg-orange-500 w-full py-3 rounded-xl text-black font-bold">
        Add to Cart
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

function openModal(name, price, image, hasVariants = false, productType = "") {
  document.getElementById("modal-img").src = image;
  document.getElementById("modal-title").textContent = name;
  document.getElementById("modal-price").textContent = "$" + price;

  const variantWrap = document.getElementById("modal-variant-wrap");
  const sizeSelect = document.getElementById("modal-size");
  const colorSelect = document.getElementById("modal-color");
  const modalCopy = document.getElementById("modal-copy");

  variantWrap.classList.add("hidden");
  sizeSelect.innerHTML = "";
  colorSelect.innerHTML = "";

  if (name.includes("Hoodie")) {
    modalCopy.textContent = "Heavyweight streetwear layer built for bold faith expression.";
  } else if (name.includes("Hat")) {
    modalCopy.textContent = "Clean finishing piece built to complete the look.";
  } else {
    modalCopy.textContent = "Statement piece built with message, movement, and purpose.";
  }

  const sizeOptions = `
    <option>Small</option>
    <option>Medium</option>
    <option>Large</option>
    <option>XL</option>
    <option>2XL</option>
  `;

  const colorMap = {
    "tee-cave": ["Black", "Stone", "Forest Green"],
    "tee-kingdom": ["White", "Black", "Cream"],
    "tee-taking": ["Black", "Vintage Black", "Sand"],
    "tee-didntask": ["Black", "Charcoal", "White"],
    hoodie: ["Black", "White", "Gray"],
    hat: ["Black/Orange", "Black/White", "All Black", "Cream/Black", "Gray/Black"]
  };

  if (hasVariants && colorMap[productType]) {
    variantWrap.classList.remove("hidden");
    sizeSelect.innerHTML = productType === "hat"
      ? "<option>One Size</option>"
      : sizeOptions;
    colorSelect.innerHTML = colorMap[productType]
      .map(c => `<option>${c}</option>`)
      .join("");

    document.getElementById("modal-add").onclick = function () {
      const size = sizeSelect.value;
      const color = colorSelect.value;
      const existing = cart.find(
        item => item.name === name && item.size === size && item.color === color
      );
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
      } else {
        cart.push({ name, price, size, color, qty: 1 });
      }
      saveCart();
      closeModal();
    };
  } else {
    document.getElementById("modal-add").onclick = function () {
      addToCart(name, price);
      closeModal();
    };
  }

  document.getElementById("product-modal").classList.remove("hidden");
  document.getElementById("product-modal").classList.add("flex");
}

function closeModal() {
  document.getElementById("product-modal").classList.add("hidden");
  document.getElementById("product-modal").classList.remove("flex");
}

function openImageGallery(images, startIndex = 0) {
  let currentIndex = startIndex;

  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4";

  function renderImage() {
    modal.innerHTML = `
      <div class="relative max-w-5xl w-full flex items-center justify-center">
        <button onclick="event.stopPropagation(); changeGalleryImage(-1)"
          class="absolute left-2 md:left-4 text-white text-5xl font-bold px-4 z-50">‹</button>
        <img src="${images[currentIndex]}" onclick="event.stopPropagation();"
          class="max-h-[85vh] w-full object-contain rounded-2xl border border-white/10"/>
        <button onclick="event.stopPropagation(); changeGalleryImage(1)"
          class="absolute right-2 md:right-4 text-white text-5xl font-bold px-4 z-50">›</button>
        <button onclick="event.stopPropagation(); document.querySelector('.fixed.inset-0').remove()"
          class="fixed top-4 right-4 text-white text-5xl font-bold z-[99999] bg-black/80 rounded-full w-14 h-14 flex items-center justify-center border border-white/20">×</button>
      </div>
    `;
  }

  window.changeGalleryImage = function (direction) {
    currentIndex += direction;
    if (currentIndex < 0) currentIndex = images.length - 1;
    if (currentIndex >= images.length) currentIndex = 0;
    renderImage();
  };

  modal.onclick = () => modal.remove();
  renderImage();
  document.body.appendChild(modal);
}