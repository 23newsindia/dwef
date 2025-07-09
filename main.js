/**
 * Main.js - Vanilla JavaScript implementation
 * Handles all checkout and cart functionality without jQuery dependency
 */


// Main.js - Vanilla JavaScript implementation
// Handles all checkout and cart functionality without jQuery dependency



// Constants and Global Variables
const FULL_WIDTH = 1200;
const LIGHTBOX_VARIATIONS = [];
let COUNT_WISHLIST_ITEMS = 0;
let NASA_CART = {};
let COOKIE_LIVE = 7;
let confettiRun = false;
let noticeTimeout;


// Polyfill for deprecated StorageType.persistent
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(persistent => {
    if (!persistent) {
      console.log('Storage will not be persistent');
    }
  });
}




// SVG Icons
const SVG_ICONS = {
  close: '<svg width="30" height="30" viewBox="0 0 32 32"><path d="M10.722 9.969l-0.754 0.754 5.278 5.278-5.253 5.253 0.754 0.754 5.253-5.253 5.253 5.253 0.754-0.754-5.253-5.253 5.278-5.278-0.754-0.754-5.278 5.278z" fill="currentColor"/></svg>',
  check: '<svg class="ns-check-svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 2.672c-7.361 0-13.328 5.967-13.328 13.328s5.968 13.328 13.328 13.328c7.361 0 13.328-5.967 13.328-13.328s-5.967-13.328-13.328-13.328zM16 28.262c-6.761 0-12.262-5.501-12.262-12.262s5.5-12.262 12.262-12.262c6.761 0 12.262 5.501 12.262 12.262s-5.5 12.262-12.262 12.262z" fill="currentColor"/><path d="M22.667 11.241l-8.559 8.299-2.998-2.998c-0.312-0.312-0.818-0.312-1.131 0s-0.312 0.818 0 1.131l3.555 3.555c0.156 0.156 0.361 0.234 0.565 0.234 0.2 0 0.401-0.075 0.556-0.225l9.124-8.848c0.317-0.308 0.325-0.814 0.018-1.131-0.309-0.318-0.814-0.325-1.131-0.018z" fill="currentColor"/></svg>',
  arrowDown: '<svg width="30" height="30" viewBox="0 0 32 32" stroke-width=".5" stroke="currentColor"><path d="M15.233 19.175l0.754 0.754 6.035-6.035-0.754-0.754-5.281 5.281-5.256-5.256-0.754 0.754 3.013 3.013z" fill="currentColor"/></svg>',
  arrowUp: '<svg width="30" height="30" viewBox="0 0 32 32"><path d="M16.767 12.809l-0.754-0.754-6.035 6.035 0.754 0.754 5.281-5.281 5.256 5.256 0.754-0.754-3.013-3.013z" fill="currentColor"/></svg>'
};

// Utility Functions
const setCookie = (name, value, days = COOKIE_LIVE) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// DOM Ready function
function domReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

// Responsive checks
const isResponsive = () => {
  const check = document.querySelector('.nasa-check-reponsive.nasa-switch-check');
  return check && check.offsetWidth === 1;
};

const isTablet = () => {
  const check = document.querySelector('.nasa-check-reponsive.nasa-tablet-check');
  return check && check.offsetWidth === 1;
};

const checkMobileDevice = () => { // â† Rename function
  return document.body.classList.contains('nasa-in-mobile');
};

// Custom Event Dispatcher
const triggerEvent = (element, eventName, detail = {}) => {
  // Handle WooCommerce events that expect parameters as arguments
  if (eventName === 'added_to_cart' || eventName === 'removed_from_cart') {
    // For WooCommerce events, trigger with jQuery-style parameters
    const event = new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail: Array.isArray(detail) ? detail : [detail]
    });
    element.dispatchEvent(event);
  } else {
    // For other events, use standard detail object
    const event = new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail: detail
    });
    element.dispatchEvent(event);
  }
};

// Checkout Page Functions
function initCheckoutPage() {
  // Initialize checkout page elements
  const checkoutWrap = document.querySelector('.checkout-modern-wrap');
  if (!checkoutWrap) return;

  // Handle mobile view adjustments
  if (checkMobileDevice()) { // â† Updated name
    const bcModern = checkoutWrap.querySelector('.nasa-bc-modern');
    if (bcModern) {
      const leftWrap = checkoutWrap.querySelector('.checkout-modern-left-wrap');
      if (leftWrap) {
        leftWrap.style.paddingTop = `${bcModern.offsetHeight}px`;
      }
    }
  }


  // Initialize quantity controls
  initQuantityControls();

  // Initialize mobile order summary toggle
  initMobileOrderSummary();

  // Remove loading state from review order table
  const reviewOrderTable = document.querySelector('.woocommerce-checkout-review-order-table');
  if (reviewOrderTable && !reviewOrderTable.classList.contains('nasa-loaded')) {
    reviewOrderTable.classList.add('nasa-loaded');
  }

  // Initialize shipping methods
  updateShippingMethods();

  // Initialize free shipping notification
  initShippingFreeNotification();
}

// Quantity Controls
function initQuantityControls() {
  // Find all quantity controls
  const quantityControls = document.querySelectorAll('.quantity');
  
  quantityControls.forEach(control => {
    const plusBtn = control.querySelector('.plus');
    const minusBtn = control.querySelector('.minus');
    const input = control.querySelector('.qty');
    
    if (plusBtn && minusBtn && input) {
      // Store original value
      if (input.value) {
        input.setAttribute('data-old', input.value);
      }
      
      // Plus button click
      plusBtn.addEventListener('click', function() {
        handleQuantityChange(input, true);
      });
      
      // Minus button click
      minusBtn.addEventListener('click', function() {
        handleQuantityChange(input, false);
      });
      
      // Input change
      input.addEventListener('change', function() {
        handleQuantityInputChange(input);
      });
    }
  });
}

