// ============================================================
// ui.js — Mobile Menu, Fade Animations, Modal, Cart Toggle
// ============================================================

function openMobileMenu() {
  document.getElementById("mobile-menu").classList.remove("hidden");
}

function closeMobileMenu() {
  document.getElementById("mobile-menu").classList.add("hidden");
}

function initFadeAnimations() {
  const fadeSections = document.querySelectorAll("section");

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.12 }
  );

  fadeSections.forEach(section => {
    section.classList.add("fade-in-section");
    observer.observe(section);
  });
}

function initCartDrawer() {
  document.addEventListener("DOMContentLoaded", () => {
    renderCart();

    if (new URLSearchParams(window.location.search).get("openCart") === "true") {
      const drawer = document.getElementById("cart-drawer");
      if (drawer) {
        drawer.classList.remove("hidden");
        drawer.classList.add("flex");
      }
    }
  });
}