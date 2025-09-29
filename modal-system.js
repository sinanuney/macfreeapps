/**
 * General Modal/Popup System
 * Provides easy-to-use modal, popup, and toast notification functionality
 */

class ModalSystem {
    constructor() {
        this.activeModals = new Set();
        this.activeToasts = new Set();
        this.init();
    }

    init() {
        // Create modal container if it doesn't exist
        if (!document.getElementById('modal-system-container')) {
            this.createModalContainer();
        }
        
        // Add event listeners
        this.addEventListeners();
    }

    createModalContainer() {
        const container = document.createElement('div');
        container.id = 'modal-system-container';
        container.innerHTML = `
            <div class="modal-overlay" id="modal-overlay"></div>
            <div class="modal-container" id="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title" id="modal-title"></h3>
                    <button class="modal-close" id="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="modal-body"></div>
                <div class="modal-footer" id="modal-footer"></div>
            </div>
        `;
        document.body.appendChild(container);
    }

    addEventListeners() {
        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.id === 'modal-close' || e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                this.closeModal();
            }
        });
    }

    /**
     * Show a modal dialog
     * @param {Object} options - Modal configuration
     * @param {string} options.title - Modal title
     * @param {string} options.content - Modal content (HTML string)
     * @param {string} options.size - Modal size: 'sm', 'md', 'lg', 'xl'
     * @param {string} options.type - Modal type: 'info', 'success', 'warning', 'danger'
     * @param {Array} options.buttons - Array of button objects
     * @param {Function} options.onClose - Callback when modal is closed
     * @param {boolean} options.closable - Whether modal can be closed (default: true)
     */
    showModal(options = {}) {
        const {
            title = 'Modal',
            content = '',
            size = 'md',
            type = 'info',
            buttons = [],
            onClose = null,
            closable = true
        } = options;

        const modalId = 'modal-' + Date.now();
        this.activeModals.add(modalId);

        // Update modal content
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContainer = document.getElementById('modal-container');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');
        const modalClose = document.getElementById('modal-close');

        // Set modal classes
        modalContainer.className = `modal-container modal-${size} modal-${type}`;
        modalClose.style.display = closable ? 'flex' : 'none';

        // Set content
        modalTitle.textContent = title;
        modalBody.innerHTML = content;

        // Create buttons
        modalFooter.innerHTML = '';
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `btn ${button.class || 'btn-secondary'}`;
            btn.textContent = button.text;
            btn.onclick = button.onclick || (() => {});
            modalFooter.appendChild(btn);
        });

        // Show modal
        modalOverlay.style.display = 'block';
        modalContainer.style.display = 'block';

        // Store callback
        if (onClose) {
            modalContainer.dataset.onClose = modalId;
            this[`onClose_${modalId}`] = onClose;
        }

        return modalId;
    }

    /**
     * Close the currently open modal
     */
    closeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContainer = document.getElementById('modal-container');
        
        if (modalContainer.dataset.onClose) {
            const modalId = modalContainer.dataset.onClose;
            if (this[`onClose_${modalId}`]) {
                this[`onClose_${modalId}`]();
                delete this[`onClose_${modalId}`];
            }
        }

        modalOverlay.style.display = 'none';
        modalContainer.style.display = 'none';
        this.activeModals.clear();
    }

    /**
     * Show a popup
     * @param {Object} options - Popup configuration
     * @param {string} options.content - Popup content
     * @param {string} options.position - Position: 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'center'
     * @param {number} options.duration - Auto-close duration in ms (0 = no auto-close)
     * @param {boolean} options.closable - Whether popup can be closed
     */
    showPopup(options = {}) {
        const {
            content = '',
            position = 'top-right',
            duration = 5000,
            closable = true
        } = options;

        const popupId = 'popup-' + Date.now();
        const popup = document.createElement('div');
        popup.id = popupId;
        popup.className = `popup popup-${position}`;
        
        popup.innerHTML = `
            ${closable ? '<button class="popup-close">&times;</button>' : ''}
            <div class="popup-content">${content}</div>
        `;

        // Add close event
        if (closable) {
            const closeBtn = popup.querySelector('.popup-close');
            closeBtn.onclick = () => this.closePopup(popupId);
        }

        document.body.appendChild(popup);

        // Auto-close if duration is set
        if (duration > 0) {
            setTimeout(() => this.closePopup(popupId), duration);
        }

        return popupId;
    }

    /**
     * Close a popup
     * @param {string} popupId - Popup ID to close
     */
    closePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.animation = 'popupSlideOut 0.3s ease';
            setTimeout(() => popup.remove(), 300);
        }
    }

    /**
     * Show a toast notification
     * @param {Object} options - Toast configuration
     * @param {string} options.title - Toast title
     * @param {string} options.message - Toast message
     * @param {string} options.type - Toast type: 'success', 'error', 'warning', 'info'
     * @param {string} options.position - Position: 'top-right', 'top-left', 'bottom-right', 'bottom-left'
     * @param {number} options.duration - Auto-close duration in ms (0 = no auto-close)
     * @param {boolean} options.closable - Whether toast can be closed
     */
    showToast(options = {}) {
        const {
            title = '',
            message = '',
            type = 'info',
            position = 'top-right',
            duration = 5000,
            closable = true
        } = options;

        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type} toast-${position}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            ${closable ? '<button class="toast-close">&times;</button>' : ''}
        `;

        // Add close event
        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.onclick = () => this.closeToast(toastId);
        }

        document.body.appendChild(toast);

        // Auto-close if duration is set
        if (duration > 0) {
            setTimeout(() => this.closeToast(toastId), duration);
        }

        return toastId;
    }

    /**
     * Close a toast notification
     * @param {string} toastId - Toast ID to close
     */
    closeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }

    /**
     * Show confirmation dialog
     * @param {Object} options - Confirmation options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Confirmation message
     * @param {string} options.confirmText - Confirm button text
     * @param {string} options.cancelText - Cancel button text
     * @param {Function} options.onConfirm - Callback when confirmed
     * @param {Function} options.onCancel - Callback when cancelled
     */
    showConfirm(options = {}) {
        const {
            title = 'Onay',
            message = 'Bu işlemi onaylıyor musunuz?',
            confirmText = 'Evet',
            cancelText = 'Hayır',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;

        return this.showModal({
            title,
            content: `<p>${message}</p>`,
            type: 'warning',
            buttons: [
                {
                    text: cancelText,
                    class: 'btn-secondary',
                    onclick: () => {
                        onCancel();
                        this.closeModal();
                    }
                },
                {
                    text: confirmText,
                    class: 'btn-danger',
                    onclick: () => {
                        onConfirm();
                        this.closeModal();
                    }
                }
            ]
        });
    }

    /**
     * Show alert dialog
     * @param {Object} options - Alert options
     * @param {string} options.title - Alert title
     * @param {string} options.message - Alert message
     * @param {string} options.type - Alert type: 'info', 'success', 'warning', 'danger'
     * @param {Function} options.onClose - Callback when closed
     */
    showAlert(options = {}) {
        const {
            title = 'Bilgi',
            message = '',
            type = 'info',
            onClose = () => {}
        } = options;

        return this.showModal({
            title,
            content: `<p>${message}</p>`,
            type,
            buttons: [
                {
                    text: 'Tamam',
                    class: 'btn-primary',
                    onclick: () => {
                        onClose();
                        this.closeModal();
                    }
                }
            ]
        });
    }

    /**
     * Show loading modal
     * @param {string} message - Loading message
     */
    showLoading(message = 'Yükleniyor...') {
        return this.showModal({
            title: 'Yükleniyor',
            content: `
                <div style="text-align: center; padding: 2rem;">
                    <div class="loading-spinner" style="margin: 0 auto 1rem;"></div>
                    <p>${message}</p>
                </div>
            `,
            type: 'info',
            closable: false,
            buttons: []
        });
    }

    /**
     * Close loading modal
     */
    closeLoading() {
        this.closeModal();
    }
}

// Create global instance
window.modalSystem = new ModalSystem();

// Convenience functions
window.showModal = (options) => window.modalSystem.showModal(options);
window.showPopup = (options) => window.modalSystem.showPopup(options);
window.showToast = (options) => window.modalSystem.showToast(options);
window.showConfirm = (options) => window.modalSystem.showConfirm(options);
window.showAlert = (options) => window.modalSystem.showAlert(options);
window.showLoading = (message) => window.modalSystem.showLoading(message);
window.closeModal = () => window.modalSystem.closeModal();
window.closeLoading = () => window.modalSystem.closeLoading();