function handleQuantityChange(input, isIncrease) {
  const quantity = parseFloat(input.value) || 0;
  const max = parseFloat(input.getAttribute('max')) || '';
  const min = parseFloat(input.getAttribute('min')) || 0;
  const step = parseFloat(input.getAttribute('step')) || 1;
  const oldValue = input.value;
  
  // Store old value
  input.setAttribute('data-old', oldValue);
  
  if (isIncrease) {
    // Increase quantity
    if (max && (quantity >= max)) {
      input.value = max;
    } else {
      input.value = quantity + step;
    }
  } else {
    // Decrease quantity
    if (min && (quantity <= min)) {
      input.value = min;
    } else if (quantity > 0) {
      input.value = quantity - step;
    }
  }
  
  // Update add to cart button quantity if exists
  const form = input.closest('.cart');
  if (form) {
    const addToCartBtn = form.querySelector('button[type="submit"].single_add_to_cart_button');
    if (addToCartBtn) {
      addToCartBtn.setAttribute('data-quantity', input.value);
    }
  }
  
  // Trigger change event
  const event = new Event('change', { bubbles: true });
  input.dispatchEvent(event);
}

function handleQuantityInputChange(input) {
  if (input.closest('.co-wrap-item')) {
    updateCartItemQuantity(input);
  } else if (input.closest('.after-add-to-cart-form.qty-auto-update')) {
    const form = input.closest('form.after-add-to-cart-form');
    const updateBtn = form.querySelector('.nasa-update-cart-popup');
    if (updateBtn) {
      updateBtn.classList.remove('nasa-disable');
      updateBtn.click();
    }
  }
}

function updateCartItemQuantity(input) {
  const cartItemKey = input.name.match(/cart\[([\w]+)\]\[qty\]/)[1];
  const quantity = parseFloat(input.value);
  const max = parseFloat(input.getAttribute('max')) || false;
  const oldValue = parseFloat(input.getAttribute('data-old')) || quantity;
  
  // Validate max quantity
  if (max && quantity > max) {
    input.value = max;
  }
  
  // Only proceed if quantity changed
  if (oldValue === quantity) return;
  
  // Confirm removal if quantity is zero
  if (quantity <= 0) {
    const confirmText = document.querySelector('input[name="nasa_change_value_0"]') ? 
      document.querySelector('input[name="nasa_change_value_0"]').value : 
      'Are you sure you want to remove it?';
      
    if (!confirm(confirmText)) {
      input.value = oldValue;
      return;
    }
  }
  
  // Add loading state
  const reviewOrder = document.querySelector('.woocommerce-checkout-review-order');
  if (reviewOrder) {
    reviewOrder.classList.add('processing');
  }
  
  // Update cart via AJAX
  updateCartAjax(cartItemKey, quantity);
}

function updateCartAjax(cartItemKey, quantity) {
  // Get AJAX URL
  const ajaxUrl = getAjaxUrl('nasa_quantity_mini_cart');
  if (!ajaxUrl) return;
  
  // Create form data
  const formData = new FormData();
  formData.append('hash', cartItemKey);
  formData.append('quantity', quantity);
  formData.append('no-mess', 1);
  
  // Send AJAX request
  fetch(ajaxUrl, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin'
  })
  .then(response => response.json())
  .then(data => {
    if (data && data.fragments) {
      // Update fragments
      Object.keys(data.fragments).forEach(key => {
        const element = document.querySelector(key);
        if (element) {
          element.outerHTML = data.fragments[key];
        }
      });
      
      // Trigger events
      triggerEvent(document.body, 'wc_fragments_refreshed');
      triggerEvent(document.body, 'nasa_init_shipping_free_notification');
      
      // Redirect if needed
      if (data.url_redirect) {
        window.location.href = data.url_redirect;
      } else {
        triggerEvent(document.body, 'update_checkout');
      }
    }
    
    // Remove processing state
    const reviewOrder = document.querySelector('.woocommerce-checkout-review-order');
    if (reviewOrder) {
      reviewOrder.classList.remove('processing');
    }
  })
  .catch(error => {
    console.error('Error updating cart:', error);
    triggerEvent(document.body, 'wc_fragments_ajax_error');
    
    // Remove processing state
    const reviewOrder = document.querySelector('.woocommerce-checkout-review-order');
    if (reviewOrder) {
      reviewOrder.classList.remove('processing');
    }
  });
}
























// Mobile Order Summary Toggle
function initMobileOrderSummary() {
  const mobileToggle = document.querySelector('.your-order-mobile');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMobileOrderSummary);
  }
  
  const closeToggle = document.querySelector('.close-your-order-mobile');
  if (closeToggle) {
    closeToggle.addEventListener('click', closeMobileOrderSummary);
  }
}

function toggleMobileOrderSummary() {
  const orderSummary = document.querySelector('.checkout-modern-right-wrap');
  if (orderSummary && !orderSummary.classList.contains('nasa-active')) {
    orderSummary.classList.add('nasa-active');
  }
}

function closeMobileOrderSummary() {
  const orderSummary = document.querySelector('.checkout-modern-right-wrap');
  if (orderSummary) {
    orderSummary.classList.remove('nasa-active');
  }
}

