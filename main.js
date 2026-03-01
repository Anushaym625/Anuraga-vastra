/* ============================================================
   ANAYA SILKS — MAIN JAVASCRIPT
   ============================================================ */

// Cart state — managed by Shopify (shopify.js). Old localStorage cart is disabled.
localStorage.removeItem('anaya-cart');
let cart = [];
let wishlist = JSON.parse(localStorage.getItem('anaya-wishlist')) || [];

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  saveCart();
  updateCartBadge();
  showToast(`"${product.name}" added to your bag!`);
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  updateCartBadge();
}

function updateQuantity(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.quantity = Math.max(1, item.quantity + delta);
  saveCart();
  updateCartBadge();
}

function saveCart() { localStorage.setItem('anaya-cart', JSON.stringify(cart)); }

function updateCartBadge() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-badge').forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 2600);
}

// ============================================================
// STICKY NAVBAR
// ============================================================
function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
}

// ============================================================
// MOBILE NAV
// ============================================================
function initMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const mobileClose = document.querySelector('.mobile-nav-close');

  const openNav = () => {
    mobileNav && mobileNav.classList.add('open');
    mobileOverlay && mobileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeNav = () => {
    mobileNav && mobileNav.classList.remove('open');
    mobileOverlay && mobileOverlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  hamburger && hamburger.addEventListener('click', openNav);
  mobileClose && mobileClose.addEventListener('click', closeNav);
  mobileOverlay && mobileOverlay.addEventListener('click', closeNav);
}

// ============================================================
// SCROLL REVEAL
// ============================================================
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ============================================================
// PRODUCT CAROUSEL
// ============================================================
function initCarousel(carouselEl) {
  if (!carouselEl) return;
  const track = carouselEl.querySelector('.carousel-track');
  const cards = track ? track.querySelectorAll('.product-card') : [];
  const prevBtn = carouselEl.querySelector('.carousel-prev');
  const nextBtn = carouselEl.querySelector('.carousel-next');
  const dotsContainer = carouselEl.querySelector('.carousel-dots');

  if (!track || cards.length === 0) return;

  let currentIndex = 0;

  function getVisible() {
    const w = carouselEl.offsetWidth;
    if (w < 500) return 1;
    if (w < 800) return 2;
    return 3;
  }

  function totalSlides() { return Math.max(0, cards.length - getVisible()); }

  function buildDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const count = totalSlides() + 1;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    }
  }

  function updateDots() {
    if (!dotsContainer) return;
    dotsContainer.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === currentIndex);
    });
  }

  function goTo(index) {
    currentIndex = Math.max(0, Math.min(index, totalSlides()));
    const cardWidth = cards[0].offsetWidth + parseInt(getComputedStyle(track).gap || '20');
    track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
    updateDots();
  }

  prevBtn && prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn && nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

  buildDots();
  window.addEventListener('resize', () => {
    buildDots();
    goTo(0);
  }, { passive: true });
}

// ============================================================
// ACCORDION
// ============================================================
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      const content = item.querySelector('.accordion-content');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.accordion-item').forEach(i => {
        i.classList.remove('open');
        const c = i.querySelector('.accordion-content');
        if (c) c.style.maxHeight = null;
      });

      // Open clicked if it was closed
      if (!isOpen) {
        item.classList.add('open');
        if (content) content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

// ============================================================
// ADD TO CART BUTTONS
// ============================================================
function initAddToCartButtons() {
  document.querySelectorAll('[data-add-cart]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest('[data-product]') || btn.closest('.product-card');
      if (!card) return;
      const product = {
        id: card.dataset.productId || Date.now().toString(),
        name: card.dataset.productName || card.querySelector('.product-name')?.textContent || 'Silk Saree',
        price: card.dataset.productPrice || '4200',
        image: card.querySelector('img')?.src || ''
      };
      addToCart(product);
    });
  });
}

// ============================================================
// WISHLIST TOGGLE
// ============================================================
function initWishlist() {
  document.querySelectorAll('.product-wishlist').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.toggle('active');
      const name = btn.closest('.product-card')?.querySelector('.product-name')?.textContent || 'item';
      if (btn.classList.contains('active')) {
        btn.querySelector('svg').style.fill = 'var(--primary-red)';
        btn.querySelector('svg').style.stroke = 'var(--primary-red)';
        showToast(`Added to wishlist!`);
      } else {
        btn.querySelector('svg').style.fill = 'none';
        btn.querySelector('svg').style.stroke = 'var(--medium-text)';
      }
    });
  });
}

// ============================================================
// COLOR SWATCH SELECTION
// ============================================================
function initSwatches() {
  document.querySelectorAll('.swatch-group').forEach(group => {
    group.querySelectorAll('.swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        group.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });
  });
}

// ============================================================
// QUANTITY STEPPER
// ============================================================
function initQuantitySteppers() {
  document.querySelectorAll('.qty-stepper').forEach(stepper => {
    const input = stepper.querySelector('.qty-input');
    stepper.querySelector('.qty-minus')?.addEventListener('click', () => {
      const val = parseInt(input.value) || 1;
      input.value = Math.max(1, val - 1);
    });
    stepper.querySelector('.qty-plus')?.addEventListener('click', () => {
      const val = parseInt(input.value) || 1;
      input.value = val + 1;
    });
  });
}

// ============================================================
// IMAGE GALLERY (Product Page)
// ============================================================
function initGallery() {
  const mainImg = document.querySelector('.gallery-main img');
  document.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      if (!mainImg) return;
      document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      mainImg.src = thumb.querySelector('img').src;
    });
  });
}

