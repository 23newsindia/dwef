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
    this.attributeFields = form.querySelectorAll('select[data-attribute_name], select[name^="attribute_"]');
    this.singleVariationWrap = form.querySelector('.single_variation_wrap');
    this.singleVariation = form.querySelector('.single_variation');

    // Store original button text
    if (this.addToCartButton) {
      this.addToCartButton.dataset.originalText = this.addToCartButton.textContent;
    }

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
        console.log('NASA attr clicked:', attr.dataset.value);
        
        const wrap = attr.closest('.nasa-attr-ux_wrap');
        if (!wrap) return;

        const attributeName = wrap.dataset.attribute_name; // This should be like "attribute_pa_size"
        console.log('Attribute name from wrap:', attributeName);
        
        const select = this.form.querySelector(`select[data-attribute_name="${attributeName}"], select[name="${attributeName}"]`);
        console.log('Found select:', select);
        
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

        console.log('Select value set to:', select.value);
        
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
      this.onAttributeChange();
    } else {
      // Initially disable the button for variable products
      this.toggleAddToCart(false);
    }

    // Update NASA attribute UX to match select values
    this.syncNasaAttributeUX();
  }

  syncNasaAttributeUX() {
    this.attributeFields.forEach(field => {
      const fullAttributeName = field.dataset.attribute_name || field.name;
      const nasaWrapper = this.form.querySelector(`.nasa-attr-ux_wrap[data-attribute_name="${fullAttributeName}"]`);
      
      if (nasaWrapper && field.value) {
        // Remove selected from all
        nasaWrapper.querySelectorAll('.nasa-attr-ux').forEach(attr => {
          attr.classList.remove('selected');
        });
        
        // Add selected to current value
        const selectedAttr = nasaWrapper.querySelector(`.nasa-attr-ux[data-value="${field.value}"]`);
        if (selectedAttr) {
          selectedAttr.classList.add('selected');
        }
      }
    });
  }

  onAttributeChange() {
    const attributes = this.getChosenAttributes();
    
    console.log('Attribute change detected:', {
      attributes: attributes.data,
      count: attributes.count,
      chosenCount: attributes.chosenCount
    });

    // Clear previous variation
    this.variationIdInput.value = '';
    
    if (attributes.count === attributes.chosenCount && attributes.chosenCount > 0) {
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
      const fullAttributeName = field.dataset.attribute_name || field.name;
      const value = field.value || '';
      
      if (fullAttributeName) {
        count++;
        if (value.length > 0) {
          chosenCount++;
        }
        
        // Store with the full attribute name as it appears in variation data
        data[fullAttributeName] = value;
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
      
      // Get AJAX URL
      let ajaxUrl = '/wp-admin/admin-ajax.php?action=wc_get_variation';
      
      if (typeof wc_add_to_cart_variation_params !== 'undefined' && wc_add_to_cart_variation_params.wc_ajax_url) {
        ajaxUrl = wc_add_to_cart_variation_params.wc_ajax_url.replace('%%endpoint%%', 'get_variation');
      } else if (typeof nasa_ajax_params !== 'undefined' && nasa_ajax_params.wc_ajax_url) {
        ajaxUrl = nasa_ajax_params.wc_ajax_url.replace('%%endpoint%%', 'get_variation');
      }

      const formData = new FormData();
      formData.append('product_id', this.form.dataset.product_id);
      
      Object.entries(attributes).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const response = await fetch(ajaxUrl, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });

      const variation = await response.json();
      
      if (variation && !variation.error) {
        this.foundVariation(variation);
      } else {
        this.resetVariationData();
        this.showNoMatchingVariationsMsg();
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
      console.log('Checking variation:', variation.variation_id, variation.attributes);
      
      return Object.entries(variation.attributes).every(([name, value]) => {
        // Match the attribute name format from the form
        const attributeKey = name.startsWith('attribute_') ? name : `attribute_${name}`;
        const currentValue = attributes[attributeKey];
        console.log(`Comparing ${name}: variation="${value}" vs selected="${currentValue}" (key: ${attributeKey})`);
        
        // If no value selected for this attribute, skip this variation
        if (!currentValue) {
          console.log(`No value selected for ${attributeKey}`);
          return false;
        }
        
        // If variation allows any value (empty string) or matches exactly
        const matches = value === '' || currentValue === value;
        console.log(`Match result for ${name}: ${matches}`);
        return matches;
      });
    });

    console.log('Matching variation found:', matchingVariation);
    if (matchingVariation) {
      this.foundVariation(matchingVariation);
    } else {
      this.resetVariationData();
      this.showNoMatchingVariationsMsg();
    }
  }

  foundVariation(variation) {
    console.log('Found variation:', variation);
    
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

    // Enable/disable add to cart button
    const purchasable = variation.is_purchasable && variation.is_in_stock && variation.variation_is_visible;
    this.toggleAddToCart(purchasable);
    
    // Update button text if variation has custom text
    if (variation.add_to_cart_text || variation.add_to_cart_txt) {
      this.addToCartButton.textContent = variation.add_to_cart_text || variation.add_to_cart_txt;
    }

    // Show variation details
    this.singleVariation.style.display = 'block';
    this.form.classList.add('variation-selected');

    // Clear any error messages
    this.clearNoMatchingVariationsMsg();
  }

  resetVariationData() {
    console.log('Resetting variation data');
    this.variationIdInput.value = '';
    this.singleVariation.innerHTML = '';
    this.singleVariation.style.display = 'none';
    this.toggleAddToCart(false);
    this.form.classList.remove('variation-selected');
    
    // Reset button text to original
    if (this.addToCartButton.dataset.originalText) {
      this.addToCartButton.textContent = this.addToCartButton.dataset.originalText;
    }
  }

  toggleAddToCart(enable) {
    console.log('Toggle add to cart:', enable);
    if (enable) {
      this.addToCartButton.classList.remove('disabled', 'wc-variation-selection-needed', 'wc-variation-is-unavailable');
      this.addToCartButton.disabled = false;
    } else {
      this.addToCartButton.classList.add('disabled', 'wc-variation-selection-needed');
      this.addToCartButton.classList.remove('wc-variation-is-unavailable');
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
    this.clearNoMatchingVariationsMsg();
  }

  showNoMatchingVariationsMsg() {
    // Remove existing message
    this.clearNoMatchingVariationsMsg();
    
    const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
      wc_add_to_cart_variation_params.i18n_no_matching_variations_text : 
      'Sorry, no products matched your selection. Please choose a different combination.';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'wc-no-matching-variations-message';
    messageDiv.innerHTML = `<p class="wc-no-matching-variations woocommerce-info">${message}</p>`;
    
    this.singleVariation.parentNode.insertBefore(messageDiv, this.singleVariation.nextSibling);
  }

  clearNoMatchingVariationsMsg() {
    const existingMessage = this.form.querySelector('.wc-no-matching-variations-message');
    if (existingMessage) {
      existingMessage.remove();
    }
  }

  updateAttributeValues(attributes) {
    if (this.useAjax) return;
    
    this.attributeFields.forEach(field => {
      const currentValue = field.value;
      const fullAttributeName = field.dataset.attribute_name || field.name;
      const attributeName = fullAttributeName.startsWith('attribute_') ? 
         fullAttributeName.substring(10) : fullAttributeName;
      
      if (!attributeName) return;

      // Find available variations for this attribute
      const availableOptions = this.findAvailableOptions(attributeName, attributes);

      // Update select options
      Array.from(field.options).forEach(option => {
        if (!option.value) return; // Skip placeholder option
        const isAvailable = availableOptions.includes(option.value);
        option.disabled = !isAvailable;
      });

      // Update NASA attribute UX
      const nasaWrapper = this.form.querySelector(`.nasa-attr-ux_wrap[data-attribute_name="${fullAttributeName}"]`);
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
        return Object.entries(selectedAttributes.data || selectedAttributes).every(([fullName, value]) => {
          const cleanName = fullName.startsWith('attribute_') ? 
            fullName.substring(10) : fullName;
          if (cleanName === attributeName) return true;
          if (!value) return true;
          return variation.attributes[cleanName] === value || variation.attributes[cleanName] === '';
        });
      })
      .map(variation => variation.attributes[attributeName])
      .filter((value, index, self) => value && self.indexOf(value) === index);
  }

  // Method to validate if variation is properly selected
  isValidVariationSelected() {
    const attributes = this.getChosenAttributes();
    const variationId = this.variationIdInput.value;
    
    // For variable products, check if all required attributes are selected and variation ID is set
    if (this.form.classList.contains('variations_form')) {
      return attributes.count === attributes.chosenCount && 
             attributes.chosenCount > 0 && 
             variationId && 
             variationId !== '0';
    }
    
    // For simple products, always return true
    return true;
  }

  // Method to get current variation data
  getCurrentVariation() {
    const variationId = this.variationIdInput.value;
    if (!variationId || variationId === '0') return null;
    
    return this.variationData.find(variation => 
      variation.variation_id == variationId || variation.id == variationId
    );
  }
}