// Shipping Methods
function updateShippingMethods() {
  const shippingWrap = document.querySelector('.shipping-wrap-modern');
  const orderShipping = document.querySelector('.order-shipping-modern');
  
  if (!shippingWrap || !orderShipping) return;
  
  let shippingHtml = '';
  let available = false;
  let availableHtml = '';
  
  // Process each shipping package
  const shippingPackages = document.querySelectorAll('.shipping-wrap-modern');
  shippingPackages.forEach(pkg => {
    const shippingMethods = pkg.querySelector('#shipping_method');
    if (!shippingMethods) return;
    
    const packageName = pkg.querySelector('.shipping-package-name').innerHTML;
    
    shippingHtml += '<tr class="order-shipping-modern woocommerce-shipping-totals shipping">';
    shippingHtml += `<th>${packageName}</th>`;
    shippingHtml += '<td>';
    shippingHtml += '<ul id="shipping_method_clone" class="woocommerce-shipping-methods-clone">';
    
    // Get selected shipping method
    const selectedMethod = pkg.querySelector('#shipping_method li select.shipping_method, #shipping_method li input[name^="shipping_method"][type="radio"]:checked, #shipping_method li input[name^="shipping_method"][type="hidden"]');
    if (selectedMethod) {
      const methodItem = selectedMethod.closest('li');
      if (methodItem) {
        const methodClone = methodItem.cloneNode(true);
        
        // Remove inputs and buttons
        const inputs = methodClone.querySelectorAll('select.shipping_method, input[name^="shipping_method"], button, .button, script, #lpc_layer_error_message');
        inputs.forEach(input => input.remove());
        
        availableHtml = methodClone.innerHTML;
        shippingHtml += `<li>${availableHtml}</li>`;
        available = true;
      }
    }
    
    shippingHtml += '</ul>';
    shippingHtml += '</td></tr>';
  });
  
  // Update shipping methods in order review
  if (available) {
    orderShipping.outerHTML = shippingHtml;
    
    // Update shipping method in customer info
    const customerInfoMethod = document.querySelector('#nasa-billing-info .customer-info-method .customer-info-right');
    if (customerInfoMethod) {
      customerInfoMethod.innerHTML = availableHtml;
    }
  }
}

// Free Shipping Notification
function initShippingFreeNotification(forceUpdate = false) {
  const totalCondition = document.querySelector('.nasa-total-condition');
  if (!totalCondition) return;
  
  // Get current percentage
  const percentElement = totalCondition.querySelector('.nasa-total-condition-hint');
  if (!percentElement) return;
  
  const percent = parseFloat(percentElement.getAttribute('data-per'));
  
  // Update cookie
  setCookie('nasa_curent_per_shipping', percent, COOKIE_LIVE);
  
  // Show confetti if 100%
  if (percent >= 100 && !confettiRun) {
    confettiRun = true;
    triggerEvent(document.body, 'nasa_confetti_start', { time: 3000 });
  }
}

// Notice Functions
function showNotice(message, type = 'success') {
  // Clear existing notices
  const existingNotices = document.querySelectorAll('.woocommerce-notices-wrapper .woocommerce-message, .woocommerce-notices-wrapper .woocommerce-error');
  existingNotices.forEach(notice => notice.remove());

  // Create notice wrapper if it doesn't exist
  let noticesWrapper = document.querySelector('.woocommerce-notices-wrapper');
  if (!noticesWrapper) {
    noticesWrapper = document.createElement('div');
    noticesWrapper.className = 'woocommerce-notices-wrapper';
    document.body.insertBefore(noticesWrapper, document.body.firstChild);
  }
  
  // Create notice element
  const notice = document.createElement('div');
  notice.className = type === 'success' ? 'woocommerce-message' : 'woocommerce-error';
  notice.setAttribute('role', 'alert');
  notice.textContent = message;
  
  // Add to wrapper
  noticesWrapper.appendChild(notice);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notice.remove();
  }, 5000);
  
  // Scroll to top to show notice
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Helper Functions
function getAjaxUrl(endpoint) {
  if (typeof nasa_ajax_params !== 'undefined' && typeof nasa_ajax_params.wc_ajax_url !== 'undefined') {
    return nasa_ajax_params.wc_ajax_url.toString().replace('%%endpoint%%', endpoint);
  }
  return null;
}

// Add to Cart Functions
function handleSingleAddToCart(button, productId, quantity, type, variationId, attributes, extraParams) {
  // Validate variation selection for variable products
  if (type === 'variable' && (!variationId || variationId === '0')) {
    console.error('Variation ID required for variable product');
    const message = 'Please select some product options before adding this product to your cart.';
    showNotice(message, 'error');
    button.classList.remove('loading');
    return;
  }
  
  // Add loading class
  button.classList.add('loading');
  
  // Get AJAX URL
  const ajaxUrl = getAjaxUrl('add_to_cart');
  if (!ajaxUrl) {
    button.classList.remove('loading');
    return;
  }
  
  // Create form data
  const formData = new FormData();
  formData.append('product_id', productId);
  formData.append('quantity', quantity);
  
  // Add variation data if applicable
  if (variationId && variationId !== '0') {
    formData.append('variation_id', variationId);
    
    // Add attributes
    for (const [key, value] of Object.entries(attributes)) {
      formData.append(`attribute_${key}`, value);
    }
  }
  
  // Add extra params
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      formData.append(key, value);
    }
  }
  
  // Send AJAX request
  fetch(ajaxUrl, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  .then(response => response.json())
  .then(data => {
    // Handle response
    if (data) {
      // Close magnific popup if open
      triggerEvent(document.body, 'ns_magnific_popup_close');
      
      // Get after add to cart event
      const eventAfterAddToCart = document.querySelector('input[name="nasa-event-after-add-to-cart"]');
      let eventType = eventAfterAddToCart && eventAfterAddToCart.value ? eventAfterAddToCart.value : 'sidebar';
      
      // Show success message
      showNotice('Product added to cart successfully!', 'success');
      
      // Override for cart page
      if (document.querySelector('form.woocommerce-cart-form')) {
        eventType = 'notice';
      }
      
      // Handle different event types
      if ((eventType === 'popup' || eventType === 'popup_2') && 
          !document.querySelector('form.nasa-shopping-cart-form, form.woocommerce-checkout')) {
        afterAddedToCart();
        setTimeout(() => {
          initShippingFreeNotification(true);
        }, 500);
      } else if (eventType === 'sidebar') {
        // Open cart sidebar
        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar) {
          const blackWindow = document.querySelector('.black-window');
          if (blackWindow) {
            blackWindow.style.display = 'block';
            blackWindow.classList.add('desk-window');
          }
          
          // Hide wishlist sidebar
          const wishlistSidebar = document.getElementById('nasa-wishlist-sidebar');
          if (wishlistSidebar) {
            wishlistSidebar.classList.remove('nasa-active');
          }
          
          // Show cart sidebar
          cartSidebar.classList.add('nasa-active');
          cartSidebar.classList.remove('crazy-loading', 'nasa_update_from_mini_cart');
          
          // Trigger events
          triggerEvent(document.body, 'nasa_opened_cart_sidebar');
          
          // Initialize free shipping notification
          setTimeout(() => {
            initShippingFreeNotification(true);
          }, 50);
        }
      } else if (eventType === 'notice' && data['.woocommerce-message']) {
        // Show notice
        showNotice(data['.woocommerce-message']);
      }
      
      // Update fragments
      if (data.fragments) {
        Object.keys(data.fragments).forEach(key => {
          const element = document.querySelector(key);
          if (element) {
            element.outerHTML = data.fragments[key];
          }
        });
        
        // Trigger events
        triggerEvent(document.body, 'wc_fragments_refreshed');
      }
    }
    
    // Remove loading class
    button.classList.remove('loading');
    
    // Trigger added to cart event
    triggerEvent(document.body, 'added_to_cart', [data.fragments, data.cart_hash, button]);
  })
  .catch(error => {
    console.error('Error adding to cart:', error);
    button.classList.remove('loading');
  });
}

