/**
 * Alert Observer - Gestisce notifiche e alert senza script inline
 * Questo file risolve gli errori CSP spostando la logica da script inline
 */

class AlertObserver {
  constructor() {
    this.observers = new Set();
    this.isInitialized = false;
  }

  /**
   * Inizializza l'observer
   */
  init() {
    if (this.isInitialized) return;
    
    try {
      // Crea un observer per i cambiamenti del DOM
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            this.handleDOMChanges(mutation.addedNodes);
          }
        });
      });

      // Inizia a osservare
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      this.isInitialized = true;
      console.log('[AlertObserver] Initialized successfully');
    } catch (error) {
      console.error('[AlertObserver] Initialization failed:', error);
    }
  }

  /**
   * Gestisce i cambiamenti del DOM
   */
  handleDOMChanges(nodes) {
    nodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        this.processElement(node);
      }
    });
  }

  /**
   * Processa un elemento per trovare alert
   */
  processElement(element) {
    // Cerca alert e notifiche
    const alerts = element.querySelectorAll('[data-alert], .alert, .notification');
    
    alerts.forEach((alert) => {
      this.processAlert(alert);
    });
  }

  /**
   * Processa un singolo alert
   */
  processAlert(alert) {
    try {
      // Estrai informazioni dall'alert
      const message = alert.textContent || alert.getAttribute('data-message') || 'Alert';
      const type = alert.getAttribute('data-type') || 'info';
      
      // Notifica gli observer
      this.notifyObservers({
        element: alert,
        message,
        type,
        timestamp: new Date().toISOString()
      });
      
      // Aggiungi classe per styling
      alert.classList.add('alert-processed');
      
    } catch (error) {
      console.warn('[AlertObserver] Error processing alert:', error);
    }
  }

  /**
   * Aggiunge un observer
   */
  addObserver(callback) {
    this.observers.add(callback);
  }

  /**
   * Rimuove un observer
   */
  removeObserver(callback) {
    this.observers.delete(callback);
  }

  /**
   * Notifica tutti gli observer
   */
  notifyObservers(data) {
    this.observers.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('[AlertObserver] Observer callback error:', error);
      }
    });
  }

  /**
   * Distrugge l'observer
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.observers.clear();
    this.isInitialized = false;
    console.log('[AlertObserver] Destroyed');
  }
}

// Esporta l'istanza singleton
export const alertObserver = new AlertObserver();

// Auto-inizializzazione quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    alertObserver.init();
  });
} else {
  alertObserver.init();
}

export default alertObserver;
