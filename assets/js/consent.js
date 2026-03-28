(function () {
  var GA_ID = 'G-3CRTJRZ551';
  var STORAGE_KEY = 'upskilled_consent';

  function getConsent() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setConsent(val) {
    try { localStorage.setItem(STORAGE_KEY, val); } catch (e) {}
  }

  function loadGA() {
    if (window._gaLoaded) return;
    window._gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  function openPrivacyModal() {
    var modal = document.getElementById('privacy-modal');
    if (modal) modal.hidden = false;
  }

  function closePrivacyModal() {
    var modal = document.getElementById('privacy-modal');
    if (modal) modal.hidden = true;
  }

  function init() {
    var consent = getConsent();

    if (consent === 'accepted') {
      loadGA();
    }
    // 'declined' or null: GA stays unloaded

    var banner = document.getElementById('consent-banner');

    if (!consent && banner) {
      banner.hidden = false;

      document.getElementById('consent-accept').addEventListener('click', function () {
        setConsent('accepted');
        banner.hidden = true;
        loadGA();
        // Fire after loadGA so gtag is available
        setTimeout(function () {
          if (typeof gtag === 'function') gtag('event', 'consent_choice', { choice: 'accepted' });
        }, 500);
      });

      document.getElementById('consent-decline').addEventListener('click', function () {
        setConsent('declined');
        banner.hidden = true;
      });
    }

    // Privacy modal — wired regardless of banner state (footer link can also open it)
    var privacyBtns = document.querySelectorAll('.consent-privacy-btn');
    privacyBtns.forEach(function (btn) {
      btn.addEventListener('click', openPrivacyModal);
    });

    var modalClose = document.getElementById('privacy-modal-close');
    if (modalClose) modalClose.addEventListener('click', closePrivacyModal);

    var overlay = document.getElementById('privacy-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closePrivacyModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePrivacyModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
