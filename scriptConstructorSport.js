// scriptConstructorSport.js

const availability = {
    "AQUANAUT": true,
    "NUTILUS-SPORT": true,
    "PRX": true,
    "ROYAL-CHRONOGRAPH": true,
    "ROYAL": true,
    "SEMASTER": true,
    "SKX007": false,
    "SUBMARINER": true
};

document.addEventListener("DOMContentLoaded", () => {
    // Загружаем header и footer, и только после этого вызываем initCollapsibleHeader
    const load = (selector, file) => {
        return fetch(file)
            .then(res => res.text())
            .then(html => {
                document.querySelector(selector).innerHTML = html;
            });
    };

    Promise.all([
        load("#header", "header.html"),
        load("#footer", "footer.html")
    ]).then(() => {
        // вызываем initCollapsibleHeader ПОСЛЕ загрузки хедера
        if (typeof initCollapsibleHeader === "function") {
            initCollapsibleHeader();
        }
        if (typeof initHoverUnderline === "function") {
            initHoverUnderline();
        }
        if (typeof initNewLangSelector === "function") {
            initNewLangSelector();
        }

        // затем активируем обработку кнопок
        const buttons = document.querySelectorAll(".sport-btn");
        const popup = document.getElementById("popup");

        buttons.forEach(btn => {
            const name = btn.dataset.name;
            const isAvailable = availability[name];

            if (!isAvailable) {
                btn.classList.add("disabled");
            }

            btn.addEventListener("click", () => {
                if (!isAvailable) {
                    popup.style.display = "block";
                    setTimeout(() => popup.style.display = "none", 5000);
                } else {
                    const url = btn.dataset.url;
                    window.location.href = url;
                }
            });
        });
    });
});