// Enhanced Cart Manager
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
    this.initCartSidebar();
    this.initRemoveItems();
    this.initAddToCart();
  }

  initAddToCart() {
    document.addEventListener('click', (e) => {
      const addToCartBtn = e.target.closest('.single_add_to_cart_button');
      if (!addToCartBtn) return;

      console.log('Add to cart button clicked');
      
      e.preventDefault();

      // Check if button is disabled
      if (addToCartBtn.classList.contains('disabled') || addToCartBtn.disabled) {
        console.log('Button is disabled');
        
        if (addToCartBtn.classList.contains('wc-variation-is-unavailable')) {
          const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
            wc_add_to_cart_variation_params.i18n_unavailable_text : 
            'This variation is unavailable.';
          this.showNotice(message, 'error');
        } else if (addToCartBtn.classList.contains('wc-variation-selection-needed')) {
          const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
            wc_add_to_cart_variation_params.i18n_make_a_selection_text : 
            'Please select some product options before adding this product to your cart.';
          this.showNotice(message, 'error');
        }
        return;
      }

      const form = addToCartBtn.closest('form.cart');
      if (!form) {
        console.log('No form found');
        return;
      }
      
      this.handleAddToCart(form, addToCartBtn);
    });
  }

  async handleAddToCart(form, button) {
    console.log('handleAddToCart called');
    
    // Validate variation selection for variable products
    if (form.classList.contains('variations_form')) {
      const variationForm = window.variationForms?.get(form);
      
      if (variationForm && !variationForm.isValidVariationSelected()) {
        console.error('Variation not properly selected');
        const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
          wc_add_to_cart_variation_params.i18n_make_a_selection_text : 
          'Please select some product options before adding this product to your cart.';
        this.showNotice(message, 'error');
        return;
      }

      const variationIdInput = form.querySelector('input[name="variation_id"], .variation_id');
      const variationId = variationIdInput ? variationIdInput.value : '';
      
      if (!variationId || variationId === '0') {
        console.error('Variation ID required but not found');
        const message = typeof wc_add_to_cart_variation_params !== 'undefined' ? 
          wc_add_to_cart_variation_params.i18n_make_a_selection_text : 
          'Please select some product options before adding this product to your cart.';
        this.showNotice(message, 'error');
        return;
      }

      // Validate that all required attributes are selected
      const attributeFields = form.querySelectorAll('select[data-attribute_name], select[name^="attribute_"]');
      const missingAttributes = Array.from(attributeFields).filter(field => {
        const value = field.value;
        return !value || value === '';
      });
      
      if (missingAttributes.length > 0) {
        console.error('Missing required attributes');
        const message = 'Please select all product options before adding this product to your cart.';
        this.showNotice(message, 'error');
        return;
      }
    }
    
    // Store current form state before adding to cart
    const currentFormState = this.storeFormState(form);
    
    button.classList.add('loading');

    try {
      // Create URLSearchParams for better control over the data
      const urlParams = new URLSearchParams();
      
      // Get all form data manually to ensure proper formatting
      const formData = new FormData(form);
      
      // Convert FormData to URLSearchParams with validation
      for (const [key, value] of formData.entries()) {
        // Skip empty values for attribute fields
        if (key.startsWith('attribute_') && (!value || value === '')) {
          continue;
        }
        urlParams.append(key, value);
      }
      
      // Ensure we have the required product ID
      let productId = urlParams.get('product_id') || urlParams.get('add-to-cart') || urlParams.get('data-product_id');
      
      // Try to get product ID from form attributes if not found in form data
      if (!productId) {
        const productIdInput = form.querySelector('input[name="product_id"], input[name="add-to-cart"], [name="data-product_id"]');
        productId = productIdInput ? productIdInput.value : '';
        
        if (productId) {
          urlParams.append('add-to-cart', productId);
        }
      }
      
      if (!productId) {
        throw new Error('Product ID not found');
      }
      
      // For variable products, ensure we have variation_id
      if (form.classList.contains('variations_form')) {
        const variationId = urlParams.get('variation_id');
        if (!variationId || variationId === '0') {
          throw new Error('Variation ID is required for variable products');
        }
        
        // Ensure product_id is set for variations
        if (!urlParams.get('product_id')) {
          urlParams.append('product_id', productId);
        }
      }
      
      console.log('Sending form data:', Object.fromEntries(urlParams));

      // Get AJAX URL - try multiple sources
      let ajaxUrl = '/wp-admin/admin-ajax.php?action=wc_add_to_cart';
      
      if (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.wc_ajax_url) {
        ajaxUrl = wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'add_to_cart');
      } else if (typeof nasa_ajax_params !== 'undefined' && nasa_ajax_params.wc_ajax_url) {
        ajaxUrl = nasa_ajax_params.wc_ajax_url.replace('%%endpoint%%', 'add_to_cart');
      }
        
      const response = await fetch(ajaxUrl, {
        method: 'POST',
        body: urlParams,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      // Handle response
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.log('Non-JSON response received:', text.substring(0, 500));
        
        // Try to parse as JSON anyway (sometimes servers send JSON with wrong content-type)
        try {
          data = JSON.parse(text);
        } catch (e) {
          // If it's not JSON, check for error messages in HTML
          if (text.includes('woocommerce-error') || text.includes('Please choose product options')) {
            throw new Error('Please choose product options before adding to cart');
          }
          throw new Error('Invalid server response');
        }
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

      // Check for redirect to cart
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

      // Show success message
      this.showNotice('Product added to cart successfully!', 'success');

      // Restore form state after fragments update to prevent reset
      setTimeout(() => {
        this.restoreFormState(form, currentFormState);
      }, 100);

      // Trigger added_to_cart event
      const addedEvent = new CustomEvent('added_to_cart', {
        detail: [data.fragments, data.cart_hash, button],
        bubbles: true
      });
      document.body.dispatchEvent(addedEvent);
      
      // Remove any lingering error notices after successful add to cart
      setTimeout(() => {
        this.removeErrorNotices();
      }, 200);
      
      // Open cart sidebar after successful add
      setTimeout(() => {
        this.openCartSidebar();
      }, 500);
      
    } catch (error) {
      console.error('Add to cart error:', error);
      this.showNotice(error.message || 'Error adding to cart', 'error');
    } finally {
      button.classList.remove('loading');
    }
  }

  storeFormState(form) {
    const state = {
      attributeValues: {},
      variationId: '',
      nasaUxSelections: {}
    };

    // Store attribute field values
    const attributeFields = form.querySelectorAll('select[data-attribute_name], select[name^="attribute_"]');
    attributeFields.forEach(field => {
      const attributeName = field.dataset.attribute_name || field.name;
      state.attributeValues[attributeName] = field.value;
    });

    // Store variation ID
    const variationIdInput = form.querySelector('input[name="variation_id"], .variation_id');
    if (variationIdInput) {
      state.variationId = variationIdInput.value;
    }

    // Store NASA UX selections
    const nasaUxElements = form.querySelectorAll('.nasa-attr-ux.selected');
    nasaUxElements.forEach(element => {
      const wrap = element.closest('.nasa-attr-ux_wrap');
      if (wrap) {
        const attributeName = wrap.dataset.attribute_name;
        state.nasaUxSelections[attributeName] = element.dataset.value;
      }
    });

    return state;
  }

  restoreFormState(form, state) {
    if (!state) return;

    // Restore attribute field values
    Object.entries(state.attributeValues).forEach(([attributeName, value]) => {
      const field = form.querySelector(`select[data-attribute_name="${attributeName}"], select[name="${attributeName}"]`);
      if (field && value) {
        field.value = value;
      }
    });

    // Restore variation ID
    if (state.variationId) {
      const variationIdInput = form.querySelector('input[name="variation_id"], .variation_id');
      if (variationIdInput) {
        variationIdInput.value = state.variationId;
      }
    }

    // Restore NASA UX selections
    Object.entries(state.nasaUxSelections).forEach(([attributeName, value]) => {
      const wrap = form.querySelector(`.nasa-attr-ux_wrap[data-attribute_name="${attributeName}"]`);
      if (wrap) {
        // Remove all selected classes first
        wrap.querySelectorAll('.nasa-attr-ux').forEach(attr => {
          attr.classList.remove('selected');
        });
        
        // Add selected class to the correct element
        const selectedAttr = wrap.querySelector(`.nasa-attr-ux[data-value="${value}"]`);
        if (selectedAttr) {
          selectedAttr.classList.add('selected');
        }
      }
    });

    // Get the variation form instance and validate the current state
    const variationForm = window.variationForms?.get(form);
    if (variationForm) {
      // Check if we have a valid variation selected
      if (variationForm.isValidVariationSelected()) {
        // Enable the add to cart button
        variationForm.toggleAddToCart(true);
        
        // Show the variation details if they exist
        const singleVariation = form.querySelector('.single_variation');
        if (singleVariation && singleVariation.innerHTML.trim()) {
          singleVariation.style.display = 'block';
          form.classList.add('variation-selected');
        }
      }
    }
  }

  showNotice(message, type = 'success') {
    // Remove existing notices - be more specific about what we remove
    const existingNotices = document.querySelectorAll('.woocommerce-notices-wrapper .woocommerce-message, .woocommerce-notices-wrapper .woocommerce-error, .woocommerce-notices-wrapper .woocommerce-info');
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

  initCartPersistence() {
    window.addEventListener('load', () => this.refreshCartFragments());
    setInterval(() => this.refreshCartFragments(), 30000);
  }

  async refreshCartFragments() {
    try {
      let ajaxUrl = '/wp-admin/admin-ajax.php?action=wc_get_refreshed_fragments';
      
      if (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.wc_ajax_url) {
        ajaxUrl = wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'get_refreshed_fragments');
      } else if (typeof nasa_ajax_params !== 'undefined' && nasa_ajax_params.wc_ajax_url) {
        ajaxUrl = nasa_ajax_params.wc_ajax_url.replace('%%endpoint%%', 'get_refreshed_fragments');
      }

      const response = await fetch(ajaxUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await response.json();

      if (data && data.fragments) {
        this.updateCartFragments(data.fragments);
        this.updateCartCount(data.fragments);

        if (data.cart_hash) {
          sessionStorage.setItem('wc_cart_hash', data.cart_hash);
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

    // Try to extract count from fragments
    if (fragments) {
      for (const [selector, content] of Object.entries(fragments)) {
        if (selector.includes('cart-count') || selector.includes('cart-number')) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          const countElement = tempDiv.querySelector('.nasa-cart-count, .cart-number');
          if (countElement) {
            count = countElement.textContent || '0';
            break;
          }
        }
      }
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

    document.body.classList.add('nasa-minicart-active', 'm-ovhd');
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

    document.body.classList.remove('nasa-minicart-active', 'm-ovhd');
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

      let ajaxUrl = '/wp-admin/admin-ajax.php?action=wc_remove_from_cart';
      
      if (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.wc_ajax_url) {
        ajaxUrl = wc_add_to_cart_params.wc_ajax_url.replace('%%endpoint%%', 'remove_from_cart');
      } else if (typeof nasa_ajax_params !== 'undefined' && nasa_ajax_params.wc_ajax_url) {
        ajaxUrl = nasa_ajax_params.wc_ajax_url.replace('%%endpoint%%', 'remove_from_cart');
      }

      const response = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
          cart_item_key: cartItemKey,
          security: typeof wc_add_to_cart_params !== 'undefined' ? wc_add_to_cart_params.nonce : ''
        }),
        credentials: 'same-origin'
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

  updateCartFragments(fragments) {
    if (!fragments) return;

    // Remove any error notices before updating fragments
    this.removeErrorNotices();

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

    if (window.sessionStorage && typeof wc_cart_fragments_params !== 'undefined') {
      sessionStorage.setItem(wc_cart_fragments_params.fragment_name, JSON.stringify(fragments));
      sessionStorage.setItem('wc_cart_created', (new Date()).getTime());
    }

    // Remove error notices after fragment update as well
    setTimeout(() => {
      this.removeErrorNotices();
    }, 100);
  }

  removeErrorNotices() {
    // Remove WooCommerce error notices that might appear after successful add to cart
    const errorNotices = document.querySelectorAll('.woocommerce-notices-wrapper .woocommerce-error');
    errorNotices.forEach(notice => {
      // Check if this is the "Please choose product options" error
      if (notice.textContent.includes('Please choose product options')) {
        notice.remove();
      }
    });

    // Also remove the entire notices wrapper if it's empty
    const noticesWrapper = document.querySelector('.woocommerce-notices-wrapper');
    if (noticesWrapper && !noticesWrapper.querySelector('.woocommerce-message, .woocommerce-error, .woocommerce-info')) {
      noticesWrapper.remove();
    }
  }
}

// Global storage for variation forms
window.variationForms = new Map();

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize variation forms
  document.querySelectorAll('.variations_form').forEach(form => {
    const variationForm = new VariationForm(form);
    window.variationForms.set(form, variationForm);
  });

  // Initialize cart manager
  new CartManager();
});
