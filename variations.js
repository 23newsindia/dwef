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
      // Check for initial variation
      this.onAttributeChange();
    } else {
      // Store default button text
      this.addToCartButton.dataset.defaultText = this.addToCartButton.textContent;
    }
  }

  onAttributeChange() {
    const attributes = this.getChosenAttributes();
    
    // Debug logging
    console.log('Attribute change detected:', {
      attributes: attributes.data,
      count: attributes.count,
      chosenCount: attributes.chosenCount,
      variationData: this.variationData.length > 0 ? 'Available' : 'Using AJAX'
    });

    if (attributes.count === attributes.chosenCount && attributes.chosenCount > 0) {
      if (this.useAjax) {
        console.log('Using AJAX to get variation');
        this.getMatchingVariationFromServer(attributes.data);
      } else {
        console.log('Finding variation from local data');
        this.findMatchingVariation(attributes.data);
      }
    } else {
      console.log('Not all attributes selected, resetting');
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
      // Use the actual attribute name from data-attribute_name
      const attributeName = field.dataset.attribute_name;
      const value = field.value || '';
      
      // Only count fields that have options (are actual variation attributes)
      const hasOptions = field.options && field.options.length > 1; // More than just placeholder
      
      if (hasOptions && attributeName) {
        count++;
        if (value.length > 0) {
          chosenCount++;
        }
        
        // Store with the correct attribute key format
        data[`attribute_${attributeName}`] = value;
      }
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
    console.log('Looking for variation with attributes:', attributes);
    console.log('Available variations:', this.variationData);
    
    const matchingVariation = this.variationData.find(variation => {
      console.log('Checking variation:', variation);
      return Object.entries(variation.attributes).every(([name, value]) => {
        // The name from variation.attributes is already the clean attribute name (e.g., 'pa_size')
        const attributeKey = `attribute_${name}`;
        const currentValue = attributes[attributeKey];
        
        console.log(`Checking attribute ${name}:`, {
          variationValue: value,
          currentValue: currentValue,
          attributeKey: attributeKey,
          availableAttributes: Object.keys(attributes)
        });
        
        // If no value selected for this attribute, skip this variation
        if (!currentValue) {
          console.log(`No value selected for ${name}, skipping variation`);
          return false;
        }
        
        // If variation allows any value (empty string) or matches exactly
        const matches = value === '' || currentValue === value;
        console.log(`Attribute ${name} matches:`, matches);
        return matches;
      });
    });

    console.log('Matching variation found:', matchingVariation);
    
    if (matchingVariation) {
      this.foundVariation(matchingVariation);
    } else {
      this.resetVariationData();
    }
  }

  foundVariation(variation) {
    console.log('Found variation:', variation);
    
    requestAnimationFrame(() => {
      // Update variation ID
      this.variationIdInput.value = variation.variation_id || variation.id;

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
      console.log('Variation purchasable:', purchasable);
      this.toggleAddToCart(purchasable);
      
      // Update button text if variation has custom text
      if (variation.add_to_cart_text) {
        this.addToCartButton.textContent = variation.add_to_cart_text;
      }

      // Show variation details
      this.singleVariation.style.display = 'block';
      this.form.classList.add('variation-selected');
    });
  }

  resetVariationData() {
    console.log('Resetting variation data');
    this.variationIdInput.value = '';
    this.singleVariation.innerHTML = '';
    this.singleVariation.style.display = 'none';
    this.toggleAddToCart(false);
    this.form.classList.remove('variation-selected');
    
    // Reset button text to default
    const defaultText = this.addToCartButton.dataset.defaultText || 'Add to cart';
    this.addToCartButton.textContent = defaultText;
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
    console.log('Toggle add to cart:', enable);
    if (enable) {
      this.addToCartButton.classList.remove('disabled', 'wc-variation-selection-needed');
      this.addToCartButton.classList.remove('wc-variation-is-unavailable');
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
    console.log('Reset button clicked');

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
    
    console.log('Updating attribute values for:', attributes);

    this.attributeFields.forEach(field => {
      const currentValue = field.value;
      const attributeName = field.dataset.attribute_name;
      
      if (!attributeName) return;

      // Skip if this is the attribute being changed
      const attributeKey = `attribute_${attributeName}`;
      if (attributes.data[attributeKey] === currentValue) {
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
          // Extract the clean attribute name from the key (remove 'attribute_' prefix)
          const cleanName = name.replace('attribute_', '');
          if (cleanName === attributeName) return true;
          if (!value) return true;
          return variation.attributes[cleanName] === value;
        });
      })
      .map(variation => variation.attributes[attributeName]);
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

      console.log('Add to cart button clicked');
      console.log('Button classes:', addToCartBtn.className);
      console.log('Button disabled:', addToCartBtn.disabled);
      
      e.preventDefault();

      if (addToCartBtn.classList.contains('disabled') || addToCartBtn.classList.contains('nasa-ct-disabled')) {
        console.log('Button is disabled');
        if (addToCartBtn.classList.contains('wc-variation-is-unavailable')) {
          const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
            wc_add_to_cart_variation_params.i18n_unavailable_text : 
            'This variation is unavailable.';
          window.alert(message);
        } else if (addToCartBtn.classList.contains('wc-variation-selection-needed')) {
          const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
            wc_add_to_cart_variation_params.i18n_make_a_selection_text : 
            'Please select some product options before adding this product to your cart.';
          window.alert(message);
        }
        return;
      }

      const form = addToCartBtn.closest('form.cart');
      if (!form) {
        console.log('No form found');
        return;
      }
      
      console.log('Processing add to cart for form');

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
    console.log('handleAddToCart called');
    
    // Get form data exactly like WooCommerce expects - try multiple selectors
    const productIdInput = form.querySelector('input[name="product_id"]') || 
                          form.querySelector('input[name="add-to-cart"]') ||
                          form.querySelector('[name="data-product_id"]');
    const variationIdInput = form.querySelector('input[name="variation_id"]') || 
                            form.querySelector('.variation_id') ||
                            form.querySelector('input.variation_id');
    const quantityInput = form.querySelector('input[name="quantity"]') || 
                         form.querySelector('.qty') ||
                         form.querySelector('input.qty');
    
    const productId = productIdInput ? productIdInput.value : '';
    const variationId = variationIdInput ? variationIdInput.value : '';
    const quantity = quantityInput ? quantityInput.value : '1';

    console.log('Form inputs found:', {
      productIdInput: !!productIdInput,
      variationIdInput: !!variationIdInput,
      quantityInput: !!quantityInput,
      productId,
      variationId,
      quantity
    });
    
    // Validate required data
    if (!productId) {
      console.error('Product ID not found');
      button.classList.remove('loading');
      return;
    }
    
    // For variable products, variation ID is required
    if (form.classList.contains('variations_form') && (!variationId || variationId === '0')) {
      console.error('Variation ID required but not found');
      const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
        wc_add_to_cart_variation_params.i18n_make_a_selection_text : 
        'Please select some product options before adding this product to your cart.';
      window.alert(message);
      button.classList.remove('loading');
      return;
    }

    // Collect all variation attributes - be more thorough
    const variations = {};
    
    // Get attributes from select elements
    form.querySelectorAll('select[name^="attribute_"], select[data-attribute_name]').forEach(select => {
      if (select.value) {
        const attrName = select.name || `attribute_${select.dataset.attribute_name}`;
        variations[attrName] = select.value;
        console.log('Variation select:', attrName, '=', select.value);
      }
    });
    
    // Get attributes from hidden inputs
    form.querySelectorAll('input[name^="attribute_"]').forEach(input => {
      if (input.value) {
        variations[input.name] = input.value;
        console.log('Variation input:', input.name, '=', input.value);
      }
    });

    console.log('Final product data:', { productId, variationId, quantity, variations });

    button.classList.add('loading');

    try {
      // Try to get the exact same data that would be sent by a normal form submission
      const formData = new FormData(form);
      
      // Ensure required fields are present
      if (!formData.has('product_id') && !formData.has('add-to-cart')) {
        formData.set('product_id', productId);
      }
      
      if (!formData.has('quantity')) {
        formData.set('quantity', quantity);
      }
      
      if (variationId && !formData.has('variation_id')) {
        formData.set('variation_id', variationId);
      }
      
      // Convert FormData to URLSearchParams for logging and sending
      const urlParams = new URLSearchParams();
      for (const [key, value] of formData.entries()) {
        urlParams.append(key, value);
      }
      
      console.log('Sending form data:', Object.fromEntries(urlParams));

      // Get AJAX URL
      const ajaxUrl = typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.wc_ajax_url ? 
        wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'add_to_cart') :
        '/wp-admin/admin-ajax.php?action=wc_add_to_cart';
        
      const response = await fetch(ajaxUrl, {
        method: 'POST',
        body: urlParams,
        credentials: 'same-origin'
      });

      // Handle both JSON and HTML responses
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If HTML response, it might be an error page or redirect
        const text = await response.text();
        console.log('Non-JSON response received:', text.substring(0, 500));
        
        // Check if it's a WooCommerce error
        if (text.includes('woocommerce-error') || text.includes('Please choose product options')) {
          throw new Error('Please choose product options before adding to cart');
        }
        
        // If response is not JSON, treat as error
        throw new Error('Invalid server response');
      }

      // Handle response like WooCommerce does
      if (!data) {
        console.log('Empty response from server');
        button.classList.remove('loading');
        return;
      }
      
      console.log('Server response:', data);
      
      if (data.error && data.product_url) {
        console.log('Server error with redirect URL:', data.product_url);
        window.location = data.product_url;
        return;
      }
      
      if (data.error) {
        throw new Error(data.data || data.message || 'Server returned an error');
      }

      // Redirect to cart option
      if (typeof wc_add_to_cart_params !== 'undefined' && 
          wc_add_to_cart_params.cart_redirect_after_add === 'yes') {
        window.location = wc_add_to_cart_params.cart_url;
        return;
      }

      // Update fragments if available
      if (data.fragments) {
        this.updateCartFragments(data.fragments);
      }

      // Update button state
      button.classList.add('added');
      button.classList.remove('loading');

      // Trigger added_to_cart event like WooCommerce does
      const addedEvent = new CustomEvent('added_to_cart', {
        detail: [data.fragments, data.cart_hash, button],
        bubbles: true
      });
      document.body.dispatchEvent(addedEvent);
      
      // Open cart sidebar after successful add
      this.openCartSidebar();
      
    } catch (error) {
      console.error('Add to cart error:', error);
      button.classList.remove('loading');
      
      // Show error message
      const errorMessage = error.message || 
        (typeof wc_add_to_cart_params !== 'undefined' ? wc_add_to_cart_params.i18n_error_message : 'Error adding to cart');
      window.alert(errorMessage);
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
