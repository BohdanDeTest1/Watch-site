
let lastScrollY = window.scrollY;
const storageKey = "aquanautConfig";

window.addEventListener("scroll", () => {
    const header = document.getElementById("header");

    if (window.innerWidth <= 768) { // Только для мобильных
        if (window.scrollY > lastScrollY) {
            header.classList.add("hide-on-scroll");
        } else {
            header.classList.remove("hide-on-scroll");
        }
        lastScrollY = window.scrollY;
    }
});



document.addEventListener("DOMContentLoaded", function () {

    const dialLayer = document.getElementById("dialLayer");
    const caseLayer = document.getElementById("caseLayer");
    const bandLayer = document.getElementById("bandLayer");

    function updateLayer(layer, path, name, ext = "png") {
        layer.src = `watchParts/7_Speedmaster/${path}/${name}.${ext}`;
    }

    function saveToLocal() {
        const dialButton = document.querySelector("#dialOptions button.selected");
        const caseButton = document.querySelector("#caseOptions button.selected");
        const bandButton = document.querySelector("#bandOptions button.selected");

        const config = {
            dial: dialButton?.dataset.value || "1",
            case: caseButton?.dataset.value || "1",
            band: bandButton?.dataset.value || "1",
        };

        localStorage.setItem(storageKey, JSON.stringify(config));
    }

    function applySelections() {

        const dialBtn = document.querySelector("#dialOptions button.selected");
        const dialValue = dialBtn ? dialBtn.dataset.value : "1";
        updateLayer(dialLayer, "dial", `dial_${dialValue}`);

        const caseBtn = document.querySelector("#caseOptions button.selected");
        const caseValue = caseBtn ? caseBtn.dataset.value : "1";
        updateLayer(caseLayer, "case", `case_${caseValue}`);

        const bandBtn = document.querySelector("#bandOptions button.selected");
        const bandValue = bandBtn ? bandBtn.dataset.value : "1";
        updateLayer(bandLayer, "band", `band_${bandValue}`);
    }

    function loadFromLocalOrURL() {
        const config = JSON.parse(localStorage.getItem(storageKey)) || {
            dial: "1",
            case: "1",
            band: "1"
        };


        const dialButtons = document.querySelectorAll("#dialOptions button");
        dialButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.dial));

        const caseButtons = document.querySelectorAll("#caseOptions button");
        caseButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.case));

        const bandButtons = document.querySelectorAll("#bandOptions button");
        bandButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.band));

        applySelections();
    }

    const toggles = [
        { toggleId: "dialToggle", menuId: "dialOptions" },
        { toggleId: "caseToggle", menuId: "caseOptions" },
        { toggleId: "bandToggle", menuId: "bandOptions" }
    ];


    toggles.forEach(({ toggleId, menuId }) => {
        const toggleEl = document.getElementById(toggleId);
        const menuEl = document.getElementById(menuId);

        toggleEl?.addEventListener("click", () => {
            const isVisible = menuEl.style.display === "flex";

            // Переключаем только текущее меню и стрелку
            menuEl.style.display = isVisible ? "none" : "flex";
            toggleEl.classList.toggle("open", !isVisible);
        });
    });


    document.getElementById("caseOptions").style.display = "flex";
    document.getElementById("caseToggle").classList.add("open");


    // SELECTORS

    document.querySelectorAll("#dialOptions button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#dialOptions button").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            updateLayer(dialLayer, "dial", `dial_${btn.dataset.value}`);
            saveToLocal();
        });
    });

    document.querySelectorAll("#caseOptions button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#caseOptions button").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            updateLayer(caseLayer, "case", `case_${btn.dataset.value}`);
            saveToLocal();
        });
    });

    document.querySelectorAll("#bandOptions button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#bandOptions button").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            updateLayer(bandLayer, "band", `band_${btn.dataset.value}`);
            saveToLocal();
        });
    });

    document.querySelectorAll('.select-wrapper select').forEach(select => {
        select.addEventListener('focus', () => {
            select.parentElement.classList.add('select-open');
        });

        select.addEventListener('blur', () => {
            select.parentElement.classList.remove('select-open');
        });
    });



    loadFromLocalOrURL();
    updateTotalPrice();

    // Добавляем вызов обновления после загрузки локальных данных


    // === Гравировка ===
    const engravingSelect = document.getElementById("engravingSelect");
    const engravingText = document.getElementById("engraveText");

    engravingSelect.addEventListener("change", () => {
        const selectedOption = engravingSelect.options[engravingSelect.selectedIndex];
        engravingText.textContent = selectedOption.textContent;
        updateTotalPrice();
    });

    // === Логотип ===
    const logoSelect = document.getElementById("logoSelect");
    const logoText = document.getElementById("logoText");

    logoSelect.addEventListener("change", () => {
        const selectedOption = logoSelect.options[logoSelect.selectedIndex];
        logoText.textContent = selectedOption.textContent;
        updateTotalPrice();
    });



    let lastScrollTop = 0;
    const header = document.getElementById('header');

    window.addEventListener('scroll', function () {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;

        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // скроллим вниз
            header.style.top = '-100px';
        } else {
            // скроллим вверх
            header.style.top = '0';
        }

        lastScrollTop = scrollTop;
    });


    function updateTotalPrice() {
        let basePrice = 1090;
        let total = basePrice;

        // Гравировка
        const engravingSelect = document.getElementById("engravingSelect");
        if (engravingSelect?.value === "withIngrave") {
            total += 150;
        }

        // Логотип
        const logoSelect = document.getElementById("logoSelect");
        if (logoSelect?.value === "otherLogo") {
            total += 50;
        }


        // Обновляем текст
        const priceDisplay = document.getElementById("priceDisplay");
        if (priceDisplay) {
            priceDisplay.textContent = `${total} PLN`;
        }
    }

    engravingSelect.dispatchEvent(new Event("change"));
    logoSelect.dispatchEvent(new Event("change"));




    const downloadBtn = document.getElementById("downloadBtn");
    const watchArea = document.getElementById("watchPreviewBox");
    //const watchArea = document.querySelector("#watchPreviewBox .watch-preview");


    downloadBtn.addEventListener("click", () => {
        const isMobile = window.innerWidth <= 768;

        // const originalHeight = watchArea.style.height;
        // const originalWidth = watchArea.style.width;
        const originalHeight = watchArea.offsetHeight + "px";
        const originalWidth = watchArea.offsetWidth + "px";

        // Временно задаем фиксированные размеры в зависимости от устройства
        if (isMobile) {
            watchArea.style.width = "320px";
            watchArea.style.height = "400px";
        } else {
            watchArea.style.width = "290px";
            watchArea.style.height = "400px";
        }

        html2canvas(watchArea, { scale: 2, backgroundColor: null }).then(canvas => {
            const link = document.createElement("a");
            link.download = "watch.png";
            link.href = canvas.toDataURL("image/png");
            link.click();

            // Возвращаем оригинальные стили
            watchArea.style.height = originalHeight;
            watchArea.style.width = originalWidth;
        });
    });

    downloadBtn.addEventListener("click", () => {
        html2canvas(watchArea, {
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement("a");
            link.download = "watch.png";
            link.href = canvas.toDataURL("image/png");
            link.click();
        });
    });


    document.getElementById("whatsappBtn").addEventListener("click", () => {
        window.open("https://wa.me/48453303550?text=Здравствуйте,%20интересует%20конфигурация%20часов", "_blank");
    });

    document.getElementById("viberBtn").addEventListener("click", () => {
        window.open("viber://chat?number=%2B380668580062", "_blank");
    });

});
