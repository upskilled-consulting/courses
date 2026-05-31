document.addEventListener('DOMContentLoaded', () => {
    const formLoadTime = Date.now();

    // Wire course links to the SPA navigate() defined in platform.js
    document.querySelectorAll('.footer-nav-link').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            navigate(a.dataset.path);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    const firebaseConfig = {
        apiKey:            "AIzaSyBV6dwTqKhJSlmyrV3g8aLSYrBwIVQXOKo",
        authDomain:        "nickmccarty-site.firebaseapp.com",
        projectId:         "nickmccarty-site",
        storageBucket:     "nickmccarty-site.firebasestorage.app",
        messagingSenderId: "875332555466",
        appId:             "1:875332555466:web:2e27a8f809933dde295a33"
    };

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    const db  = firebase.firestore(app);

    function spamCheck(name, email, honeypot) {
        if (honeypot) return true;
        if (Date.now() - formLoadTime < 3000) return true;
        if (name.length > 12 && !name.includes(' ')) return true;
        if (name.length > 4 && !/[aeiouAEIOU]/.test(name)) return true;
        const local = email.split('@')[0] || '';
        if ((local.match(/\./g) || []).length > 2) return true;
        if (/\d+\.\d+/.test(local)) return true;
        return false;
    }

    const form      = document.getElementById('footer-contact-form');
    if (!form) return;

    const messageDiv = document.getElementById('footer-form-message');
    const submitBtn  = document.getElementById('footer-submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name     = document.getElementById('footer-name').value.trim();
        const email    = document.getElementById('footer-email').value.trim();
        const honeypot = (document.getElementById('hp-website-footer') || {}).value || '';
        if (!email) return;

        if (spamCheck(name, email, honeypot)) {
            messageDiv.innerHTML = '<div class="message error">Your submission could not be sent.</div>';
            return;
        }

        submitBtn.disabled    = true;
        submitBtn.textContent = 'Sending\u2026';

        const pageTitle = document.querySelector('h1.reading-title')?.textContent?.trim()
            || document.querySelector('h1')?.textContent?.trim()
            || document.title
            || '';
        const pagePath = window.location.hash || window.location.pathname;

        try {
            await db.collection('contacts').add({
                name, email,
                message:   document.getElementById('footer-feedback').value.trim(),
                pageTitle, pagePath,
                source:    'upskilled-platform',
                origin:    'footer',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            messageDiv.innerHTML =
                '<div class="message success">Got it \u2014 we\'ll be in touch.</div>';
            form.reset();
        } catch (err) {
            console.error(err);
            messageDiv.innerHTML =
                '<div class="message error">Something went wrong. Please try again.</div>';
        }

        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send';
    });
});