function afterAddedToCart() {
  // Implement popup functionality here
  console.log('Product added to cart - showing popup');
}

// Buy Now Function
function handleBuyNow(e) {
  if (e) e.preventDefault();
  
  const button = e.target;
  if (button.classList.contains('loading')) return;
  
  button.classList.add('loading');
  
  const form = button.closest('form.cart');
  if (!form) {
    button.classList.remove('loading');
    return;
  }
  
  const addToCartButton = form.querySelector('button[type="submit"].single_add_to_cart_button');
  
  if (addToCartButton && addToCartButton.classList.contains('disabled')) {
    // If add to cart button is disabled, click it to show validation errors
    button.classList.remove('loading');
    addToCartButton.click();
  } else {
    // Set buy now flag and submit form
    const buyNowInput = form.querySelector('input[name="nasa_buy_now"]');
    if (buyNowInput) {
      // Disable AJAX add to cart
      const ajaxInput = document.querySelector('input[name="nasa-enable-addtocart-ajax"]');
      if (ajaxInput) {
        ajaxInput.value = '0';
      }
      
      // Set buy now flag
      buyNowInput.value = '1';
      
      // Submit form
      setTimeout(() => {
        addToCartButton.click();
      }, 10);
    }
  }
}

// Event Listeners
function initEventListeners() {
  // Add to cart button
  document.addEventListener('click', function(e) {
    // Single add to cart
    if (e.target.matches('form.cart button[type="submit"].single_add_to_cart_button') || 
        e.target.closest('form.cart button[type="submit"].single_add_to_cart_button')) {
      const button = e.target.matches('form.cart button[type="submit"].single_add_to_cart_button') ? 
        e.target : e.target.closest('form.cart button[type="submit"].single_add_to_cart_button');
      
      e.preventDefault();
      
      // Check if button is disabled
      if (button.classList.contains('disabled') || button.disabled) {
        console.log('Button is disabled');
        
        if (button.classList.contains('wc-variation-is-unavailable')) {
          const message = 'This variation is unavailable.';
          showNotice(message, 'error');
        } else if (button.classList.contains('wc-variation-selection-needed')) {
          const message = 'Please select some product options before adding this product to your cart.';
          showNotice(message, 'error');
        }
        return false;
      }
      
      // Close any notices
      const closeNotices = document.querySelectorAll('.nasa-close-notice');
      closeNotices.forEach(notice => notice.click());
      
      // Check if AJAX is enabled
      const form = button.closest('form.cart');
      const ajaxEnabled = form.querySelector('input[name="nasa-enable-addtocart-ajax"]');
      
      if (!ajaxEnabled || ajaxEnabled.value !== '1') return true;
      
      // Get product ID
      const productIdInput = form.querySelector('input[name="data-product_id"], input[name="product_id"], input[name="add-to-cart"]');
      const productId = productIdInput ? productIdInput.value : '';
      if (!productId || button.classList.contains('loading')) return false;
      
      // Get product data
      const productTypeInput = form.querySelector('input[name="data-type"]');
      const productType = productTypeInput ? productTypeInput.value : 'simple';
      const quantityInput = form.querySelector('.quantity input[name="quantity"]');
      const quantity = quantityInput ? quantityInput.value : '1';
      const variationId = form.querySelector('input[name="variation_id"]') ? 
        parseInt(form.querySelector('input[name="variation_id"]').value) : 0;
      
      // Get variation attributes
      const attributes = {};
      const fromWishlist = {};
      
      if (productType === 'variable' && (!variationId || variationId === 0)) {
        const message = 'Please select some product options before adding this product to your cart.';
        showNotice(message, 'error');
        return false;
      }
      
      if (variationId > 0 && form.querySelector('.variations')) {
        const variationSelects = form.querySelectorAll('.variations select[data-attribute_name], .variations select[name^="attribute_"]');
        variationSelects.forEach(select => {
          const attrName = select.name || `attribute_${select.dataset.attribute_name}`;
          attributes[attrName] = select.value;
        });
        
        // Check if from wishlist
        if (document.querySelector('.wishlist_table') && 
            document.querySelector(`.wishlist_table tr#yith-wcwl-row-${productId}`)) {
          const wishlistTable = document.querySelector('.wishlist_table');
          
          fromWishlist.from_wishlist = form.querySelector('input[name="data-from_wishlist"]') && 
            form.querySelector('input[name="data-from_wishlist"]').value === '1' ? '1' : '0';
          
          fromWishlist.wishlist_id = wishlistTable.getAttribute('data-id');
          fromWishlist.pagination = wishlistTable.getAttribute('data-pagination');
          fromWishlist.per_page = wishlistTable.getAttribute('data-per-page');
          fromWishlist.current_page = wishlistTable.getAttribute('data-page');
        }
      }
      
      // Trigger add to cart
      handleSingleAddToCart(button, productId, quantity, productType, variationId, attributes, fromWishlist);
      
      return false;
    }
    
    // Bundle add to cart
    if (e.target.matches('.nasa_bundle_add_to_cart') || 
        e.target.closest('.nasa_bundle_add_to_cart')) {
      const button = e.target.matches('.nasa_bundle_add_to_cart') ? 
        e.target : e.target.closest('.nasa_bundle_add_to_cart');
      
      e.preventDefault();
      
      const productId = button.getAttribute('data-product_id');
      if (productId) {
        const productType = button.getAttribute('data-type');
        const quantity = button.getAttribute('data-quantity');
        
        // Trigger add to cart
        handleSingleAddToCart(button, productId, quantity, productType, 0, {}, {});
      }
    }
    
    // Variation add to cart
    if (e.target.matches('.product_type_variation.add-to-cart-grid') || 
        e.target.closest('.product_type_variation.add-to-cart-grid')) {
      const button = e.target.matches('.product_type_variation.add-to-cart-grid') ? 
        e.target : e.target.closest('.product_type_variation.add-to-cart-grid');
      
      e.preventDefault();
      
      if (button.classList.contains('nasa-quick-add') && !button.classList.contains('nasa-modern-8-add')) {
        const productItem = button.closest('.product-item');
        if (productItem) {
          productItem.classList.add('nasa-modern-8-var-active');
        }
      } else if (!button.classList.contains('nasa-disable-ajax')) {
        if (!button.classList.contains('loading')) {
          const productId = button.getAttribute('data-product_id');
          if (productId) {
            const productType = 'variation';
            const quantity = button.getAttribute('data-quantity');
            let variationId = 0;
            let variationData = null;
            
            if (button.hasAttribute('data-variation_id')) {
              variationId = button.getAttribute('data-variation_id');
            }
            
            if (button.hasAttribute('data-variation')) {
              variationData = JSON.parse(button.getAttribute('data-variation'));
            }
            
            if (variationData) {
              // Trigger add to cart
              handleSingleAddToCart(button, productId, quantity, productType, variationId, variationData, {});
            } else {
              // Redirect to product page
              window.location.href = button.getAttribute('href');
            }
          }
        }
        
        return false;
      }
    }
    
    // Variable product
    if (e.target.matches('.product_type_variable') || 
        e.target.closest('.product_type_variable')) {
      const button = e.target.matches('.product_type_variable') ? 
        e.target : e.target.closest('.product_type_variable');
      
      e.preventDefault();
      
      if (document.body.classList.contains('ns-wcdfslsops')) {
        const href = button.getAttribute('href');
        if (href) {
          window.location.href = href;
        }
      } else {
        const productItem = button.closest('.product-item');
        
        if (document.body.classList.contains('nasa-quickview-on')) {
          if (!button.classList.contains('add-to-cart-grid') || 
              button.closest('.nasa-table-compare') || 
              button.closest('.compare-list') || 
              button.closest('.product-deal-special-buttons')) {
            const href = button.getAttribute('href');
            if (href) {
              window.location.href = href;
            }
            return;
          }
          
          if (button.classList.contains('btn-from-wishlist')) {
            const wishlistWrap = button.closest('.add-to-cart-wishlist');
            if (wishlistWrap && wishlistWrap.querySelector('.quick-view')) {
              wishlistWrap.querySelector('.quick-view').click();
            }
          } else if (button.classList.contains('nasa-before-click')) {
            triggerEvent(document.body, 'nasa_after_click_select_option', { button });
          } else if (button.classList.contains('nasa-quick-add') && 
                    !document.querySelector('.nasa-content-page-products .products.list')) {
            if (productItem && productItem.classList.contains('out-of-stock')) {
              const href = button.getAttribute('href');
              if (href) {
                window.location.href = href;
              }
              return;
            }
            
            triggerEvent(document.body, 'nasa_after_click_quick_add', { button });
          } else if (productItem && 
                    productItem.querySelector('.variations_form') && 
                    !document.querySelector('.nasa-content-page-products .products.list')) {
            productItem.classList.add('ns-var-active');
          } else if (productItem && productItem.querySelector('.quick-view')) {
            productItem.querySelector('.quick-view').click();
          }
          
          return false;
        }
        
        if (button.classList.contains('nasa-before-click')) {
          triggerEvent(document.body, 'nasa_after_click_select_option', { button });
          return false;
        }
        
        if (button.classList.contains('nasa-quick-add') && 
            !document.querySelector('.nasa-content-page-products .products.list')) {
          if (productItem && productItem.classList.contains('out-of-stock')) {
            const href = button.getAttribute('href');
            if (href) {
              window.location.href = href;
            }
            return;
          }
          
          triggerEvent(document.body, 'nasa_after_click_quick_add', { button });
        } else {
          if (!productItem || 
              !productItem.querySelector('.variations_form') || 
              document.querySelector('.nasa-content-page-products .products.list')) {
            const href = button.getAttribute('href');
            if (href) {
              window.location.href = href;
            }
            return;
          }
          
          productItem.classList.add('ns-var-active');
        }
      }
    }
    
    // Buy now button
    if (e.target.matches('form.cart .nasa-buy-now') || 
        e.target.closest('form.cart .nasa-buy-now')) {
      handleBuyNow(e);
    }
    
    // Close buttons
    if (e.target.matches('.black-window, .white-window, .transparent-desktop, .transparent-mobile, .transparent-window, .nasa-close-mini-compare, .nasa-sidebar-close a, .nasa-sidebar-return-shop, .login-register-close, .nasa-close-menu-mobile') || 
        e.target.closest('.black-window, .white-window, .transparent-desktop, .transparent-mobile, .transparent-window, .nasa-close-mini-compare, .nasa-sidebar-close a, .nasa-sidebar-return-shop, .login-register-close, .nasa-close-menu-mobile')) {
      closeAllOverlays();
    }
  });
  
  // Form input changes
  document.addEventListener('change', function(e) {
    // Shipping method change
    if (e.target.matches('select.shipping_method, input[name^="shipping_method"], #ship-to-different-address input, .update_totals_on_change select, .update_totals_on_change input[type="radio"], .update_totals_on_change input[type="checkbox"]')) {
      const reviewOrder = document.querySelector('.woocommerce-checkout-review-order');
      if (reviewOrder && !reviewOrder.classList.contains('processing')) {
        reviewOrder.classList.add('processing');
      }
    }
  });
  
  // Custom events
  document.body.addEventListener('nasa_update_custommer_info', function() {
    // Remove form-row class from payment fields
    const paymentFormRows = document.querySelectorAll('#payment .form-row');
    paymentFormRows.forEach(row => {
      row.classList.remove('form-row');
    });
    
    // Remove notices
    const notices = document.querySelectorAll('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-message');
    notices.forEach(notice => {
      notice.remove();
    });
    
    // Validate form
    validateCheckoutForm();
    
    // Trigger update checkout
    triggerEvent(document.body, 'update_checkout');
    
    // Update customer info
    const emailInput = document.querySelector('input[name="billing_email"]');
    const customerInfoEmail = document.querySelector('#nasa-billing-info .customer-info-email .customer-info-right');
    if (emailInput && customerInfoEmail) {
      customerInfoEmail.innerHTML = emailInput.value;
    }
  });
  
  document.body.addEventListener('updated_checkout', function() {
    const checkoutModernWrap = document.querySelector('.checkout-modern-wrap');
    if (!checkoutModernWrap) return;
    
    // Remove processing class
    const processingElements = document.querySelectorAll('.processing');
    processingElements.forEach(element => {
      element.classList.remove('processing');
    });
    
    // Update shipping methods
    updateShippingMethods();
    
    // Move additional fields
    const additionalFields = checkoutModernWrap.querySelector('.woocommerce-additional-fields');
    const shippingMethods = document.getElementById('nasa-shipping-methods');
    if (additionalFields && shippingMethods) {
      shippingMethods.after(additionalFields);
    }
    
    // Handle coupon notices
    const applyCoupon = document.body.getAttribute('data-apply-coupon') === 'true';
    if (applyCoupon) {
      cloneNoticesCoupon();
      
      // Focus coupon input if error
      const woocommerceError = document.querySelector('.woocommerce-error');
      const couponCloneWrap = document.querySelector('.coupon-clone-wrap');
      if (woocommerceError && couponCloneWrap) {
        const couponInput = couponCloneWrap.querySelector('input');
        if (couponInput) {
          couponInput.focus();
        }
      }
    }
    
    // Reset apply coupon flag
    document.body.setAttribute('data-apply-coupon', 'false');
  });
  
  // Fragments loaded
  document.body.addEventListener('wc_fragments_refreshed', function() {
    // Initialize free shipping notification
    initShippingFreeNotification(true);
    
    // Trigger mobile layout change
    triggerEvent(document.body, 'mini_cart_mobile_layout_change');
    
    // Remove loader from cart sidebar
    const cartSidebar = document.getElementById('cart-sidebar');
    if (cartSidebar) {
      const loader = cartSidebar.querySelector('.nasa-loader');
      if (loader) {
        loader.remove();
      }
    }
  });
  
  // Added to cart
  document.body.addEventListener('added_to_cart', function() {
    // Close form if exists
    const formClose = document.querySelector('form.cart .ns-form-close');
    if (formClose) {
      formClose.click();
    }
    
    // Remove loading class from buy now button
    const buyNowButton = document.querySelector('.ns_btn-fixed .single_add_to_cart_button');
    if (buyNowButton) {
      buyNowButton.classList.remove('loading');
    }
  });
}

