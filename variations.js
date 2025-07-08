class VariationForm {
  constructor(form) {
    this.form = form;
    this.variationData = JSON.parse(form.dataset.product_variations || '[]');
    this.useAjax = !this.variationData.length;
    this.xhr = null;

    // Elements
    this.resetVariations = form.querySelector('.reset_variations');
    this.addToCartButton = form.querySelector('.single_add_to_cart_button');
    this.variationIdInput = form.querySelector('.variation_id');
    this.attributeFields = form.querySelectorAll('select[data-attribute_name]');
    this.singleVariationWrap = form.querySelector('.single_variation_wrap');
    this.singleVariation = form.querySelector('.single_variation');

    this.initializeEvents();
    this.init();
  }

  initializeEvents() {
    // Handle attribute changes
    this.attributeFields.forEach(field => {
      field.addEventListener('change', () => this.onAttributeChange());
    });

    // Handle NASA attribute UX clicks
    this.form.querySelectorAll('.nasa-attr-ux').forEach(attr => {
      attr.addEventListener('click', (e) => {
        e.preventDefault();
        const wrap = attr.closest('.nasa-attr-ux_wrap');
        if (!wrap) return;

        const select = this.form.querySelector(`select[data-attribute_name="${wrap.dataset.attribute_name}"]`);
        if (!select) return;

        // If already selected, deselect
        if (attr.classList.contains('selected')) {
          select.value = '';
          attr.classList.remove('selected');
        } else {
          // Remove selected class from siblings
          wrap.querySelectorAll('.nasa-attr-ux').forEach(sib => {
            sib.classList.remove('selected');
          });
          // Select new value
          select.value = attr.dataset.value;
          attr.classList.add('selected');
        }

        // Trigger change event
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // Handle reset button
    if (this.resetVariations) {
      this.resetVariations.addEventListener('click', (e) => this.onReset(e));
    }
  }

  init() {
    // Show reset link if variations are selected
    const hasInitialValues = Array.from(this.attributeFields).some(field => field.value);
    if (hasInitialValues) {
      this.toggleResetLink(true);
    }

    // Initial check
    this.onAttributeChange();
  }

  onAttributeChange() {
    const attributes = this.getChosenAttributes();

    if (attributes.count === attributes.chosenCount) {
      if (this.useAjax) {
        this.getMatchingVariationFromServer(attributes.data);
      } else {
        this.findMatchingVariation(attributes.data);
      }
    } else {
      this.resetVariationData();
    }

    this.updateAttributeValues(attributes);
    this.toggleResetLink(attributes.chosenCount > 0);
  }

  getChosenAttributes() {
    const data = {};
    let count = 0;
    let chosenCount = 0;

    this.attributeFields.forEach(field => {
      const name = field.dataset.attribute_name || field.name;
      const value = field.value || '';

      if (value.length > 0) {
        chosenCount++;
      }

      count++;
      data[name] = value;
    });

    return {
      count,
      chosenCount,
      data
    };
  }

  async getMatchingVariationFromServer(attributes) {
    if (this.xhr) {
      this.xhr.abort();
    }

    try {
      this.form.classList.add('loading');
      const formData = new FormData();
      formData.append('product_id', this.form.dataset.product_id);
      Object.entries(attributes).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const response = await fetch(wc_add_to_cart_variation_params.wc_ajax_url.replace('%%endpoint%%', 'get_variation'), {
        method: 'POST',
        body: formData
      });

      const variation = await response.json();
      if (variation) {
        this.foundVariation(variation);
      } else {
        this.resetVariationData();
      }
    } catch (error) {
      console.error('Error fetching variation:', error);
      this.resetVariationData();
    } finally {
      this.form.classList.remove('loading');
    }
  }

  findMatchingVariation(attributes) {
    const matchingVariation = this.variationData.find(variation => {
      return Object.entries(variation.attributes).every(([name, value]) => {
        const currentValue = attributes[`attribute_${name}`];
        return !currentValue || value === '' || currentValue === value;
      });
    });

    if (matchingVariation) {
      this.foundVariation(matchingVariation);
    } else {
      this.resetVariationData();
    }
  }

  foundVariation(variation) {
    requestAnimationFrame(() => {
      // Update variation ID
      this.variationIdInput.value = variation.variation_id;

      // Update price HTML if provided
      if (variation.price_html) {
        this.singleVariation.innerHTML = variation.price_html;
      }

      // Update availability
      const availabilityHtml = variation.availability_html || '';
      const availabilityElement = this.form.querySelector('.woocommerce-variation-availability');
      if (availabilityElement) {
        availabilityElement.innerHTML = availabilityHtml;
      }

     // COMMENT OUT OR REMOVE THIS BLOCK TO PREVENT IMAGE CHANGES
    // Update images if gallery support exists
    // if (variation.image && variation.image.src) {
    //   this.updateProductImage(variation.image);
    // }

      // Enable/disable add to cart button
      const purchasable = variation.is_purchasable && variation.is_in_stock && variation.variation_is_visible;
      this.toggleAddToCart(purchasable);

      // Show variation details
      this.singleVariation.style.display = 'block';
      this.form.classList.add('variation-selected');
    });
  }

  resetVariationData() {
    this.variationIdInput.value = '';
    this.singleVariation.innerHTML = '';
    this.toggleAddToCart(false);
    this.form.classList.remove('variation-selected');
  }

  updateProductImage(image) {
    const galleryWrapper = document.querySelector('.woocommerce-product-gallery');
    if (galleryWrapper) {
      galleryWrapper.querySelectorAll('img').forEach(img => {
        img.src = image.src;
        img.srcset = image.srcset || '';
        img.sizes = image.sizes || '';
        img.alt = image.alt || '';
      });
    }
  }

  toggleAddToCart(enable) {
    if (enable) {
      this.addToCartButton.classList.remove('disabled', 'wc-variation-selection-needed');
      this.addToCartButton.disabled = false;
    } else {
      this.addToCartButton.classList.add('disabled', 'wc-variation-selection-needed');
      this.addToCartButton.disabled = true;
    }
  }

  toggleResetLink(show) {
    if (this.resetVariations) {
      this.resetVariations.style.visibility = show ? 'visible' : 'hidden';
    }
  }

  onReset(e) {
    e.preventDefault();

    // Reset select fields
    this.attributeFields.forEach(field => {
      field.value = '';
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Reset NASA attribute UX
    this.form.querySelectorAll('.nasa-attr-ux').forEach(attr => {
      attr.classList.remove('selected');
    });

    this.resetVariationData();
    this.toggleResetLink(false);
  }

  updateAttributeValues(attributes) {
    if (this.useAjax) return;

    this.attributeFields.forEach(field => {
      const currentValue = field.value;
      const attributeName = field.dataset.attribute_name;

      // Skip if this is the attribute being changed
      if (attributes.data[attributeName] === currentValue) {
        return;
      }

      // Find available variations for this attribute
      const availableOptions = this.findAvailableOptions(attributeName, attributes.data);

      // Update select options
      Array.from(field.options).forEach(option => {
        if (!option.value) return; // Skip placeholder option
        const isAvailable = availableOptions.includes(option.value);
        option.disabled = !isAvailable;
      });

      // Update NASA attribute UX
      const nasaWrapper = this.form.querySelector(`.nasa-attr-ux_wrap[data-attribute_name="${attributeName}"]`);
      if (nasaWrapper) {
        nasaWrapper.querySelectorAll('.nasa-attr-ux').forEach(attr => {
          const isAvailable = availableOptions.includes(attr.dataset.value);
          attr.classList.toggle('disabled-attr', !isAvailable);
          attr.style.opacity = isAvailable ? '1' : '0.5';
        });
      }
    });
  }

  findAvailableOptions(attributeName, selectedAttributes) {
    return this.variationData
      .filter(variation => {
        return Object.entries(selectedAttributes).every(([name, value]) => {
          if (name === attributeName) return true;
          if (!value) return true;
          return variation.attributes[name.replace('attribute_', '')] === value;
        });
      })
      .map(variation => variation.attributes[attributeName.replace('attribute_', '')]);
  }
}

// Cart Handler
class CartManager {
  constructor() {
    if (CartManager.instance) {
      return CartManager.instance;
    }
    CartManager.instance = this;
    this.init();
    this.initCartPersistence();
  }

  init() {
    // Handle cart sidebar open/close
    this.initCartSidebar();

    // Handle remove items
    this.initRemoveItems();

    // Handle add to cart
    this.initAddToCart();
  }

  initAddToCart() {
    document.addEventListener('click', (e) => {
      const addToCartBtn = e.target.closest('.single_add_to_cart_button');
      if (!addToCartBtn) return;

      e.preventDefault();

      if (addToCartBtn.classList.contains('disabled') || addToCartBtn.classList.contains('nasa-ct-disabled')) {
        if (addToCartBtn.classList.contains('wc-variation-is-unavailable')) {
          window.alert(wc_add_to_cart_variation_params.i18n_unavailable_text);
        } else if (addToCartBtn.classList.contains('wc-variation-selection-needed')) {
          window.alert(wc_add_to_cart_variation_params.i18n_make_a_selection_text);
        }
        return;
      }

      const form = addToCartBtn.closest('form.cart');
      if (!form) return;

      this.handleAddToCart(form, addToCartBtn);
    });
  }

  initCartPersistence() {
    window.addEventListener('load', () => this.refreshCartFragments());
    setInterval(() => this.refreshCartFragments(), 30000); // Every 30 seconds
  }

  async refreshCartFragments() {
    try {
      const response = await fetch(wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'get_refreshed_fragments'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data && data.fragments) {
        this.updateCartFragments(data.fragments);
        this.updateCartCount(data.fragments);

        if (data.cart_hash) {
          sessionStorage.setItem(wc_cart_fragments_params.cart_hash_key, data.cart_hash);
        }
      }
    } catch (error) {
      console.error('Error refreshing cart fragments:', error);
    }
  }

  updateCartCount(fragments) {
    const cartCountElements = document.querySelectorAll('.nasa-cart-count, .cart-number');
    if (!cartCountElements.length) return;

    let count = '0';

    if (fragments && fragments['.cart-items-count']) {
      count = fragments['.cart-items-count'];
    }

    cartCountElements.forEach(element => {
      element.textContent = count;

      if (count === '0') {
        element.classList.add('nasa-product-empty', 'hidden-tag');
      } else {
        element.classList.remove('nasa-product-empty', 'hidden-tag');
      }
    });

    const cartSidebar = document.getElementById('cart-sidebar');
    if (cartSidebar) {
      cartSidebar.classList.toggle('nasa-cart-empty', count === '0');
    }
  }

  initCartSidebar() {
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.cart-close.nasa-sidebar-close a, .nasa-sidebar-close a, .cart-sidebar-close, .nasa-close-mini-cart');
      const blackWindow = e.target.closest('.black-window');

      if (closeBtn || blackWindow) {
        e.preventDefault();
        this.closeCartSidebar();
      }
    });

    document.addEventListener('click', (e) => {
      const cartBtn = e.target.closest('.cart-link.mini-cart');
      if (cartBtn) {
        e.preventDefault();
        this.openCartSidebar();
      }
    });
  }

  openCartSidebar() {
    document.documentElement.classList.add('nasa-minicart-shown');
    document.documentElement.classList.remove('nasa-minicart-hidden');
    const cartSidebar = document.getElementById('cart-sidebar');
    const blackWindow = document.querySelector('.black-window');

    if (cartSidebar) {
      cartSidebar.classList.add('nasa-active');
    }

    if (blackWindow) {
      blackWindow.classList.add('desk-window');
      blackWindow.style.display = 'block';
    }

    document.body.classList.add('nasa-minicart-active');
    document.body.classList.add('m-ovhd');
  }

  closeCartSidebar() {
    document.documentElement.classList.remove('nasa-minicart-shown');
    document.documentElement.classList.add('nasa-minicart-hidden');
    const cartSidebar = document.getElementById('cart-sidebar');
    const blackWindow = document.querySelector('.black-window');

    if (cartSidebar) {
      cartSidebar.classList.remove('nasa-active');
    }

    if (blackWindow) {
      blackWindow.classList.remove('desk-window');
      blackWindow.style.display = 'none';
    }

    document.body.classList.remove('nasa-minicart-active');
    document.body.classList.remove('m-ovhd');
  }

  initRemoveItems() {
    document.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.remove_from_cart_button, .item-in-cart .nasa-stclose.small');
      if (!removeBtn) return;

      e.preventDefault();
      e.stopPropagation();

      await this.removeCartItem(removeBtn);
    });
  }

  async removeCartItem(button) {
    const cartItem = button.closest('.woocommerce-mini-cart-item, .item-in-cart');
    if (!cartItem) return;

    cartItem.style.opacity = '0.6';
    cartItem.style.pointerEvents = 'none';

    try {
      const cartItemKey = button.dataset.cart_item_key ||
        cartItem.querySelector('.remove_from_cart_button')?.dataset.cart_item_key;

      if (!cartItemKey) {
        throw new Error('Cart item key not found');
      }

      const response = await fetch(wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'remove_from_cart'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          cart_item_key: cartItemKey,
          security: wc_add_to_cart_params.nonce
        })
      });

      const data = await response.json();

      if (data && data.fragments) {
        this.updateCartFragments(data.fragments);

        const miniCartItems = document.querySelectorAll('#cart-sidebar .woocommerce-mini-cart-item');
        if (miniCartItems.length === 0) {
          this.closeCartSidebar();
        }
      }
    } catch (error) {
      console.error('Error removing item:', error);
      cartItem.style.opacity = '';
      cartItem.style.pointerEvents = '';
    }
  }

  async handleAddToCart(form, button) {
    const productId = form.querySelector('input[name="product_id"]').value;
    const variationId = form.querySelector('input[name="variation_id"]')?.value;
    const quantity = form.querySelector('input[name="quantity"]').value;
    const variations = {};

    form.querySelectorAll('.variations select').forEach(select => {
      variations[select.name] = select.value;
    });

    button.classList.add('loading');

    try {
      const formData = new FormData();
      formData.append('product_id', productId);
      formData.append('quantity', quantity);
      formData.append('security', wc_add_to_cart_params.nonce);

      if (variationId) {
        formData.append('variation_id', variationId);
        Object.entries(variations).forEach(([name, value]) => {
          formData.append(name, value);
        });
      }

      const response = await fetch(wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'add_to_cart'), {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message);
      }

      if (data.fragments) {
        this.updateCartFragments(data.fragments);
      }

      button.classList.add('added');
      button.classList.remove('loading');

      const cartSidebar = document.getElementById('cart-sidebar');
      const blackWindow = document.querySelector('.black-window');

      if (cartSidebar) {
        cartSidebar.classList.add('nasa-active');
      }

      if (blackWindow) {
        blackWindow.classList.add('desk-window');
      }

      document.body.classList.add('nasa-minicart-active');
    } catch (error) {
      console.error('Add to cart error:', error);
      button.classList.remove('loading');
      window.alert(error.message || wc_add_to_cart_params.i18n_error_message);
    }
  }

  updateCartFragments(fragments) {
    requestAnimationFrame(() => {
      document.body.classList.add('nasa-cart-loading');

      Object.entries(fragments).forEach(([selector, content]) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.outerHTML = content;
        });
      });

      setTimeout(() => {
        document.body.classList.remove('nasa-cart-loading');
      }, 300);
    });

    this.updateCartCount(fragments);

    if (window.sessionStorage) {
      sessionStorage.setItem(wc_cart_fragments_params.fragment_name, JSON.stringify(fragments));
      sessionStorage.setItem('wc_cart_created', (new Date()).getTime());
    }
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.variations_form').forEach(form => {
    new VariationForm(form);
  });

  new CartManager();
});
