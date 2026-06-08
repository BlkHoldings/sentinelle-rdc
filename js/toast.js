/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Toast Notification System
   Depends on: escHtml (utils.js), CSS in base.css
   ═══════════════════════════════════════════════════════════ */

(function() {
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  var STYLES = {
    info:    { color: '#2196f3', icon: 'ℹ' },
    success: { color: '#26d97f', icon: '✓' },
    error:   { color: '#ff3b4a', icon: '✗' },
    warn:    { color: '#ffa726', icon: '⚠' }
  };

  /**
   * Displays a toast notification.
   * @param {string} msg     - Message text (will be HTML-escaped)
   * @param {string} type    - 'info' | 'success' | 'error' | 'warn'
   * @param {number} duration - Display duration in ms (default 3500)
   */
  window.toast = function(msg, type, duration) {
    type     = STYLES[type] ? type : 'info';
    duration = typeof duration === 'number' ? duration : 3500;

    var s   = STYLES[type];
    var el  = document.createElement('div');
    el.className = 'toast';
    el.style.borderColor = s.color;
    el.innerHTML =
      '<span class="toast-icon" style="color:' + s.color + '">' + s.icon + '</span>' +
      '<span style="color:' + s.color + '">' + escHtml(msg) + '</span>';

    el.style.animation = 'toastIn .2s ease-out';
    container.appendChild(el);

    setTimeout(function() {
      el.style.animation = 'toastOut .3s ease-in forwards';
      setTimeout(function() { if (el.parentNode) el.remove(); }, 300);
    }, duration);
  };
})();
