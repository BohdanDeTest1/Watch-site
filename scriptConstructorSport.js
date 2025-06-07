// scriptConstructorSport.js

const availability = {
    "AQUANAUT": true,
    "NUTILUS-SPORT": true,
    "PRX": false,
    "ROYAL-CHRONOGRAPH": true,
    "ROYAL": true,
    "SEMASTER": false,
    "SKX007": false,
    "SUBMARINER": true
};

document.addEventListener("DOMContentLoaded", () => {
    // Подключение общего хедера и футера
    const load = (selector, file) => {
        fetch(file)
            .then(res => res.text())
            .then(html => document.querySelector(selector).innerHTML = html);
    };

    load("#header", "header.html");
    load("#footer", "footer.html");

    // Обработка кнопок
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
