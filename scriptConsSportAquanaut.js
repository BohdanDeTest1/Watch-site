
let lastScrollY = window.scrollY;

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
    const braceletLayer = document.getElementById("braceletLayer");
    const dialLayer = document.getElementById("dialLayer");
    const caseLayer = document.getElementById("caseLayer");

    function updateLayer(layer, path, name, ext = "png") {
        layer.src = `watchParts/1_Aquanaut/${path}/${name}.${ext}`;
    }

    function saveToLocal() {
        const braceletButton = document.querySelector("#braceletOptions button.selected");
        const dialButton = document.querySelector("#dialOptions button.selected");
        const caseButton = document.querySelector("#caseOptions button.selected");

        const config = {
            bracelet: braceletButton?.dataset.value || "1",
            dial: dialButton?.dataset.value || "1",
            case: caseButton?.dataset.value || "1",
        };

        localStorage.setItem("aquanautConfig", JSON.stringify(config));
    }

    function applySelections() {
        const braceletBtn = document.querySelector("#braceletOptions button.selected");
        const braceletValue = braceletBtn ? braceletBtn.dataset.value : "1";
        updateLayer(braceletLayer, "bracelet", `Bracelet_${braceletValue}`);

        const dialBtn = document.querySelector("#dialOptions button.selected");
        const dialValue = dialBtn ? dialBtn.dataset.value : "1";
        updateLayer(dialLayer, "dial", `dial_${dialValue}`);

        const caseBtn = document.querySelector("#caseOptions button.selected");
        const caseValue = caseBtn ? caseBtn.dataset.value : "1";
        updateLayer(caseLayer, "case", `case_${caseValue}`);
    }

    function loadFromLocalOrURL() {
        const config = JSON.parse(localStorage.getItem("aquanautConfig")) || {
            bracelet: "1",
            dial: "1",
            case: "1",
        };

        const braceletButtons = document.querySelectorAll("#braceletOptions button");
        braceletButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.bracelet));

        const dialButtons = document.querySelectorAll("#dialOptions button");
        dialButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.dial));

        const caseButtons = document.querySelectorAll("#caseOptions button");
        caseButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.case));

        applySelections();
    }

    const toggles = [
        { toggleId: "braceletToggle", menuId: "braceletOptions" },
        { toggleId: "dialToggle", menuId: "dialOptions" },
        { toggleId: "caseToggle", menuId: "caseOptions" }
    ];


    // toggles.forEach(({ toggleId, menuId }) => {
    //     const toggleEl = document.getElementById(toggleId);
    //     const menuEl = document.getElementById(menuId);

    //     toggleEl?.addEventListener("click", () => {
    //         const isVisible = menuEl.style.display === "flex";

    //         // Закрываем все меню и стрелки
    //         toggles.forEach(({ toggleId: otherToggleId, menuId: otherMenuId }) => {
    //             const otherMenu = document.getElementById(otherMenuId);
    //             const otherToggle = document.getElementById(otherToggleId);
    //             if (otherMenu && otherToggle) {
    //                 otherMenu.style.display = "none";
    //                 otherToggle.classList.remove("open");
    //             }
    //         });

    //         // Переключаем текущее меню и стрелку
    //         if (!isVisible) {
    //             menuEl.style.display = "flex";
    //             toggleEl.classList.add("open");
    //         }
    //     });
    // });

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


    document.getElementById("braceletOptions").style.display = "flex";
    document.getElementById("braceletToggle").classList.add("open");


    // SELECTORS
    document.querySelectorAll("#braceletOptions button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#braceletOptions button").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            updateLayer(braceletLayer, "bracelet", `Bracelet_${btn.dataset.value}`);
            saveToLocal();
        });
    });

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

    document.querySelectorAll('.select-wrapper select').forEach(select => {
        select.addEventListener('focus', () => {
            select.parentElement.classList.add('select-open');
        });

        select.addEventListener('blur', () => {
            select.parentElement.classList.remove('select-open');
        });
    });

    // if (!localStorage.getItem("caseback")) {
    //     casebackSelect.value = "solid";
    //     casebackText.textContent = casebackSelect.options[casebackSelect.selectedIndex].textContent;
    //     bezelConfigBox.style.display = "block";
    // }

    loadFromLocalOrURL();


    // === Гравировка ===
    const engravingSelect = document.getElementById("engravingSelect");
    const engravingText = document.getElementById("engraveText");

    engravingSelect.addEventListener("change", () => {
        const selectedOption = engravingSelect.options[engravingSelect.selectedIndex];
        engravingText.textContent = selectedOption.textContent;
    });

    // === Логотип ===
    const logoSelect = document.getElementById("logoSelect");
    const logoText = document.getElementById("logoText");

    logoSelect.addEventListener("change", () => {
        const selectedOption = logoSelect.options[logoSelect.selectedIndex];
        logoText.textContent = selectedOption.textContent;
    });

    // === Задняя крышка ===
    // === Задняя крышка ===
    const casebackSelect = document.getElementById("casebackSelect");
    const casebackText = document.getElementById("casebackText");
    const bezelTypeWrapper = document.getElementById("bezelTypeWrapper");
    const bezelTypeSelect = document.getElementById("bezelTypeSelect");
    const bezelConfigBox = document.getElementById("bezelConfigBox");
    const bezelText = document.getElementById("bezelText");

    function updateBezelVisibility() {
        const isTransparent = casebackSelect.value === "transparent";
        const bezelValue = bezelTypeSelect.value;

        // Показываем селектор "Безель", только если крышка прозрачная
        bezelTypeWrapper.style.display = isTransparent ? "block" : "none";

        // Показываем номер и галерею, только если и прозрачная крышка и кастомный безель
        bezelConfigBox.style.display = (isTransparent && bezelValue === "custom") ? "block" : "none";

        // Отображение текста "Стандартный безель"
        if (isTransparent && bezelValue === "standard") {
            bezelText.textContent = "Стандартный ротор";
            bezelText.style.display = "block";
        } else {
            bezelText.textContent = "";
            bezelText.style.display = "none";
        }
    }

    const bezelNumberInput = document.getElementById("bezelNumber");
    const applyBezelNumberBtn = document.getElementById("applyBezelNumberBtn");
    const bezelNumberError = document.getElementById("bezelNumberError");

    applyBezelNumberBtn.addEventListener("click", () => {
        const number = parseInt(bezelNumberInput.value.trim(), 10);

        if (!number || number < 1 || number > 129) {
            bezelNumberError.style.display = "block";
            bezelText.textContent = "";
            bezelText.style.display = "none";
        } else {
            bezelNumberError.style.display = "none";
            bezelText.textContent = `Rotor #${number} (+100PLN)`;
            bezelText.style.display = "block";
        }
    });




    // casebackSelect.addEventListener("change", () => {
    //     const selectedOption = casebackSelect.options[casebackSelect.selectedIndex];
    //     casebackText.textContent = selectedOption.textContent;
    //     updateBezelVisibility();
    // });
    casebackSelect.addEventListener("change", () => {
        const selectedOption = casebackSelect.options[casebackSelect.selectedIndex];
        casebackText.textContent = selectedOption.textContent;
        updateBezelVisibility();

        // Показать нужную строку характеристик
        const solidLine = document.getElementById("spec-caseback-solid");
        const transparentLine = document.getElementById("spec-caseback-transparent");

        if (casebackSelect.value === "solid") {
            solidLine.style.display = "list-item";
            transparentLine.style.display = "none";
        } else {
            solidLine.style.display = "none";
            transparentLine.style.display = "list-item";
        }
    });


    bezelTypeSelect.addEventListener("change", () => {
        updateBezelVisibility();
        updateTotalPrice();
    });

    // начальная проверка при загрузке
    updateBezelVisibility();


    // === Галерея бейзелов ===
    const bezelImages = document.querySelectorAll(".bezel-img");
    const prevBtn = document.querySelector(".bezel-prev-btn");
    const nextBtn = document.querySelector(".bezel-next-btn");

    let currentBezelIndex = 0;

    function updateBezelGallery() {
        bezelImages.forEach((img, index) => {
            img.classList.toggle("active", index === currentBezelIndex);
        });
    }

    prevBtn.addEventListener("click", () => {
        currentBezelIndex = (currentBezelIndex - 1 + bezelImages.length) % bezelImages.length;
        updateBezelGallery();
    });

    nextBtn.addEventListener("click", () => {
        currentBezelIndex = (currentBezelIndex + 1) % bezelImages.length;
        updateBezelGallery();
    });

    // Показываем первый бейзел по умолчанию
    updateBezelGallery();

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

    const infoBtn = document.getElementById("infoButton");
    const infoTooltip = document.getElementById("infoTooltip");
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        infoBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // важно!
            const isVisible = infoTooltip.style.display === "block";
            infoTooltip.style.display = isVisible ? "none" : "block";
        });

        // Закрытие при тапе вне тултипа
        document.addEventListener("click", (e) => {
            if (!infoTooltip.contains(e.target) && !infoBtn.contains(e.target)) {
                infoTooltip.style.display = "none";
            }
        });
    } else {
        // для десктопа — при наведении
        infoBtn.addEventListener("mouseenter", () => {
            infoTooltip.style.display = "block";
        });
        infoBtn.addEventListener("mouseleave", () => {
            infoTooltip.style.display = "none";
        });
        infoTooltip.addEventListener("mouseleave", () => {
            infoTooltip.style.display = "none";
        });
    }

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

        // Ротор (если кастомный и валидный номер от 1 до 129)
        const bezelTypeSelect = document.getElementById("bezelTypeSelect");
        const bezelNumberInput = document.getElementById("bezelNumber");
        if (bezelTypeSelect?.value === "custom") {
            const number = parseInt(bezelNumberInput.value, 10);
            if (!isNaN(number) && number >= 1 && number <= 129) {
                total += 100;
            }
        }

        // Обновляем текст
        const priceDisplay = document.getElementById("priceDisplay");
        if (priceDisplay) {
            priceDisplay.textContent = `${total} PLN`;
        }
    }
    engravingSelect.addEventListener("change", () => {
        const selectedOption = engravingSelect.options[engravingSelect.selectedIndex];
        engravingText.textContent = selectedOption.textContent;
        updateTotalPrice();
    });

    logoSelect.addEventListener("change", () => {
        const selectedOption = logoSelect.options[logoSelect.selectedIndex];
        logoText.textContent = selectedOption.textContent;
        updateTotalPrice();
    });

    applyBezelNumberBtn.addEventListener("click", () => {
        const number = parseInt(bezelNumberInput.value.trim(), 10);

        if (!number || number < 1 || number > 129) {
            bezelNumberError.style.display = "block";
            bezelText.textContent = "";
            bezelText.style.display = "none";
        } else {
            bezelNumberError.style.display = "none";
            bezelText.textContent = `Rotor #${number} (+100PLN)`;
            bezelText.style.display = "block";
        }

        updateTotalPrice(); // ← Добавь сюда
    });
    const event = new Event("change");
    casebackSelect.dispatchEvent(event);

});
