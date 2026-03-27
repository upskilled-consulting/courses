document.addEventListener('DOMContentLoaded', () => {
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

    const form      = document.getElementById('footer-contact-form');
    if (!form) return;

    const messageDiv = document.getElementById('footer-form-message');
    const submitBtn  = document.getElementById('footer-submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('footer-email').value.trim();
        if (!email) return;

        submitBtn.disabled    = true;
        submitBtn.textContent = 'Sending\u2026';

        try {
            await db.collection('contacts').add({
                name:      document.getElementById('footer-name').value.trim(),
                email,
                message:   '',
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
