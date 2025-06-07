function loadCookiePopup() {
    if (localStorage.getItem('cookiesAccepted') !== null || sessionStorage.getItem('cookiesRejected') === 'true') {
        return;
    }

    fetch('cookie-popup.html')
        .then(res => res.text())
        .then(html => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            document.body.appendChild(wrapper);

            document.getElementById('accept-cookies').addEventListener('click', () => {
                localStorage.setItem('cookiesAccepted', 'true');
                document.getElementById('cookie-overlay').remove();
            });

            document.getElementById('reject-cookies').addEventListener('click', () => {
                sessionStorage.setItem('cookiesRejected', 'true');
                document.getElementById('cookie-overlay').remove();
            });
        });
}

window.addEventListener('DOMContentLoaded', loadCookiePopup);