// ============================================================
// FILTER SIDEBAR TOGGLE (mobile)
// ============================================================
function initFilterToggle() {
  const filterToggle = document.querySelector('.filter-toggle-btn');
  const filterSidebar = document.querySelector('.filter-sidebar');
  const filterClose = document.querySelector('.filter-close-btn');

  filterToggle && filterToggle.addEventListener('click', () => {
    filterSidebar && filterSidebar.classList.add('open');
  });

  filterClose && filterClose.addEventListener('click', () => {
    filterSidebar && filterSidebar.classList.remove('open');
  });
}

// ============================================================
// SORT DROPDOWN
// ============================================================
function initSortDropdown() {
  const select = document.querySelector('#sort-select');
  if (!select) return;
  select.addEventListener('change', () => {
    // In a real app, this would re-sort products
    showToast(`Sorted by: ${select.options[select.selectedIndex].text}`);
  });
}

// ============================================================
// CART PAGE RENDER
// ============================================================
function renderCart() {
  const tbody = document.querySelector('#cart-tbody');
  const emptyState = document.querySelector('.cart-empty');
  const cartTable = document.querySelector('.cart-table-wrapper');

  if (!tbody) return;

  if (cart.length === 0) {
    if (emptyState) emptyState.style.display = '';
    if (cartTable) cartTable.style.display = 'none';
    updateOrderSummary();
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (cartTable) cartTable.style.display = '';

  tbody.innerHTML = cart.map(item => `
    <tr data-cart-id="${item.id}">
      <td class="cart-product-cell">
        <div class="cart-product-info">
          <img src="${item.image || 'https://placehold.co/80x107/f5e6cc/8B0000?text=Saree'}" alt="${item.name}" class="cart-thumb">
          <div>
            <div class="cart-product-name">${item.name}</div>
            <div class="cart-product-tags">Pure Silk • Kanchipuram</div>
          </div>
        </div>
      </td>
      <td class="cart-color-cell">
        <span class="swatch" style="background:#C0392B; display:inline-block; width:18px; height:18px; border-radius:50%;"></span>
      </td>
      <td class="cart-qty-cell">
        <div class="qty-stepper cart-qty-stepper">
          <button class="qty-minus" onclick="changeCartQty('${item.id}', -1)">−</button>
          <span class="qty-input">${item.quantity}</span>
          <button class="qty-plus" onclick="changeCartQty('${item.id}', 1)">+</button>
        </div>
      </td>
      <td class="cart-price-cell">₹${(parseInt(item.price) * item.quantity).toLocaleString('en-IN')}</td>
      <td class="cart-remove-cell">
        <button class="cart-remove-btn" onclick="removeCartItem('${item.id}')">×</button>
      </td>
    </tr>
  `).join('');

  updateOrderSummary();
}

function changeCartQty(id, delta) {
  updateQuantity(id, delta);
  renderCart();
}

function removeCartItem(id) {
  removeFromCart(id);
  renderCart();
}

function updateOrderSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (parseInt(item.price) * item.quantity), 0);
  const subtotalEl = document.querySelector('#order-subtotal');
  const totalEl = document.querySelector('#order-total');
  const shippingEl = document.querySelector('#order-shipping');

  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (shippingEl) shippingEl.textContent = subtotal >= 5000 ? 'FREE' : '₹199';
  const shipping = subtotal >= 5000 ? 0 : 199;
  if (totalEl) totalEl.textContent = `₹${(subtotal + shipping).toLocaleString('en-IN')}`;
}

// ============================================================
// PROMO CODE
// ============================================================
function initPromoCode() {
  const applyBtn = document.querySelector('#promo-apply');
  const promoInput = document.querySelector('#promo-input');
  if (!applyBtn || !promoInput) return;
  applyBtn.addEventListener('click', () => {
    const code = promoInput.value.trim().toUpperCase();
    if (code === 'ANAYA10') {
      showToast('Promo code applied! 10% off');
    } else if (code) {
      showToast('Invalid promo code.');
    }
  });
}

// ============================================================
// NEWSLETTER FORM
// ============================================================
function initNewsletter() {
  const forms = document.querySelectorAll('.newsletter-form-el');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('.newsletter-input');
      if (input && input.value) {
        showToast('Thank you for subscribing!');
        input.value = '';
      }
    });
  });
}

// ============================================================
// CONTACT FORM
// ============================================================
function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Message sent! We\'ll get back to you shortly.');
    form.reset();
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileNav();
  initScrollReveal();
  initAccordions();
  initAddToCartButtons();
  initWishlist();
  initSwatches();
  initQuantitySteppers();
  initGallery();
  initFilterToggle();
  initSortDropdown();
  initPromoCode();
  initNewsletter();
  initContactForm();

  // Init carousels
  document.querySelectorAll('.carousel-wrapper').forEach(initCarousel);

  // Update cart badge — Shopify handles this if shopify.js is loaded
  if (typeof ShopifyCart === 'undefined') updateCartBadge();

  // If on cart page, render cart — only when Shopify is NOT active
  if (document.querySelector('#cart-tbody') && typeof ShopifyCart === 'undefined') renderCart();

  // Set active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
});
