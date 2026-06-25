// ============================================================
// cart.js — Cart, Checkout, Quantity, Remove, Save, Drawer
// ============================================================

let cart = JSON.parse(localStorage.getItem("trulyBlissfulCart")) || [];
let stripe = null;

function saveCart() {
  localStorage.setItem("trulyBlissfulCart", JSON.stringify(cart));
  renderCart();
}

function addToCart(name, price, size = "Standard", color = "Standard") {
  const existing = cart.find(
    item => item.name === name && item.size === size && item.color === color
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price: Number(price), size, color, qty: 1 });
  }

  saveCart();
}

function changeQty(index, delta) {
  if (!cart[index]) return;
  cart[index].qty = (cart[index].qty || 1) + delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  saveCart();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  saveCart();
}

function clearCart() {
  cart = [];
  saveCart();
}

function renderCart() {
  const list = document.getElementById("cart-items");
  const total = document.getElementById("total");
  const badge = document.getElementById("cart-count");
  const floatingBadge = document.getElementById("floating-cart-count");
  const floatingBtn = document.getElementById("floating-cart-btn");

  if (!list) return;

  list.innerHTML = "";

  let itemCount = 0;
  let totalPrice = 0;

  cart.forEach((item, index) => {
    itemCount += item.qty;
    totalPrice += item.price * item.qty;

    const row = document.createElement("div");
    row.className = "border border-white/10 rounded-xl p-4 mb-3";
    row.innerHTML = `
      <div class="font-bold">${item.name}</div>
      <div class="text-sm text-gray-400">${item.size} / ${item.color}</div>
      <div class="text-orange-400 font-bold mt-1">$${item.price.toFixed(2)}</div>
      <div class="flex items-center justify-between mt-3">
        <div class="flex items-center gap-2">
          <button onclick="changeQty(${index},-1)" class="border border-white/20 px-3 py-1 rounded">-</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${index},1)" class="border border-white/20 px-3 py-1 rounded">+</button>
        </div>
        <button onclick="removeCartItem(${index})" class="text-red-400 font-bold">Remove</button>
      </div>
    `;
    list.appendChild(row);
  });

  if (cart.length === 0) {
    list.innerHTML = '<p class="text-gray-400">Your cart is empty.</p>';
  }

  if (total) total.textContent = "$" + totalPrice.toFixed(2);
  if (badge) badge.textContent = itemCount;
  if (floatingBadge) floatingBadge.textContent = itemCount;
  if (floatingBtn) {
    itemCount > 0
      ? floatingBtn.classList.remove("hidden")
      : floatingBtn.classList.add("hidden");
  }
}

function toggleCart() {
  const drawer = document.getElementById("cart-drawer");
  if (!drawer) return;

  if (drawer.classList.contains("hidden")) {
    drawer.classList.remove("hidden");
    drawer.classList.add("flex");
    renderCart();
  } else {
    drawer.classList.add("hidden");
    drawer.classList.remove("flex");
  }
}

function confirmCartOptions(name, price, button) {
  const modal = button.closest(".fixed");
  const size = modal.querySelector("#cart-size").value;
  const color = modal.querySelector("#cart-color").value;

  if (!size || !color) {
    alert("Please select a size and color.");
    return;
  }

  const existing = cart.find(
    item => item.name === name && item.size === size && item.color === color
  );

  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({ name, price, size, color, qty: 1 });
  }

  saveCart();
  modal.remove();
}

async function initStripe() {
  const res = await fetch("/config");
  const data = await res.json();
  stripe = Stripe(data.publishableKey);
}

async function checkout() {
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  if (!stripe) {
    alert("Checkout is loading, please try again.");
    return;
  }

  const res = await fetch("/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cart })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Checkout failed.");
    return;
  }

  stripe.redirectToCheckout({ sessionId: data.id });
}