// Close all overlays
function closeAllOverlays() {
  // Skip if age verification is active
  if (document.querySelector('#nasa-age-verification-popup-wrap.nasa-active')) return;
  
  // Check responsive state
  const isResponsiveView = isResponsive();
  const isMobileView = checkMobileDevice();
  
  // Remove desk-window class
  const blackWindow = document.querySelector('.black-window');
  if (blackWindow) {
    blackWindow.classList.remove('desk-window');
  }
  
  const transparentWindow = document.querySelector('.transparent-window');
  if (transparentWindow) {
    transparentWindow.classList.remove('desk-window');
  }
  
  const transparentMobile = document.querySelector('.transparent-mobile');
  if (transparentMobile) {
    transparentMobile.classList.remove('desk-window');
  }
  
  // Close mobile menu
  const mobileNavigation = document.getElementById('mobile-navigation');
  if (mobileNavigation && mobileNavigation.getAttribute('data-show') === '1') {
    const menuSidebar = document.getElementById('nasa-menu-sidebar-content');
    if (menuSidebar) {
      menuSidebar.classList.remove('nasa-active');
    }
    
    mobileNavigation.setAttribute('data-show', '0');
    
    setTimeout(() => {
      if (blackWindow) {
        blackWindow.classList.remove('nasa-transparent');
      }
    }, 1000);
  }
  
  // Close mobile search
  const mobileSearch = document.querySelector('.warpper-mobile-search');
  if (mobileSearch) {
    mobileSearch.classList.remove('nasa-active');
    
    if (mobileSearch.classList.contains('show-in-desk')) {
      setTimeout(() => {
        mobileSearch.classList.remove('show-in-desk');
      }, 600);
    }
  }
  
  // Close mobile cart form
  const mobileCartForm = document.querySelector('.nasa-single-product-in-mobile form.cart.variations_form.ns-show .ns-form-close');
  if (mobileCartForm) {
    if (!document.querySelector('.nasa-single-product-in-mobile .nasa-node-content.ns-actived')) {
      mobileCartForm.click();
    } else if (blackWindow) {
      blackWindow.classList.add('desk-window');
    }
  }
  
  // Close review form
  const reviewForm = document.querySelector('#review_form_wrapper.ns-show .ns-form-close');
  if (reviewForm) {
    reviewForm.click();
  }
  
  // Close node content
  const nodeContent = document.querySelector('.nasa-node-content.ns-actived .ns-node-close');
  if (nodeContent) {
    nodeContent.click();
  }
  
  // Close 360 degree view
  const product360 = document.querySelector('.nasa-product-360-degree.ns-actived');
  if (product360) {
    const close360 = product360.querySelector('.close-360-degree');
    if (close360) {
      close360.click();
    }
  }
  
  // Close exit intent popup
  const exitIntentClose = document.querySelector('.nasa-popup-exit-intent-wrap .nasa-popup-exit-intent-close');
  if (exitIntentClose) {
    exitIntentClose.click();
  }
  
  // Close promo popup
  const promoPopupClose = document.querySelector('.nasa-promo-popup-wrap .nasa-popup-close');
  if (promoPopupClose) {
    promoPopupClose.click();
  }
  
  // Close sidebar
  const sidebar = document.querySelector('.col-sidebar');
  if (sidebar) {
    sidebar.classList.remove('nasa-active');
  }
  
  // Close account nav
  const accountNav = document.querySelector('.account-nav-wrap');
  if (accountNav) {
    accountNav.classList.remove('nasa-active');
  }
  
  // Close dokan store sidebar
  const dokanSidebar = document.querySelector('.dokan-store-sidebar');
  if (dokanSidebar) {
    dokanSidebar.classList.remove('nasa-active');
  }
  
  // Close cart popup
  const cartPopup = document.querySelector('.ns-cart-popup-wrap');
  if (cartPopup && cartPopup.classList.contains('nasa-active')) {
    const popupClose = cartPopup.querySelector('.popup-cart-close');
    if (popupClose) {
      popupClose.click();
    }
  }
  
  // Close cart sidebar
  const cartSidebar = document.getElementById('cart-sidebar');
  if (cartSidebar) {
    cartSidebar.classList.remove('nasa-active');
    
    const closeNodes = cartSidebar.querySelector('.close-nodes');
    if (closeNodes) {
      closeNodes.click();
    }
  }
  
  // Close wishlist sidebar
  const wishlistSidebar = document.getElementById('nasa-wishlist-sidebar');
  if (wishlistSidebar) {
    wishlistSidebar.classList.remove('nasa-active');
  }
  
  // Close viewed sidebar
  const viewedSidebar = document.getElementById('nasa-viewed-sidebar');
  if (viewedSidebar) {
    viewedSidebar.classList.remove('nasa-active');
  }
  
  // Close quickview sidebar
  const quickviewSidebar = document.getElementById('nasa-quickview-sidebar');
  if (quickviewSidebar) {
    quickviewSidebar.classList.remove('nasa-active');
  }
  
  // Close quickview popup
  const quickviewPopup = document.getElementById('nasa-quickview-popup');
  if (quickviewPopup) {
    const quickviewClose = quickviewPopup.querySelector('.nasa-quickview-popup-close');
    if (quickviewClose) {
      quickviewClose.click();
    }
  }
  
  // Close category filter
  const categoryFilter = document.querySelector('.nasa-top-cat-filter-wrap-mobile');
  if (categoryFilter) {
    categoryFilter.classList.remove('nasa-show');
  }
  
  // Close side sidebar
  const sideSidebar = document.querySelector('.nasa-side-sidebar');
  if (sideSidebar) {
    sideSidebar.classList.remove('nasa-show');
  }
  
  // Close top sidebar
  const topSidebar = document.querySelector('.nasa-top-sidebar');
  if (topSidebar) {
    topSidebar.classList.remove('nasa-active');
  }
  
  // Close login register
  const loginRegister = document.querySelector('.nasa-login-register-warper');
  if (loginRegister) {
    loginRegister.classList.remove('nasa-active');
    
    if (loginRegister.querySelector('.nasa-congrat')) {
      window.location.reload();
    }
    
    setTimeout(() => {
      loginRegister.style.display = 'none';
    }, 350);
  }
  
  // Close language selector
  const currentLang = document.querySelector('.nasa-current-lang');
  if (currentLang) {
    const langSelector = currentLang.closest('.nasa-select-languages');
    if (langSelector) {
      langSelector.classList.remove('nasa-active');
    }
  }
  
  // Close currency selector
  const currencyToggle = document.querySelector('.wcml-cs-item-toggle');
  if (currencyToggle) {
    const currencySelector = currencyToggle.closest('.nasa-select-currencies');
    if (currencySelector) {
      currencySelector.classList.remove('nasa-active');
    }
  }
  
  // Close login form
  const checkoutLogin = document.querySelector('.checkout-modern-wrap .woocommerce-form-login');
  if (checkoutLogin && checkoutLogin.classList.contains('nasa-active')) {
    const loginToggle = document.querySelector('.checkout-modern-wrap .woocommerce-form-login-toggle .showlogin');
    if (loginToggle) {
      loginToggle.click();
    }
  }
  
  // Close category filter
  const pushCatFilter = document.querySelector('.nasa-push-cat-filter-type-3 .ns-top-bar-side-canvas');
  if (pushCatFilter && pushCatFilter.classList.contains('nasa-push-cat-show')) {
    const filterTopbar = document.querySelector('.nasa-top-bar-3-content a.nasa-tab-filter-topbar');
    if (filterTopbar) {
      filterTopbar.click();
    }
  }
  
  // Hide compare
  hideCompare();
  
  // Remove body classes
  document.body.classList.remove('ovhd', 'm-ovhd');
  
  // Trigger after close event
  triggerEvent(document.body, 'nasa_after_close_fog_window');
  
  // Fade out windows
  if (!document.querySelector('.nasa-mobile-app form.cart.variations_form.ns-show')) {
    const windows = document.querySelectorAll('.white-window, .transparent-mobile, .transparent-window, .transparent-desktop');
    windows.forEach(window => {
      fadeOut(window, 1000);
    });
    
    if (blackWindow) {
      fadeOut(blackWindow, 500);
    }
  }
}

