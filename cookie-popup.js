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

            const overlay = document.getElementById('cookie-overlay');

            const acceptBtn = document.getElementById('accept-cookies');
            const rejectBtn = document.getElementById('reject-cookies');
            const settingsBtn = document.getElementById('open-settings');
            const saveBtn = document.getElementById('save-settings');

            const popup = document.getElementById('cookie-popup');
            const mainBlock = popup.querySelector('.cookie-main');
            const settingsBlock = popup.querySelector('.cookie-settings');

            const toggleAnalytics = document.getElementById('toggle-analytics');
            const toggleAds = document.getElementById('toggle-ads');
            const analyticsStatus = document.getElementById('analytics-status');
            const adsStatus = document.getElementById('ads-status');

            // Реакция на Accept All
            acceptBtn.addEventListener('click', () => {
                localStorage.setItem('cookiesAccepted', 'true');
                overlay.remove();
            });

            // Реакция на Reject All
            rejectBtn.addEventListener('click', () => {
                sessionStorage.setItem('cookiesRejected', 'true');
                overlay.remove();
            });

            // Переход к настройкам
            settingsBtn.addEventListener('click', () => {
                mainBlock.style.display = 'none';
                settingsBlock.style.display = 'block';
            });

            // Обновление текста статуса по клику
            toggleAnalytics.addEventListener('change', () => {
                const val = toggleAnalytics.checked;
                analyticsStatus.textContent = val ? 'Enabled' : 'Disabled';
                analyticsStatus.className = 'status ' + (val ? 'enabled' : 'disabled');
            });

            toggleAds.addEventListener('change', () => {
                const val = toggleAds.checked;
                adsStatus.textContent = val ? 'Enabled' : 'Disabled';
                adsStatus.className = 'status ' + (val ? 'enabled' : 'disabled');
            });

            // Сохранение выбора в localStorage
            saveBtn.addEventListener('click', () => {
                const analytics = toggleAnalytics.checked;
                const ads = toggleAds.checked;

                const settings = { analytics, ads };
                localStorage.setItem('cookieSettings', JSON.stringify(settings));
                overlay.remove();
            });
        });
}

window.addEventListener('DOMContentLoaded', loadCookiePopup);
