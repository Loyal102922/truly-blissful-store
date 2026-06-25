// ============================================================
// main.js — Entry Point
// Initializes: Stripe, Cart, Featured Products, Reviews, UI
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Stripe
  initStripe();

  // Render cart from localStorage
  renderCart();

  // Load homepage featured products
  if (document.getElementById("featured-products")) {
    loadFeaturedProducts();
  }

  // Load reviews if on homepage
  if (document.getElementById("reviews-list")) {
    loadReviews();
  }

  // Fade animations
  initFadeAnimations();

  // Open cart drawer if redirected from success page
  if (new URLSearchParams(window.location.search).get("openCart") === "true") {
    const drawer = document.getElementById("cart-drawer");
    if (drawer) {
      drawer.classList.remove("hidden");
      drawer.classList.add("flex");
    }
  }
});