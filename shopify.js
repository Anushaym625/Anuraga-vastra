/* ============================================================
   Vastraluu — SHOPIFY STOREFRONT API INTEGRATION
   Store: pycdeu-ex.myshopify.com
   ============================================================ */

const SHOPIFY_CONFIG = {
  storeDomain: 'vastraluu.myshopify.com',
  storefrontAccessToken: 'e6e796481662f11784c036ffcb9d86f2',
  apiVersion: '2024-01',
};

const SHOPIFY_ENDPOINT = `https://${SHOPIFY_CONFIG.storeDomain}/api/${SHOPIFY_CONFIG.apiVersion}/graphql.json`;

// ============================================================
// CORE GRAPHQL FETCHER
// ============================================================
async function shopifyFetch(query, variables = {}) {
  try {
    const res = await fetch(SHOPIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      console.error('Shopify API error:', res.status, res.statusText);
      return null;
    }
    const json = await res.json();
    if (json.errors) {
      console.error('Shopify GraphQL errors:', json.errors);
      return null;
    }
    return json.data;
  } catch (err) {
    console.error('Shopify fetch failed:', err);
    return null;
  }
}

// ============================================================
// PRODUCT QUERIES
// ============================================================
const PRODUCT_CARD_FRAGMENT = `
  fragment ProductCard on Product {
    id
    title
    handle
    availableForSale
    tags
    priceRange {
      minVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
    }
    images(first: 2) {
      edges { node { url altText } }
    }
    variants(first: 10) {
      edges {
        node {
          id
          title
          availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
  }
`;

// Fetch all products (for shop page)
async function getProducts({ first = 12, after = null, query = '' } = {}) {
  const gql = `
    ${PRODUCT_CARD_FRAGMENT}
    query GetProducts($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: BEST_SELLING) {
        pageInfo { hasNextPage endCursor hasPreviousPage startCursor }
        edges { node { ...ProductCard } }
      }
    }
  `;
  const data = await shopifyFetch(gql, { first, after, query });
  return data?.products || null;
}

