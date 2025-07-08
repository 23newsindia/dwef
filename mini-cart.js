class MiniCartExtension {
    constructor() {
        this.initialized = false;
        this.activeNode = null;
        this.sidebarOpen = false;
        this.lastUserActivity = Date.now();
        this.operationInProgress = false;
        
        this.ajaxUrl = typeof window.wc_cart_fragments_params !== 'undefined' ? 
            window.wc_cart_fragments_params.wc_ajax_url : 
            (window._wpUtilSettings && window._wpUtilSettings.ajax ? window._wpUtilSettings.ajax.url : '/wp-admin/admin-ajax.php');
        
        this.init();
        this.disableWooCommerceAutoRefresh();
    }

    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.setupActivityTracking();
        this.initialized = true;
    }

    // Optimize WooCommerce's automatic fragment refresh
    disableWooCommerceAutoRefresh() {
        // Store reference globally for access
        window.miniCartExtension = this;
        
        // Override fetch to control WooCommerce fragment refreshes
        if (typeof window.wc_cart_fragments_params !== 'undefined') {
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const url = args[0];
                if (typeof url === 'string' && 
                    url.includes('get_refreshed_fragments') && 
                    window.miniCartExtension.sidebarOpen && 
                    !window.miniCartExtension.operationInProgress) {
                    return Promise.resolve(new Response('{}', { status: 200 }));
                }
                return originalFetch.apply(window, args);
            };
        }
    }

    // Track user activity
    setupActivityTracking() {
        const updateActivity = () => {
            this.lastUserActivity = Date.now();
        };

        ['click', 'scroll', 'keydown', 'mousemove'].forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const miniCartBtn = e.target.closest('.ext-mini-cart');
            if (miniCartBtn) {
                e.preventDefault();
                this.handleMiniCartButtonClick(miniCartBtn);
            }

            const closeBtn = e.target.closest('.nasa-close-node, .close-nodes');
            if (closeBtn) {
                e.preventDefault();
                this.handleCloseButtonClick(closeBtn);
            }

            const applyBtn = e.target.closest('#mini-cart-apply_coupon');
            if (applyBtn) {
                e.preventDefault();
                this.handleApplyCoupon(applyBtn);
            }

            const publishedCoupon = e.target.closest('.publish-coupon:not(.nasa-actived)');
            if (publishedCoupon) {
                e.preventDefault();
                this.handlePublishedCouponClick(publishedCoupon);
            }

            const removeBtn = e.target.closest('.woocommerce-remove-coupon');
            if (removeBtn) {
                e.preventDefault();
                this.handleRemoveCoupon(removeBtn);
            }

            const saveNoteBtn = e.target.closest('#mini-cart-save_note');
            if (saveNoteBtn) {
                e.preventDefault();
                this.handleSaveNote(saveNoteBtn);
            }
        });

        document.body.addEventListener('nasa_opened_cart_sidebar', () => {
            this.sidebarOpen = true;
            this.loadNonces();
        });

        document.body.addEventListener('nasa_closed_cart_sidebar', () => {
            this.sidebarOpen = false;
        });

        // Control WooCommerce fragment refresh events
        document.body.addEventListener('wc_fragments_refreshed', (e) => {
            if (this.sidebarOpen && !this.operationInProgress) {
                e.stopImmediatePropagation();
                return false;
            }
        });
    }

    async loadNonces() {
        try {
            const response = await fetch(this.getAjaxUrl('nasa_ext_cart_ajax_nonce'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                
                if (data && data.fds) {
                    const cartSidebar = document.getElementById('cart-sidebar');
                    if (cartSidebar && !cartSidebar.querySelector('.mini-cart-ajax-nonce')) {
                        cartSidebar.insertAdjacentHTML('beforeend', data.fds);
                    }
                }
            } else {
                console.warn('Nonce response is not JSON');
            }
        } catch (error) {
            console.error('Error loading nonces:', error);
        }
    }

    async refreshCartFragments() {
        // Prevent refresh if sidebar is open and no operation is in progress
        if (this.sidebarOpen && !this.operationInProgress) {
            return null;
        }

        // Prevent refresh if user was recently active and no operation
        const timeSinceActivity = Date.now() - this.lastUserActivity;
        if (!this.operationInProgress && timeSinceActivity < 10000) {
            return null;
        }

        try {
            const response = await fetch(this.getAjaxUrl('get_refreshed_fragments'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (data && data.fragments) {
                    await this.updateFragments(data.fragments);
                    return data.fragments;
                }
            } else {
                console.warn('Fragment response is not JSON');
            }
        } catch (error) {
            console.error('Error refreshing cart fragments:', error);
        }
        return null;
    }

    handleMiniCartButtonClick(button) {
        const action = button.dataset.act;
        const cart = button.closest('.nasa-static-sidebar') || button.closest('.ns-cart-popup');
        
        if (!cart || !action) return;

        const miniCartWrap = cart.querySelector('.ext-mini-cart-wrap');
        if (!miniCartWrap || miniCartWrap.classList.contains('nasa-disable')) return;

        this.sidebarOpen = true;

        document.body.classList.add('canvas-on');
        cart.classList.add('ext-loading');

        if (!cart.querySelector('.close-nodes')) {
            cart.insertAdjacentHTML('beforeend', '<a href="javascript:void(0);" class="close-nodes"></a>');
        }

        cart.querySelectorAll('.ext-nodes-wrap .ext-node').forEach(node => {
            node.classList.remove('active');
        });

        const targetNode = cart.querySelector(`.ext-nodes-wrap .ext-node.mini-cart-${action}`);
        if (targetNode) {
            targetNode.classList.add('active');
            this.activeNode = targetNode;
        }

        if (!cart.querySelector('.mini-cart-ajax-nonce')) {
            this.loadNonces();
        }

        document.body.dispatchEvent(new CustomEvent('nasa_opened_cart_sidebar'));
    }

    handleCloseButtonClick(closeBtn) {
        const cart = closeBtn.closest('.nasa-static-sidebar') || closeBtn.closest('.ns-cart-popup');
        const node = closeBtn.closest('.ext-node');

        if (cart) {
            cart.classList.remove('ext-loading');
        }

        if (node) {
            node.classList.remove('active');
            this.activeNode = null;
        }

        const closeNodes = cart?.querySelector('.close-nodes');
        if (closeNodes) {
            closeNodes.remove();
        }

        this.sidebarOpen = false;

        document.body.dispatchEvent(new CustomEvent('nasa_closed_cart_sidebar'));
    }
    // Helper method to handle server responses (JSON or HTML)
    async handleServerResponse(response, successIndicators = [], errorClass = 'woocommerce-error') {
        const responseText = await response.text();
        const contentType = response.headers.get('content-type');
        
        // Try JSON first
        if (contentType && contentType.includes('application/json')) {
            try {
                const result = JSON.parse(responseText);
                return {
                    success: result && result.success !== false,
                    message: result.message || result.data || '',
                    data: result
                };
            } catch (e) {
                throw new Error('Invalid JSON response from server');
            }
        }
        
        // Handle HTML response
        const isSuccess = response.ok && successIndicators.some(indicator => 
            responseText.includes(indicator)
        );
        
        if (isSuccess) {
            return {
                success: true,
                message: successIndicators[0] || 'Operation completed successfully'
            };
        }
        
        // Check for errors
        if (responseText.includes(errorClass) || responseText.includes('error')) {
            const errorMatch = responseText.match(new RegExp(`<[^>]*class="[^"]*${errorClass}[^"]*"[^>]*>(.*?)<\/[^>]*>`));
            const errorMessage = errorMatch ? errorMatch[1].trim() : 'Operation failed';
            throw new Error(errorMessage);
        }
        
        // Default handling
        return {
            success: response.ok,
            message: response.ok ? 'Operation completed' : 'Unknown error occurred'
        };
    }

    async handleApplyCoupon(button) {
        if (button.classList.contains('nasa-disable')) return;
        
        const couponInput = document.querySelector('#mini-cart-add-coupon_code');
        const couponCode = couponInput?.value?.trim();
        
        if (!couponCode) return;

        // Mark operation as in progress to allow necessary refreshes
        this.operationInProgress = true;

        button.classList.add('nasa-disable');
        const cart = button.closest('.nasa-static-sidebar') || button.closest('.widget_shopping_cart_content');
        
        try {
            let nonce = document.querySelector('#apply_coupon_nonce')?.value;
            if (!nonce) {
                await this.loadNonces();
                nonce = document.querySelector('#apply_coupon_nonce')?.value;
            }

            cart.classList.add('ext-loading');

            const response = await fetch(this.getAjaxUrl('apply_coupon'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    security: nonce || '',
                    coupon_code: couponCode
                })
            });

            const result = await this.handleServerResponse(response, [
                'Coupon code applied successfully',
                'Coupon applied successfully'
            ]);

            if (result.success) {
                const fragments = await this.refreshCartFragments();
                if (fragments) {
                    this.showMessage(result.message);
                    couponInput.value = '';

                    const publishedCoupon = document.querySelector(`.publish-coupon[data-code="${couponCode}"]`);
                    if (publishedCoupon) {
                        publishedCoupon.classList.add('nasa-actived');
                    }

                    const couponNode = button.closest('.ext-node');
                    if (couponNode) {
                        couponNode.classList.remove('active');
                    }
                } else {
                    this.showMessage(result.message);
                    couponInput.value = '';
                }
            } else {
                throw new Error(result.message || 'Failed to apply coupon');
            }

        } catch (error) {
            console.error('Error applying coupon:', error);
            this.showMessage(error.message || 'Error applying coupon', 'error');
        } finally {
            button.classList.remove('nasa-disable');
            cart.classList.remove('ext-loading');
            this.operationInProgress = false;
        }
    }

    async handleRemoveCoupon(button) {
        if (button.classList.contains('nasa-disable')) return;
        
        const couponCode = button.dataset.coupon;
        if (!couponCode) return;

        // Mark operation as in progress to allow necessary refreshes
        this.operationInProgress = true;

        button.classList.add('nasa-disable');
        const cart = button.closest('.nasa-static-sidebar') || button.closest('.widget_shopping_cart_content');
        
        try {
            let nonce = document.querySelector('#remove_coupon_nonce')?.value;
            if (!nonce) {
                await this.loadNonces();
                nonce = document.querySelector('#remove_coupon_nonce')?.value;
            }

            cart.classList.add('ext-loading');

            const response = await fetch(this.getAjaxUrl('remove_coupon'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    security: nonce || '',
                    coupon: couponCode
                })
            });

            const result = await this.handleServerResponse(response, [
                'Coupon has been removed',
                'Coupon removed successfully'
            ]);

            if (result.success) {
                const fragments = await this.refreshCartFragments();
                if (fragments) {
                    this.showMessage(result.message);

                    const publishedCoupon = document.querySelector(`.publish-coupon[data-code="${couponCode}"]`);
                    if (publishedCoupon) {
                        publishedCoupon.classList.remove('nasa-actived');
                    }
                } else {
                    this.showMessage(result.message);
                }
            } else {
                throw new Error(result.message || 'Failed to remove coupon');
            }

        } catch (error) {
            console.error('Error removing coupon:', error);
            this.showMessage(error.message || 'Error removing coupon', 'error');
        } finally {
            button.classList.remove('nasa-disable');
            cart.classList.remove('ext-loading');
            this.operationInProgress = false;
        }
    }

    async handleSaveNote(button) {
        if (button.classList.contains('nasa-disable')) return;
        
        const noteTextarea = document.querySelector('.mini-cart-note textarea[name="order_comments"]');
        const noteText = noteTextarea?.value?.trim() || '';
        
        // Mark operation as in progress
        this.operationInProgress = true;

        button.classList.add('nasa-disable');
        const cart = button.closest('.nasa-static-sidebar') || button.closest('.widget_shopping_cart_content');
        const noteNode = button.closest('.ext-node');
        
        try {
            cart.classList.add('ext-loading');

            const response = await fetch(this.getAjaxUrl('nasa_mini_cart_note'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    order_comments: noteText
                })
            });

            const result = await this.handleServerResponse(response, ['Note saved', 'Order notes saved']);

            if (result.data && result.data.error) {
                throw new Error(result.data.message || 'Failed to save note');
            }

            if (result.data && result.data.fragments) {
                await this.updateFragments(result.data.fragments);
            }

            this.showMessage('Your order notes saved.');

            if (noteNode) {
                noteNode.classList.remove('active');
            }

        } catch (error) {
            console.error('Error saving note:', error);
            this.showMessage(error.message || 'Error saving note', 'error');
        } finally {
            button.classList.remove('nasa-disable');
            cart.classList.remove('ext-loading');
            this.operationInProgress = false;
        }
    }

    handlePublishedCouponClick(coupon) {
        const code = coupon.dataset.code;
        if (!code) return;

        const input = document.querySelector('#mini-cart-add-coupon_code');
        if (input) {
            input.value = code;
            const applyButton = document.querySelector('#mini-cart-apply_coupon');
            if (applyButton) {
                applyButton.click();
            }
        }
    }

    async updateFragments(fragments) {
        if (!fragments) return;

        if (this.sidebarOpen && !this.operationInProgress) {
            return;
        }

        Object.entries(fragments).forEach(([selector, content]) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const temp = document.createElement('div');
                temp.innerHTML = content;
                
                if (element.parentNode) {
                    element.parentNode.replaceChild(temp.firstElementChild || temp.firstChild, element);
                }
            });
        });

        // Trigger necessary events
        ['wc_fragments_refreshed', 'updated_cart_totals', 'nasa_init_shipping_free_notification'].forEach(eventName => {
            document.body.dispatchEvent(new Event(eventName));
        });
    }

    showMessage(message, type = 'success') {
        const wrap = document.querySelector('.ext-mini-cart-wrap');
        if (!wrap) return;

        wrap.querySelectorAll('.mess-wrap').forEach(mess => mess.remove());

        const messageWrap = document.createElement('div');
        messageWrap.className = 'mess-wrap';

        const messageContent = document.createElement('div');
        messageContent.className = type === 'success' ? 'woocommerce-message' : 'woocommerce-error';
        messageContent.setAttribute('role', 'alert');
        messageContent.textContent = message;

        messageWrap.appendChild(messageContent);
        wrap.appendChild(messageWrap);

        setTimeout(() => {
            messageWrap.remove();
        }, 5000);
    }

    getAjaxUrl(endpoint) {
        return this.ajaxUrl.toString().replace('%%endpoint%%', endpoint);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MiniCartExtension();
});