// Helper function to fade out an element
function fadeOut(element, duration) {
  element.style.opacity = 1;
  
  const start = performance.now();
  
  function animate(time) {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    
    element.style.opacity = 1 - progress;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      element.style.display = 'none';
    }
  }
  
  requestAnimationFrame(animate);
}

// Hide compare
function hideCompare() {
  const compareTable = document.querySelector('.nasa-compare-list-bottom');
  if (!compareTable) return;
  
  compareTable.classList.remove('nasa-active');
}

// Clone notices for coupon
function cloneNoticesCoupon() {
  const couponCloneWrap = document.querySelector('.coupon-clone-wrap');
  const notices = document.querySelectorAll('.woocommerce-error, .woocommerce-message');
  
  if (!couponCloneWrap || !notices.length) return;
  
  notices.forEach(notice => {
    couponCloneWrap.after(notice);
    notice.style.display = 'block';
  });
}

// Validate checkout form
function validateCheckoutForm() {
  // Implement form validation logic here
  console.log('Validating checkout form');
}

// Initialize on DOM ready
domReady(() => {
  // Set cookie live time
  const cookieTimeInput = document.querySelector('input[name="nasa-cookie-time"]');
  if (cookieTimeInput) {
    COOKIE_LIVE = parseInt(cookieTimeInput.value);
  }
  
  // Reset shipping percentage cookie
  setCookie('nasa_curent_per_shipping', 0, COOKIE_LIVE);
  
  // Remove loading screen
  const loader = document.getElementById('nasa-before-load');
  if (loader) {
    fadeOut(loader, 100);
  }
  
  // Add ready class to html
  const html = document.documentElement;
  if (!html.classList.contains('html-ready') && !document.querySelector('.gpnf-nested-form')) {
    html.classList.add('html-ready');
  }
  
  // Remove loading class from body
  document.body.classList.remove('crazy-loading');
  
  // Initialize checkout page
  initCheckoutPage();
  
  // Initialize event listeners
  initEventListeners();
  
  // Handle hash navigation
  if (window.location.hash) {
    handleHashNavigation(window.location.hash);
  }
});