// Fetch single product by handle (standalone query — no fragment to avoid field conflicts)
async function getProduct(handle) {
  const gql = `
    query GetProduct($handle: String!) {
      product(handle: $handle) {
        id title handle availableForSale tags
        description descriptionHtml vendor productType
        priceRange { minVariantPrice { amount currencyCode } }
        compareAtPriceRange { minVariantPrice { amount currencyCode } }
        options { name values }
        images(first: 10) {
          edges { node { url altText } }
        }
        variants(first: 50) {
          edges {
            node {
              id title availableForSale quantityAvailable
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              selectedOptions { name value }
              image { url altText }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyFetch(gql, { handle });
  return data?.product || null;
}

// Fetch collections
async function getCollections(first = 10) {
  const gql = `
    query GetCollections($first: Int!) {
      collections(first: $first) {
        edges {
          node {
            id title handle description
            image { url altText }
            products(first: 1) {
              edges { node { images(first:1){ edges { node { url } } } } }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyFetch(gql, { first });
  return data?.collections?.edges?.map(e => e.node) || [];
}

// Fetch products by collection handle
async function getProductsByCollection(collectionHandle, first = 12) {
  const gql = `
    ${PRODUCT_CARD_FRAGMENT}
    query GetCollectionProducts($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        id title description
        products(first: $first) {
          edges { node { ...ProductCard } }
        }
      }
    }
  `;
  const data = await shopifyFetch(gql, { handle: collectionHandle, first });
  return data?.collection || null;
}

// ============================================================
// CART / CHECKOUT (Shopify Cart API)
// ============================================================
const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id checkoutUrl
    totalQuantity
    cost {
      totalAmount { amount currencyCode }
      subtotalAmount { amount currencyCode }
    }
    lines(first: 50) {
      edges {
        node {
          id quantity
          cost { totalAmount { amount currencyCode } }
          merchandise {
            ... on ProductVariant {
              id title availableForSale
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              image { url altText }
              product { title handle }
              selectedOptions { name value }
            }
          }
        }
      }
    }
  }
`;

// Create cart
async function cartCreate(lines = []) {
  const gql = `
    ${CART_FRAGMENT}
    mutation CartCreate($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch(gql, { lines });
  return data?.cartCreate?.cart || null;
}

// Add to cart
async function cartLinesAdd(cartId, lines) {
  const gql = `
    ${CART_FRAGMENT}
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch(gql, { cartId, lines });
  return data?.cartLinesAdd?.cart || null;
}

// Update cart line quantity
async function cartLinesUpdate(cartId, lines) {
  const gql = `
    ${CART_FRAGMENT}
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch(gql, { cartId, lines });
  return data?.cartLinesUpdate?.cart || null;
}

// Remove cart line
async function cartLinesRemove(cartId, lineIds) {
  const gql = `
    ${CART_FRAGMENT}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ...CartFields }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyFetch(gql, { cartId, lineIds });
  return data?.cartLinesRemove?.cart || null;
}

// Get cart
async function getCart(cartId) {
  const gql = `
    ${CART_FRAGMENT}
    query GetCart($cartId: ID!) {
      cart(id: $cartId) { ...CartFields }
    }
  `;
  const data = await shopifyFetch(gql, { cartId });
  return data?.cart || null;
}

// ============================================================
// CART STATE MANAGER (localStorage-backed Shopify cart)
// ============================================================
const ShopifyCart = {
  getCartId() { return localStorage.getItem('shopify-cart-id'); },
  setCartId(id) { localStorage.setItem('shopify-cart-id', id); },
  clearCartId() { localStorage.removeItem('shopify-cart-id'); },

  async getOrCreateCart() {
    const id = this.getCartId();
    if (id) {
      const cart = await getCart(id);
      if (cart) return cart;
      // Cart expired — create new one
      this.clearCartId();
    }
    const cart = await cartCreate([]);
    if (cart) this.setCartId(cart.id);
    return cart;
  },

  async addItem(variantId, quantity = 1) {
    let cart = await this.getOrCreateCart();
    if (!cart) return null;
    cart = await cartLinesAdd(cart.id, [{ merchandiseId: variantId, quantity }]);
    if (cart) {
      this.setCartId(cart.id);
      updateShopifyCartBadge(cart.totalQuantity);
      showToast('Added to your bag!');
    }
    return cart;
  },

  async updateItem(lineId, quantity) {
    const cartId = this.getCartId();
    if (!cartId) return null;
    const cart = await cartLinesUpdate(cartId, [{ id: lineId, quantity }]);
    if (cart) updateShopifyCartBadge(cart.totalQuantity);
    return cart;
  },

  async removeItem(lineId) {
    const cartId = this.getCartId();
    if (!cartId) return null;
    const cart = await cartLinesRemove(cartId, [lineId]);
    if (cart) updateShopifyCartBadge(cart.totalQuantity);
    return cart;
  },

  async checkout() {
    const cart = await this.getOrCreateCart();
    if (cart?.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    } else {
      showToast('Unable to start checkout. Please try again.');
    }
  },

  async getCount() {
    const id = this.getCartId();
    if (!id) return 0;
    const cart = await getCart(id);
    return cart?.totalQuantity || 0;
  },
};

// ============================================================
// UI HELPERS
// ============================================================
function updateShopifyCartBadge(count) {
  document.querySelectorAll('.cart-badge').forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
}

function formatPrice(amount, currencyCode = 'INR') {
  const num = parseFloat(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(num);
}

function getDiscountPercent(price, compareAt) {
  if (!compareAt || parseFloat(compareAt) <= parseFloat(price)) return null;
  const pct = Math.round((1 - parseFloat(price) / parseFloat(compareAt)) * 100);
  return pct > 0 ? pct : null;
}

// ============================================================
// PRODUCT CARD RENDERER
// ============================================================
function renderProductCard(product, clickUrl = null) {
  const img = product.images?.edges?.[0]?.node;
  const imgSrc = img?.url || `https://placehold.co/400x533/f5e6cc/8B0000?text=${encodeURIComponent(product.title)}`;
  const imgAlt = img?.altText || product.title;

  const price = product.priceRange?.minVariantPrice?.amount;
  const compareAt = product.compareAtPriceRange?.minVariantPrice?.amount;
  const currency = product.priceRange?.minVariantPrice?.currencyCode || 'INR';
  const discount = getDiscountPercent(price, compareAt);

  const firstVariantId = product.variants?.edges?.[0]?.node?.id;
  const productUrl = clickUrl || `product.html?handle=${product.handle}`;

  return `
    <div class="product-card" data-product
         data-product-id="${product.id}"
         data-variant-id="${firstVariantId || ''}"
         data-product-name="${product.title}"
         data-product-price="${price}"
         onclick="location.href='${productUrl}'">
      <div class="product-card-img">
        ${discount ? `<span class="product-badge">${discount}% off</span>` : ''}
        <button class="product-wishlist" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <img src="${imgSrc}" alt="${imgAlt}" loading="lazy">
        <div class="product-add-overlay shopify-add-to-cart"
             data-variant-id="${firstVariantId || ''}"
             onclick="event.stopPropagation(); shopifyAddToCart(this)">
          Add to Cart
        </div>
      </div>
      <div class="product-card-info">
        <div class="product-name">${product.title}</div>
        <div class="product-pricing">
          ${compareAt && parseFloat(compareAt) > parseFloat(price)
      ? `<span class="product-price-old">${formatPrice(compareAt, currency)}</span>` : ''}
          <span class="product-price-new">${formatPrice(price, currency)}</span>
        </div>
        <div class="product-tags">${product.tags?.slice(0, 3).join(' • ') || 'Pure Silk • Kanchipuram'}</div>
      </div>
    </div>
  `;
}

// ============================================================
// ADD TO CART (called from HTML onclick)
// ============================================================
async function shopifyAddToCart(btn) {
  const variantId = btn?.dataset?.variantId;
  if (!variantId) {
    showToast('Please select a variant first.');
    return;
  }
  btn.textContent = 'Adding...';
  btn.style.pointerEvents = 'none';
  const cart = await ShopifyCart.addItem(variantId, 1);
  btn.textContent = cart ? '✓ Added!' : 'Add to Cart';
  setTimeout(() => {
    btn.textContent = 'Add to Cart';
    btn.style.pointerEvents = '';
  }, 2000);
}

// ============================================================
// NEWSLETTER SIGNUP via Shopify (customer create)
// ============================================================
async function shopifyNewsletterSignup(email) {
  const gql = `
    mutation CustomerCreate($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id email }
        customerUserErrors { field message code }
      }
    }
  `;
  const data = await shopifyFetch(gql, {
    input: { email, acceptsMarketing: true },
  });
  const errors = data?.customerCreate?.customerUserErrors;
  if (errors?.length > 0) {
    const alreadyExists = errors.some(e => e.code === 'TAKEN');
    return alreadyExists ? { success: true, alreadyExists: true } : { success: false, error: errors[0].message };
  }
  return { success: true };
}

// ============================================================
// INIT CART BADGE ON PAGE LOAD
// ============================================================
async function initShopifyCartBadge() {
  const id = ShopifyCart.getCartId();
  if (!id) return;
  const cart = await getCart(id);
  if (cart) updateShopifyCartBadge(cart.totalQuantity);
}

// ============================================================
// SHOP PAGE — Interactive Filters
// ============================================================

// Global filter state
window._shopFilters = { categories: [], colors: [], priceMin: 0, priceMax: 50000, fabrics: [], occasions: [] };
// Color palette for filter swatches
const FILTER_COLORS = [
  { name: 'Red', hex: '#C0392B' }, { name: 'Maroon', hex: '#800000' },
  { name: 'Pink', hex: '#E91E8C' }, { name: 'Orange', hex: '#E07B00' },
  { name: 'Saffron', hex: '#FF9933' }, { name: 'Gold', hex: '#D4A017' },
  { name: 'Yellow', hex: '#F4C430' }, { name: 'Cream', hex: '#F5E6CC' },
  { name: 'Ivory', hex: '#FDF6EC' }, { name: 'Green', hex: '#4a7c59' },
  { name: 'Teal', hex: '#008080' }, { name: 'Blue', hex: '#234b7a' },
  { name: 'Navy', hex: '#000080' }, { name: 'Purple', hex: '#6A0DAD' },
  { name: 'Black', hex: '#1A1A1A' }, { name: 'White', hex: '#FFFFFF' },
];

async function loadShopFilters() {
  // Load color swatches
  const colorContainer = document.getElementById('filter-color-swatches');
  if (colorContainer) {
    colorContainer.innerHTML = FILTER_COLORS.map(c => {
      const isLight = ['#F5E6CC', '#FDF6EC', '#FFFFFF', '#F4C430'].includes(c.hex);
      return `<span class="filter-swatch"
                    style="background:${c.hex};${isLight ? 'border:1.5px solid #d4c4b0;' : ''}
                           width:28px;height:28px;border-radius:50%;display:inline-block;cursor:pointer;
                           transition:transform 0.15s,box-shadow 0.15s;position:relative;"
                    title="${c.name}"
                    data-color="${c.name.toLowerCase()}"
                    onclick="toggleFilterColor(this, '${c.name.toLowerCase()}')">
              </span>`;
    }).join('');
  }

  // Load collections into Category filter from Shopify
  const catContainer = document.getElementById('filter-category-options');
  try {
    const collections = await getCollections(20);
    if (catContainer && collections?.length > 0) {
      catContainer.innerHTML = collections.map(col => `
        <label class="filter-checkbox">
          <input type="checkbox" value="${col.handle}" data-title="${col.title}" onchange="toggleFilterCategory(this)">
          ${col.title}
        </label>
      `).join('');
    } else if (catContainer) {
      catContainer.innerHTML = '<div style="font-size:0.78rem;color:var(--light-text);">No collections found</div>';
    }
  } catch (e) {
    if (catContainer) catContainer.innerHTML = '<div style="font-size:0.78rem;color:var(--light-text);">Could not load collections</div>';
  }

  // Price range
  const minEl = document.getElementById('price-range-min');
  const maxEl = document.getElementById('price-range-max');
  if (minEl) minEl.addEventListener('change', applyFilters);
  if (maxEl) maxEl.addEventListener('change', applyFilters);

  // Clear all
  document.getElementById('clear-all-filters')?.addEventListener('click', clearAllFilters);
}

function toggleFilterColor(el, colorName) {
  el.classList.toggle('active');
  if (el.classList.contains('active')) {
    el.style.outline = '2px solid var(--dark-text)';
    el.style.outlineOffset = '2px';
    el.style.transform = 'scale(1.15)';
    if (!window._shopFilters.colors.includes(colorName)) window._shopFilters.colors.push(colorName);
  } else {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.transform = '';
    window._shopFilters.colors = window._shopFilters.colors.filter(c => c !== colorName);
  }
  applyFilters();
}

function toggleFilterCategory(cb) {
  const handle = cb.value;
  if (cb.checked) {
    if (!window._shopFilters.categories.includes(handle)) window._shopFilters.categories.push(handle);
  } else {
    window._shopFilters.categories = window._shopFilters.categories.filter(c => c !== handle);
  }
  applyFilters();
}

function syncPriceRange(el, which) {
  const minEl = document.getElementById('price-range-min');
  const maxEl = document.getElementById('price-range-max');
  let min = parseInt(minEl.value), max = parseInt(maxEl.value);
  if (min > max - 500) {
    if (which === 'min') { min = max - 500; minEl.value = min; }
    else { max = min + 500; maxEl.value = max; }
  }
  window._shopFilters.priceMin = min;
  window._shopFilters.priceMax = max;
  document.getElementById('price-min-label').textContent = min.toLocaleString('en-IN');
  document.getElementById('price-max-label').textContent = max.toLocaleString('en-IN');
}

function applyFilters() {
  const f = window._shopFilters;
  // Update from checkboxes (fabric + occasion)
  f.fabrics = [...document.querySelectorAll('#filter-fabric-options input:checked')].map(i => i.value);
  f.occasions = [...document.querySelectorAll('#filter-occasion-options input:checked')].map(i => i.value);

  updateActiveFilterChips();

  // If exactly one collection selected and no other filters, load collection directly
  const hasTagFilters = f.colors.length > 0 || f.fabrics.length > 0 || f.occasions.length > 0;
  const hasPriceFilter = f.priceMin > 0 || f.priceMax < 50000;

  if (f.categories.length === 1 && !hasTagFilters && !hasPriceFilter) {
    loadShopProducts({ collectionHandle: f.categories[0] });
    return;
  }

  // No active filters at all — show all products
  if (!hasTagFilters && !hasPriceFilter && f.categories.length === 0) {
    loadShopProducts();
    return;
  }

  // Build query parts
  const parts = [];

  // Colors → tags (OR within group)
  if (f.colors.length > 0) {
    parts.push('(' + f.colors.map(c => `tag:${c}`).join(' OR ') + ')');
  }
  // Fabrics → tags
  if (f.fabrics.length > 0) {
    parts.push('(' + f.fabrics.map(fab => `tag:"${fab}"`).join(' OR ') + ')');
  }
  // Occasions → tags
  if (f.occasions.length > 0) {
    parts.push('(' + f.occasions.map(occ => `tag:"${occ}"`).join(' OR ') + ')');
  }
  // Price — Shopify Storefront API supports price:< and price:> in query
  if (f.priceMin > 0) parts.push(`price:>=${f.priceMin}`);
  if (f.priceMax < 50000) parts.push(`price:<=${f.priceMax}`);

  const query = parts.join(' AND ');

  // If collection(s) also selected, load from first collection with query
  if (f.categories.length > 0) {
    loadShopProducts({ collectionHandle: f.categories[0], query });
  } else {
    loadShopProducts({ query });
  }
}

function updateActiveFilterChips() {
  const f = window._shopFilters;
  const container = document.getElementById('active-filters');
  if (!container) return;

  const chips = [];
  f.colors.forEach(c => chips.push({
    label: `Color: ${c}`, remove: () => {
      f.colors = f.colors.filter(x => x !== c);
      document.querySelectorAll('#filter-color-swatches .filter-swatch').forEach(el => {
        if (el.dataset.color === c) { el.classList.remove('active'); el.style.outline = ''; el.style.transform = ''; }
      });
      applyFilters();
    }
  }));
  f.fabrics.forEach(fab => chips.push({
    label: `Fabric: ${fab}`, remove: () => {
      document.querySelectorAll('#filter-fabric-options input:checked').forEach(cb => { if (cb.value === fab) cb.checked = false; });
      f.fabrics = f.fabrics.filter(x => x !== fab);
      applyFilters();
    }
  }));
  f.occasions.forEach(occ => chips.push({
    label: `Occasion: ${occ}`, remove: () => {
      document.querySelectorAll('#filter-occasion-options input:checked').forEach(cb => { if (cb.value === occ) cb.checked = false; });
      f.occasions = f.occasions.filter(x => x !== occ);
      applyFilters();
    }
  }));
  f.categories.forEach(cat => {
    const label = document.querySelector(`#filter-category-options input[value="${cat}"]`)?.dataset?.title || cat;
    chips.push({
      label: `Collection: ${label}`, remove: () => {
        document.querySelectorAll('#filter-category-options input:checked').forEach(cb => { if (cb.value === cat) cb.checked = false; });
        f.categories = f.categories.filter(x => x !== cat);
        applyFilters();
      }
    });
  });
  if (f.priceMin > 0 || f.priceMax < 50000) {
    chips.push({
      label: `Price: ₹${f.priceMin.toLocaleString('en-IN')}–₹${f.priceMax.toLocaleString('en-IN')}`, remove: () => {
        f.priceMin = 0; f.priceMax = 50000;
        document.getElementById('price-range-min').value = 0;
        document.getElementById('price-range-max').value = 50000;
        document.getElementById('price-min-label').textContent = '0';
        document.getElementById('price-max-label').textContent = '50,000';
        applyFilters();
      }
    });
  }

  if (chips.length > 0) {
    container.style.display = 'flex';
    container.innerHTML = chips.map((chip, i) => `
      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;background:var(--soft-bg);border:1px solid var(--border-light);border-radius:20px;font-family:var(--font-body);font-size:0.73rem;color:var(--medium-text);">
        ${chip.label}
        <span onclick="window._filterChipRemovers[${i}]()" style="cursor:pointer;color:var(--light-text);font-weight:700;">×</span>
      </span>
    `).join('');
    window._filterChipRemovers = chips.map(c => c.remove);
  } else {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

function clearAllFilters() {
  window._shopFilters = { categories: [], colors: [], priceMin: 0, priceMax: 50000, fabrics: [], occasions: [] };
  document.querySelectorAll('#filter-category-options input, #filter-fabric-options input, #filter-occasion-options input').forEach(cb => cb.checked = false);
  document.querySelectorAll('#filter-color-swatches .filter-swatch').forEach(el => {
    el.classList.remove('active'); el.style.outline = ''; el.style.transform = '';
  });
  const minEl = document.getElementById('price-range-min'); if (minEl) minEl.value = 0;
  const maxEl = document.getElementById('price-range-max'); if (maxEl) maxEl.value = 50000;
  document.getElementById('price-min-label') && (document.getElementById('price-min-label').textContent = '0');
  document.getElementById('price-max-label') && (document.getElementById('price-max-label').textContent = '50,000');
  const ac = document.getElementById('active-filters'); if (ac) { ac.style.display = 'none'; ac.innerHTML = ''; }
  loadShopProducts();
}

// ============================================================
// SHOP PAGE — Load & Render Products
// ============================================================
async function loadShopProducts({ query = '', collectionHandle = '', after = null } = {}) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  grid.innerHTML = '<div id="shop-loading" style="grid-column:1/-1;text-align:center;padding:60px 20px;font-family:var(--font-body);color:var(--light-text);font-size:0.9rem;"><div style="width:32px;height:32px;border:2px solid var(--border-light);border-top-color:var(--dark-text);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>Loading...</div>';

  let result;
  if (collectionHandle) {
    // Load by collection handle
    const gql = `query CollectionProducts($handle:String!,$first:Int!){
      collection(handle:$handle){
        products(first:$first){
          pageInfo{hasNextPage endCursor}
          edges{node{id title handle availableForSale productType tags
            images(first:1){edges{node{url altText}}}
            variants(first:1){edges{node{id price{amount currencyCode} compareAtPrice{amount currencyCode} availableForSale selectedOptions{name value}}}}
            options{name values}
          }}
        }
      }
    }`;
    const data = await shopifyFetch(gql, { handle: collectionHandle, first: 24 });
    result = data?.collection?.products;
  } else {
    result = await getProducts({ first: 24, after, query });
  }

  // Sort
  let products = result?.edges?.map(e => e.node) || [];
  const sortVal = document.getElementById('sort-select')?.value || '';
  if (sortVal === 'Price: Low to High') products.sort((a, b) => parseFloat(a.variants?.edges?.[0]?.node?.price?.amount || 0) - parseFloat(b.variants?.edges?.[0]?.node?.price?.amount || 0));
  else if (sortVal === 'Price: High to Low') products.sort((a, b) => parseFloat(b.variants?.edges?.[0]?.node?.price?.amount || 0) - parseFloat(a.variants?.edges?.[0]?.node?.price?.amount || 0));

  if (!products.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;"><p style="font-family:var(--font-body);color:var(--light-text);">No products found matching your filters.</p><button onclick="clearAllFilters()" style="margin-top:16px;padding:10px 24px;background:var(--dark-text);color:white;border:none;font-family:var(--font-body);font-size:0.8rem;cursor:pointer;letter-spacing:0.08em;">CLEAR FILTERS</button></div>`;
    return;
  }

  grid.innerHTML = products.map(p => renderProductCard(p)).join('');
  document.querySelectorAll('.product-card').forEach(el => el.classList.add('reveal', 'visible'));
  initWishlist();

  const countEl = document.getElementById('product-count');
  if (countEl) countEl.textContent = products.length;

  const pageInfo = result?.pageInfo;
  const nextBtn = document.getElementById('pagination-next');
  if (nextBtn) {
    nextBtn.style.display = pageInfo?.hasNextPage ? '' : 'none';
    nextBtn.dataset.cursor = pageInfo?.endCursor || '';
  }
}
// ============================================================
// PRODUCT DETAIL PAGE — Load Product
// ============================================================
async function loadProductDetail() {
  const params = new URLSearchParams(window.location.search);
  let handle = params.get('handle');

  if (!handle) {
    const products = await getProducts({ first: 1 });
    handle = products?.edges?.[0]?.node?.handle;
    if (!handle) return;
  }

  const product = await getProduct(handle);
  if (!product) {
    document.querySelector('.product-detail-layout').innerHTML =
      '<p style="padding:60px;text-align:center;font-family:var(--font-body);">Product not found. <a href="shop.html">Browse our collection</a></p>';
    return;
  }

  // --- Page title & meta ---
  document.title = `${product.title} | Vastraluu`;
  document.querySelector('meta[name="description"]')?.setAttribute('content',
    product.description?.slice(0, 160) || product.title);

  // --- Breadcrumb ---
  const catLabel = product.productType || product.tags?.[0] || 'Sarees';
  const bCat = document.getElementById('breadcrumb-category');
  const bName = document.getElementById('breadcrumb-product-name');
  if (bCat) bCat.textContent = catLabel;
  if (bName) bName.textContent = product.title;

  // --- Category & Title ---
  const catEl = document.getElementById('product-type-label') || document.querySelector('.product-detail-category');
  if (catEl) catEl.textContent = product.productType || catLabel;
  const titleEl = document.getElementById('product-title-el') || document.querySelector('.product-detail-name');
  if (titleEl) titleEl.textContent = product.title;

  // --- Description ---
  const descEl = document.querySelector('.product-description-content');
  if (descEl) descEl.innerHTML = product.descriptionHtml || product.description || 'No description available.';

  // --- Images & Thumbnails ---
  const images = product.images?.edges?.map(e => e.node) || [];
  const mainImg = document.getElementById('main-product-img');
  if (mainImg && images[0]) {
    mainImg.src = images[0].url;
    mainImg.alt = images[0].altText || product.title;
  }
  const thumbsContainer = document.getElementById('gallery-thumbs-container') || document.querySelector('.gallery-thumbs');
  if (thumbsContainer && images.length > 0) {
    thumbsContainer.innerHTML = images.slice(0, 6).map((img, i) => `
  <div class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="switchGalleryImage('${img.url}', this)">
    <img src="${img.url}" alt="${img.altText || product.title}" loading="lazy">
  </div>
`).join('');
  }

  // --- Variants ---
  const variants = product.variants?.edges?.map(e => e.node) || [];
  window._shopifyVariants = variants;
  const firstAvailable = variants.find(v => v.availableForSale) || variants[0];
  window._selectedVariantId = firstAvailable?.id;

  // --- Stock Status ---
  const stockEl = document.getElementById('product-stock-status');
  if (stockEl) {
    if (product.availableForSale) {
      stockEl.textContent = '✓ In Stock — Ships in 3–5 business days';
      stockEl.style.color = '#4a9e4a';
    } else {
      stockEl.textContent = '✕ Currently Out of Stock';
      stockEl.style.color = '#c0392b';
      const addBtn = document.getElementById('detail-add-cart');
      if (addBtn) { addBtn.textContent = 'OUT OF STOCK'; addBtn.disabled = true; addBtn.style.opacity = '0.5'; }
    }
  }

  // --- Color Options ---
  const colorOption = product.options?.find(o => ['color', 'colour'].includes(o.name.toLowerCase()));
  const colorSection = document.getElementById('color-section');
  const colorContainer = document.getElementById('color-options-container') || document.querySelector('.color-options');

  // Extended color map — name fragment → hex
  const COLOR_MAP = {
    'red': '#C0392B', 'ruby': '#9B111E', 'crimson': '#8B0000', 'maroon': '#800000',
    'pink': '#E91E8C', 'rose': '#FF007F', 'magenta': '#8B0050', 'fuchsia': '#FF00FF',
    'orange': '#E07B00', 'saffron': '#FF9933', 'yellow': '#F4C430', 'gold': '#D4A017',
    'mustard': '#FFDB58', 'cream': '#F5E6CC', 'ivory': '#FDF6EC', 'white': '#FFFFFF',
    'beige': '#F5F0E8', 'off-white': '#FAF5EE',
    'green': '#4a7c59', 'emerald': '#007A3D', 'mint': '#98FF98', 'teal': '#008080',
    'peacock': '#1a6b6b', 'turquoise': '#30D5C8',
    'blue': '#234b7a', 'navy': '#000080', 'royal': '#4169E1', 'cerulean': '#2A52BE',
    'purple': '#6A0DAD', 'violet': '#EE82EE', 'lavender': '#B57EDC', 'wine': '#722F37',
    'black': '#1A1A1A', 'grey': '#808080', 'gray': '#808080', 'silver': '#C0C0C0',
    'brown': '#8B4513', 'copper': '#B87333', 'bronze': '#CD7F32',
  };

  if (colorOption && colorSection && colorContainer) {
    const colors = colorOption.values;
    colorSection.style.display = '';
    colorContainer.innerHTML = colors.map((c, i) => {
      const cLow = c.toLowerCase();
      const hexKey = Object.keys(COLOR_MAP).find(k => cLow.includes(k));
      const bg = hexKey ? COLOR_MAP[hexKey] : null;
      // Use CSS color() or just the name as a CSS color if no map match
      const swatchStyle = bg
        ? `background:${bg};`
        : `background:${cLow}; border: 1.5px solid #ccc;`;
      const isLight = bg && ['#FDF6EC', '#F5E6CC', '#FAF5EE', '#FFFFFF', '#F5F0E8', '#98FF98'].includes(bg);
      const matchingVariant = variants.find(v =>
        v.selectedOptions?.some(o => ['color', 'colour'].includes(o.name.toLowerCase()) && o.value === c)
      );
      const available = matchingVariant?.availableForSale !== false;
      return `<span class="color-swatch-lg ${i === 0 ? 'active' : ''} ${!available ? 'sold-out' : ''}"
                style="${swatchStyle}${isLight ? 'border:1.5px solid #E8D5B7;' : ''}"
                title="${c}"
                data-color="${c}"
                onclick="selectColor(this, '${c}')"
                ${!available ? 'title="' + c + ' (Sold Out)"' : ''}>
                ${!available ? '<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;color:#fff;font-weight:700;">✕</span>' : ''}
          </span>`;
    }).join('');

    // Selected color label
    const colorLabel = document.getElementById('selected-color-name');
    if (colorLabel) colorLabel.textContent = colors[0];
  }

  // --- Size/Other Options ---
  product.options?.forEach(opt => {
    if (['color', 'colour'].includes(opt.name.toLowerCase())) return;
    const sizeSection = document.getElementById('size-section');
    const sizeContainer = document.getElementById('size-options-container');
    if (sizeSection && sizeContainer && opt.values.length > 1) {
      sizeSection.style.display = '';
      const label = sizeSection.querySelector('.option-label');
      if (label) label.textContent = opt.name;
      sizeContainer.innerHTML = opt.values.map((v, i) => `
    <button class="size-option-btn ${i === 0 ? 'active' : ''}"
            onclick="selectSize(this, '${opt.name}', '${v}')"
            style="padding:6px 16px; border:1.5px solid var(--border-light); background:${i === 0 ? 'var(--dark-text)' : 'white'}; color:${i === 0 ? 'white' : 'var(--dark-text)'}; font-family:var(--font-body); font-size:0.8rem; cursor:pointer; transition:all 0.2s;">${v}</button>
  `).join('');
    }
  });

  // --- Pricing ---
  updateProductPricing(firstAvailable);

  // --- Qty Stepper wiring (price preview) ---
  const qtyMinus = document.getElementById('qty-minus-btn');
  const qtyPlus = document.getElementById('qty-plus-btn');
  const qtyDisplay = document.getElementById('qty-display');
  if (qtyMinus && qtyPlus && qtyDisplay) {
    qtyMinus.onclick = () => {
      const cur = parseInt(qtyDisplay.textContent) || 1;
      if (cur > 1) { qtyDisplay.textContent = cur - 1; _updateQtyPreview(cur - 1); }
    };
    qtyPlus.onclick = () => {
      const cur = parseInt(qtyDisplay.textContent) || 1;
      qtyDisplay.textContent = cur + 1;
      _updateQtyPreview(cur + 1);
    };
  }

  // --- Add to Cart button ---
  const addBtn = document.getElementById('detail-add-cart');
  if (addBtn && product.availableForSale) {
    addBtn.onclick = async () => {
      if (!window._selectedVariantId) { showToast('Please select a variant.'); return; }
      const qty = parseInt(document.getElementById('qty-display')?.textContent || '1');
      addBtn.textContent = 'ADDING...';
      addBtn.disabled = true;
      await ShopifyCart.addItem(window._selectedVariantId, qty);
      addBtn.textContent = '✓ ADDED TO BAG';
      setTimeout(() => { addBtn.textContent = 'ADD TO CART'; addBtn.disabled = false; }, 2000);
    };
  }

  // --- Related Products ---
  const tag = product.productType || product.tags?.[0] || '';
  loadRelatedProducts(tag, product.handle);
}

function _updateQtyPreview(qty) {
  const priceEl = document.querySelector('.detail-price-new');
  const preview = document.getElementById('qty-price-preview');
  if (!priceEl || !preview) return;
  const rawPrice = parseFloat(priceEl.dataset.rawPrice || 0);
  const currency = priceEl.dataset.currency || 'INR';
  if (!rawPrice || qty <= 1) { preview.textContent = ''; return; }
  preview.textContent = '= ' + formatPrice(rawPrice * qty, currency);
}

function updateProductPricing(variant) {
  if (!variant) return;
  const priceOld = document.querySelector('.detail-price-old');
  const priceNew = document.querySelector('.detail-price-new');
  const badge = document.querySelector('.detail-discount-badge');

  const price = variant.price?.amount;
  const compareAt = variant.compareAtPrice?.amount;
  const currency = variant.price?.currencyCode || 'INR';

  if (priceNew) {
    priceNew.textContent = formatPrice(price, currency);
    priceNew.dataset.rawPrice = price;
    priceNew.dataset.currency = currency;
  }
  if (priceOld) {
    if (compareAt && parseFloat(compareAt) > parseFloat(price)) {
      priceOld.textContent = formatPrice(compareAt, currency);
      priceOld.style.display = '';
    } else { priceOld.style.display = 'none'; }
  }
  const pct = getDiscountPercent(price, compareAt);
  if (badge) { badge.textContent = pct ? `${pct}% OFF` : ''; badge.style.display = pct ? '' : 'none'; }
  // Reset qty preview
  document.getElementById('qty-display') && (document.getElementById('qty-display').textContent = '1');
  document.getElementById('qty-price-preview') && (document.getElementById('qty-price-preview').textContent = '');
}

function switchGalleryImage(url, thumbEl) {
  const mainImg = document.getElementById('main-product-img');
  if (mainImg) { mainImg.src = url; mainImg.style.opacity = '0'; setTimeout(() => mainImg.style.opacity = '1', 50); }
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumbEl?.classList.add('active');
}

function selectColor(el, colorName) {
  document.querySelectorAll('.color-swatch-lg').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  const label = document.getElementById('selected-color-name');
  if (label) label.textContent = colorName;
  const variants = window._shopifyVariants || [];
  const match = variants.find(v =>
    v.selectedOptions?.some(o => ['color', 'colour'].includes(o.name.toLowerCase()) && o.value === colorName)
  );
  if (match) {
    window._selectedVariantId = match.id;
    updateProductPricing(match);
    if (match.image) {
      const mainImg = document.getElementById('main-product-img');
      if (mainImg) { mainImg.src = match.image.url; }
    }
  }
}

function selectSize(el, optionName, value) {
  el.closest('#size-options-container')?.querySelectorAll('.size-option-btn').forEach(b => {
    b.style.background = 'white'; b.style.color = 'var(--dark-text)'; b.classList.remove('active');
  });
  el.style.background = 'var(--dark-text)'; el.style.color = 'white'; el.classList.add('active');
}

async function loadRelatedProducts(tag, excludeHandle) {
  const grid = document.getElementById('also-like-grid') || document.querySelector('.also-like-grid');
  if (!grid) return;
  const q = tag ? `product_type:${tag}` : '';
  const result = await getProducts({ first: 8, query: q });
  if (!result) return;
  const filtered = result.edges.filter(e => e.node.handle !== excludeHandle).slice(0, 4);
  if (filtered.length === 0) {
    // fallback: get any products
    const fallback = await getProducts({ first: 5 });
    const fb = fallback?.edges?.filter(e => e.node.handle !== excludeHandle).slice(0, 4) || [];
    grid.innerHTML = fb.map(e => renderProductCard(e.node)).join('');
  } else {
    grid.innerHTML = filtered.map(e => renderProductCard(e.node)).join('');
  }
  initWishlist();
}

// ============================================================
// CART PAGE — Load Shopify Cart
// ============================================================
async function loadCartPage() {
  const cartId = ShopifyCart.getCartId();
  const emptyState = document.getElementById('empty-cart-state');
  const cartWrapper = document.querySelector('.cart-table-wrapper');
  const tbody = document.getElementById('cart-tbody');

  if (!cartId) {
    if (emptyState) emptyState.style.display = 'block';
    if (cartWrapper) cartWrapper.style.display = 'none';
    return;
  }

  if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; font-family:var(--font-body); color:var(--light-text);">Loading your bag...</td></tr>';

  const cart = await getCart(cartId);

  if (!cart || cart.lines.edges.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (cartWrapper) cartWrapper.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (cartWrapper) cartWrapper.style.display = 'grid';

  const lines = cart.lines.edges.map(e => e.node);

  if (tbody) {
    tbody.innerHTML = lines.map(line => {
      const m = line.merchandise;
      const imgSrc = m.image?.url || `https://placehold.co/80x107/f5e6cc/8B0000?text=Saree`;
      const options = m.selectedOptions?.filter(o => o.name !== 'Title').map(o => `${o.name}: ${o.value}`).join(', ');
      return `
    <tr data-line-id="${line.id}">
      <td class="cart-product-cell">
        <div class="cart-product-info">
          <img src="${imgSrc}" alt="${m.product?.title}" class="cart-thumb" onclick="location.href='product.html?handle=${m.product?.handle}'">
          <div>
            <div class="cart-product-name">${m.product?.title}</div>
            <div class="cart-product-tags">${options || 'Pure Silk • Kanchipuram'}</div>
          </div>
        </div>
      </td>
      <td class="cart-color-cell">
        <span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#C0392B;"></span>
      </td>
      <td class="cart-qty-cell">
        <div class="qty-stepper cart-qty-stepper">
          <button onclick="updateCartLine('${line.id}', parseInt(document.getElementById('qty-${line.id}').textContent) - 1)">−</button>
          <span class="qty-input" id="qty-${line.id}">${line.quantity}</span>
          <button onclick="updateCartLine('${line.id}', parseInt(document.getElementById('qty-${line.id}').textContent) + 1)">+</button>
        </div>
      </td>
      <td class="cart-price-cell" id="price-${line.id}">
        ${formatPrice(line.cost?.totalAmount?.amount, line.cost?.totalAmount?.currencyCode)}
      </td>
      <td class="cart-remove-cell">
        <button class="cart-remove-btn" onclick="removeCartLine('${line.id}')">×</button>
      </td>
    </tr>
  `;
    }).join('');
  }

  updateCartSummary(cart);
}

function updateCartSummary(cart) {
  const sub = parseFloat(cart.cost?.subtotalAmount?.amount || 0);
  const currency = cart.cost?.subtotalAmount?.currencyCode || 'INR';
  const shipping = sub >= 5000 ? 0 : 199;
  const subtotalEl = document.getElementById('order-subtotal');
  const shippingEl = document.getElementById('order-shipping');
  const totalEl = document.getElementById('order-total');
  if (subtotalEl) subtotalEl.textContent = formatPrice(sub, currency);
  if (shippingEl) shippingEl.textContent = shipping === 0 ? 'FREE' : formatPrice(shipping, currency);
  if (totalEl) totalEl.textContent = formatPrice(sub + shipping, currency);
}

async function updateCartLine(lineId, newQty) {
  if (newQty < 1) { removeCartLine(lineId); return; }

  // Disable all cart buttons during update to prevent double-clicks
  document.querySelectorAll('.cart-qty-stepper button').forEach(b => {
    b.disabled = true;
    b.style.opacity = '0.4';
  });

  const cartId = ShopifyCart.getCartId();
  // Optimistically update qty display right away
  const qtyEl = document.getElementById(`qty-${lineId}`);
  if (qtyEl) qtyEl.textContent = newQty;

  try {
    const cart = await cartLinesUpdate(cartId, [{ id: lineId, quantity: newQty }]);
    if (cart) {
      // Check if Shopify capped the quantity (stock limit)
      const updatedLine = cart.lines.edges.find(e => e.node.id === lineId)?.node;
      const actualQty = updatedLine?.quantity ?? newQty;
      // Reload full cart to show accurate state from Shopify
      await loadCartPage();
      if (actualQty < newQty) {
        showToast(`Only ${actualQty} unit${actualQty > 1 ? 's' : ''} available for this item.`);
      }
    } else {
      // cartLinesUpdate returned null — likely API error, reload to show real state
      await loadCartPage();
      showToast('Could not update quantity. Please try again.');
    }
  } catch (e) {
    await loadCartPage();
  }
}

async function removeCartLine(lineId) {
  const cartId = ShopifyCart.getCartId();
  const cart = await cartLinesRemove(cartId, [lineId]);
  const row = document.querySelector(`[data-line-id="${lineId}"]`);
  if (row) row.remove();
  if (cart) {
    updateShopifyCartBadge(cart.totalQuantity);
    updateCartSummary(cart);
    if (cart.lines.edges.length === 0) {
      document.getElementById('empty-cart-state').style.display = 'block';
      document.querySelector('.cart-table-wrapper').style.display = 'none';
    }
  }
}

// ============================================================
// HOME PAGE — Load Best Sellers
// ============================================================
async function loadHomeBestSellers() {
  const track = document.querySelector('.carousel-track');
  if (!track) return;

  const result = await getProducts({ first: 6 });
  if (!result || result.edges.length === 0) return;

  const products = result.edges.map(e => e.node);
  track.innerHTML = products.map(p => `
<div class="product-card" style="flex: 0 0 calc((100% - 40px) / 3);"
     data-product data-product-id="${p.id}"
     data-variant-id="${p.variants?.edges?.[0]?.node?.id || ''}"
     data-product-name="${p.title}"
     data-product-price="${p.priceRange?.minVariantPrice?.amount}"
     onclick="location.href='product.html?handle=${p.handle}'">
  <div class="product-card-img">
    ${getDiscountPercent(p.priceRange?.minVariantPrice?.amount, p.compareAtPriceRange?.minVariantPrice?.amount)
      ? `<span class="product-badge">${getDiscountPercent(p.priceRange?.minVariantPrice?.amount, p.compareAtPriceRange?.minVariantPrice?.amount)}% off</span>` : ''}
    <button class="product-wishlist" onclick="event.stopPropagation()">
      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
    <img src="${p.images?.edges?.[0]?.node?.url || 'https://placehold.co/400x533/f5e6cc/8B0000?text=Saree'}"
         alt="${p.title}" loading="lazy">
    <div class="product-add-overlay shopify-add-to-cart"
         data-variant-id="${p.variants?.edges?.[0]?.node?.id || ''}"
         onclick="event.stopPropagation(); shopifyAddToCart(this)">Add to Cart</div>
  </div>
  <div class="product-card-info">
    <div class="product-name">${p.title}</div>
    <div class="product-pricing">
      ${p.compareAtPriceRange?.minVariantPrice?.amount && parseFloat(p.compareAtPriceRange.minVariantPrice.amount) > parseFloat(p.priceRange.minVariantPrice.amount)
      ? `<span class="product-price-old">${formatPrice(p.compareAtPriceRange.minVariantPrice.amount, p.compareAtPriceRange.minVariantPrice.currencyCode)}</span>` : ''}
      <span class="product-price-new">${formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode)}</span>
    </div>
    <div class="product-tags">${p.tags?.slice(0, 3).join(' • ') || 'Pure Silk • Kanchipuram'}</div>
  </div>
</div>
  `).join('');

  // Re-init carousel
  document.querySelectorAll('.carousel-wrapper').forEach(initCarousel);
  initWishlist();
}

// ============================================================
// HOME PAGE — Load Categories from Shopify Collections
// ============================================================
async function loadHomeCategories() {
  const grid = document.querySelector('.category-grid');
  if (!grid) return;

  const collections = await getCollections(6);
  if (!collections || collections.length === 0) return;

  grid.innerHTML = collections.slice(0, 3).map(col => {
    const img = col.image?.url || col.products?.edges?.[0]?.node?.images?.edges?.[0]?.node?.url
      || 'https://images.unsplash.com/photo-1583391265543-26b18a8ffe85?w=800&q=80';
    return `
  <div class="category-card" onclick="location.href='shop.html?collection=${col.handle}'">
    <div class="category-card-img">
      <img src="${img}" alt="${col.title}" loading="lazy">
      <div class="category-overlay"></div>
      <div class="category-info">
        <div class="category-name">${col.title.toUpperCase()}</div>
        <a href="shop.html?collection=${col.handle}" class="category-link">Shop the Latest</a>
      </div>
    </div>
  </div>
`;
  }).join('');
}

// ============================================================
// LOADING SPINNER
// ============================================================
const spinnerCSS = `
  .loading-spinner {
grid-column: 1/-1; display:flex; justify-content:center;
align-items:center; padding:80px; color:var(--light-text);
  }
  .loading-spinner::after {
content:''; width:36px; height:36px;
border:2px solid var(--border-light);
border-top-color:var(--primary-red);
border-radius:50%;
animation:spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform:rotate(360deg); } }
`;
const styleTag = document.createElement('style');
styleTag.textContent = spinnerCSS;
document.head.appendChild(styleTag);

// ============================================================
// PAGE-SPECIFIC INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Init cart badge
  initShopifyCartBadge();

  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (page === 'index.html' || page === '') {
    loadHomeBestSellers();
    loadHomeCategories();
  }

  if (page === 'shop.html') {
    const params = new URLSearchParams(window.location.search);
    const collection = params.get('collection');
    if (collection) {
      window._shopFilters.categories = [collection];
      loadShopProducts({ collectionHandle: collection });
    } else {
      loadShopProducts();
    }
    // Load interactive filters (color swatches, real collections, etc.)
    loadShopFilters();
    // Sort dropdown
    document.getElementById('sort-select')?.addEventListener('change', applyFilters);
  }

  if (page === 'product.html') {
    loadProductDetail();
  }

  if (page === 'cart.html') {
    loadCartPage();

    // Load "You May Also Like" suggestions from Shopify
    getProducts({ first: 4 }).then(result => {
      const grid = document.getElementById('cart-suggestions-grid');
      if (grid && result?.edges?.length) {
        grid.innerHTML = result.edges.map(e => renderProductCard(e.node)).join('');
      } else if (grid) {
        document.getElementById('cart-suggestions')?.remove();
      }
    });

    // Checkout button → Shopify hosted checkout
    document.querySelector('.checkout-btn')?.addEventListener('click', () => {
      ShopifyCart.checkout();
    });

    // Promo code (client-side)
    document.getElementById('promo-apply')?.addEventListener('click', () => {
      const code = document.getElementById('promo-input')?.value?.trim().toUpperCase();
      if (code === 'ANAYA10') showToast('Promo code applied! 10% off');
      else if (code) showToast('Invalid promo code.');
    });
  }

  // Newsletter signup
  document.querySelectorAll('.newsletter-form-el').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('.newsletter-input');
      if (!input?.value) return;
      const btn = form.querySelector('.newsletter-btn');
      if (btn) btn.textContent = 'Subscribing...';
      const result = await shopifyNewsletterSignup(input.value);
      if (result.success) {
        showToast(result.alreadyExists ? 'You\'re already subscribed!' : 'Thank you for subscribing!');
        input.value = '';
      } else {
        showToast(result.error || 'Subscription failed. Please try again.');
      }
      if (btn) btn.textContent = 'Subscribe';
    });
  });
});