// Handle hash navigation
function handleHashNavigation(hash) {
  // Find elements with matching hash
  const hashLinks = document.querySelectorAll(`a[href="${hash}"], a[data-id="${hash}"], a[data-target="${hash}"]`);
  if (hashLinks.length) {
    setTimeout(() => {
      hashLinks[0].click();
    }, 500);
  }
  
  // Find element with matching ID
  const hashElement = document.querySelector(hash);
  if (hashElement) {
    if (hashElement.closest('#comments') || hash === '#comments') {
      const reviewLink = document.querySelector('.woocommerce-review-link');
      if (reviewLink) {
        const reviewsTab = document.querySelector('.ns-tab-item .nasa-content-reviews');
        const tabItem = reviewsTab ? reviewsTab.closest('.ns-tab-item') : null;
        
        if (tabItem) {
          tabItem.style.maxHeight = 'fit-content';
          
          setTimeout(() => {
            reviewLink.click();
            tabItem.style.removeProperty('max-height');
          }, 10);
        }
      }
    }
    
    setTimeout(() => {
      const reviewsTab = document.querySelector('.ns-tab-reviews');
      if (reviewsTab) {
        const readMoreBtn = reviewsTab.querySelector('.ns-btn-read-more');
        if (readMoreBtn) {
          readMoreBtn.click();
        }
      }
      
      scrollToElement(hashElement, 500);
    }, 1000);
  }
  
  // Handle section links
  const hashName = hash.replace('#', '');
  const sectionLink = document.querySelector(`a[data-index="nasa-section-${hashName}"]`);
  if (sectionLink) {
    setTimeout(() => {
      sectionLink.click();
    }, 500);
  }
  
  const section = document.querySelector(`.nasa-section-${hashName}`);
  if (section) {
    setTimeout(() => {
      scrollToElement(section, 500);
    }, 1000);
  }
}

// Scroll to element
function scrollToElement(element, duration = 500) {
  const start = window.pageYOffset;
  const target = element.getBoundingClientRect().top + window.pageYOffset;
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeInOutQuad = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    window.scrollTo(0, start + (target - start) * easeInOutQuad);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
}
