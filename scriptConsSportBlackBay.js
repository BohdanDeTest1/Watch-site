
let lastScrollY = window.scrollY;
const storageKey = "blackBayConfig";

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
    const handsLayer = document.getElementById("handsLayer");
    const secondHandLayer = document.getElementById("secondHandLayer");


    function updateLayer(layer, path, name, ext = "png") {
        layer.src = `watchParts/6_Black_Bay/${path}/${name}.${ext}`;
    }

    function saveToLocal() {
        const dialButton = document.querySelector("#dialOptions button.selected");
        const caseButton = document.querySelector("#caseOptions button.selected");
        const handsButton = document.querySelector("#handsOptions button.selected");
        const secondHandButton = document.querySelector("#secondHandOptions button.selected");

        const config = {
            dial: dialButton?.dataset.value || "1",
            case: caseButton?.dataset.value || "1",
            hands: handsButton?.dataset.value || "1",
            secondHand: secondHandButton?.dataset.value || "1"
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

        const handsBtn = document.querySelector("#handsOptions button.selected");
        const handsValue = handsBtn ? handsBtn.dataset.value : "1";
        updateLayer(handsLayer, "hands", `hands_${handsValue}`);

        const secondHandBtn = document.querySelector("#secondHandOptions button.selected");
        const secondHandValue = secondHandBtn ? secondHandBtn.dataset.value : "1";
        updateLayer(secondHandLayer, "secondHand", `second_${secondHandValue}`);
    }

    function loadFromLocalOrURL() {
        const config = JSON.parse(localStorage.getItem(storageKey)) || {

            dial: "1",
            case: "1",
            hands: "1",
            secondHand: "1"
        };

        const dialButtons = document.querySelectorAll("#dialOptions button");
        dialButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.dial));

        const caseButtons = document.querySelectorAll("#caseOptions button");
        caseButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.case));

        const handsLayerButtons = document.querySelectorAll("#handsOptions button");
        handsLayerButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.hands));

        const secondHandButtons = document.querySelectorAll("#secondHandOptions button");
        secondHandButtons.forEach(b => b.classList.toggle("selected", b.dataset.value === config.secondHand));

        applySelections();
    }

    const toggles = [
        { toggleId: "dialToggle", menuId: "dialOptions" },
        { toggleId: "caseToggle", menuId: "caseOptions" },
        { toggleId: "handsToggle", menuId: "handsOptions" },
        { toggleId: "secondHandToggle", menuId: "secondHandOptions" }
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
    // document.querySelectorAll("#braceletOptions button").forEach(btn => {
    //     btn.addEventListener("click", () => {
    //         document.querySelectorAll("#braceletOptions button").forEach(b => b.classList.remove("selected"));
    //         btn.classList.add("selected");
    //         updateLayer(braceletLayer, "bracelet", `Bracelet_${btn.dataset.value}`);
    //         saveToLocal();
    //     });
    // });

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

    document.querySelectorAll("#handsOptions button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#handsOptions button").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            updateLayer(handsLayer, "hands", `hands_${btn.dataset.value}`);
            saveToLocal();
        });
    });

    document.querySelectorAll("#secondHandOptions button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#secondHandOptions button").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            updateLayer(secondHandLayer, "secondHand", `second_${btn.dataset.value}`);
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

    //     // Показать нужную строку характеристик
    //     const solidLine = document.getElementById("spec-caseback-solid");
    //     const transparentLine = document.getElementById("spec-caseback-transparent");

    //     if (casebackSelect.value === "solid") {
    //         solidLine.style.display = "list-item";
    //         transparentLine.style.display = "none";
    //     } else {
    //         solidLine.style.display = "none";
    //         transparentLine.style.display = "list-item";
    //     }
    // });

    casebackSelect.addEventListener("change", () => {
        const selectedOption = casebackSelect.options[casebackSelect.selectedIndex];
        casebackText.textContent = selectedOption.textContent;
        updateBezelVisibility();

        const solidLine = document.getElementById("spec-caseback-solid");
        const transparentLine = document.getElementById("spec-caseback-transparent");

        if (casebackSelect.value === "solid") {
            solidLine.style.display = "list-item";
            transparentLine.style.display = "none";
            bezelText.textContent = "";
            bezelText.style.display = "none";
        } else {
            solidLine.style.display = "none";
            transparentLine.style.display = "list-item";

            if (bezelTypeSelect.value === "custom") {
                const number = parseInt(bezelNumberInput.value.trim(), 10);
                if (!isNaN(number) && number >= 1 && number <= 129) {
                    bezelText.textContent = `Rotor #${number} (+100PLN)`;
                    bezelText.style.display = "block";
                }
            } else if (bezelTypeSelect.value === "standard") {
                bezelText.textContent = bezelTypeSelect.options[0].textContent;
                bezelText.style.display = "block";
            } else {
                bezelText.textContent = "";
                bezelText.style.display = "none";
            }
        }

    });



    bezelTypeSelect.addEventListener("change", () => {
        updateBezelVisibility();
        updateTotalPrice();

        const bezelValue = bezelTypeSelect.value;
        const number = parseInt(bezelNumberInput.value.trim(), 10);
        if (bezelValue === "custom" && !isNaN(number) && number >= 1 && number <= 129) {
            bezelText.textContent = `Rotor #${number} (+100PLN)`;
            bezelText.style.display = "block";
        } else if (bezelValue === "standard") {
            const standardText = bezelTypeSelect.options[bezelTypeSelect.selectedIndex].textContent;
            bezelText.textContent = standardText;
            bezelText.style.display = "block";
        } else {
            bezelText.textContent = "";
            bezelText.style.display = "none";
        }

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

    const infoBtn2 = document.getElementById("infoButton2");
    const infoTooltip2 = document.getElementById("infoTooltip2");


    if (isMobile) {
        infoBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // важно!
            const isVisible = infoTooltip2.style.display === "block";
            infoTooltip2.style.display = isVisible ? "none" : "block";
        });

        // Закрытие при тапе вне тултипа
        document.addEventListener("click", (e) => {
            if (!infoTooltip2.contains(e.target) && !infoBtn2.contains(e.target)) {
                infoTooltip2.style.display = "none";
            }
        });
    } else {
        // для десктопа — при наведении
        infoBtn2.addEventListener("mouseenter", () => {
            infoTooltip2.style.display = "block";
        });
        infoBtn2.addEventListener("mouseleave", () => {
            infoTooltip2.style.display = "none";
        });
        infoTooltip2.addEventListener("mouseleave", () => {
            infoTooltip2.style.display = "none";
        });
    }
    if (window.innerWidth <= 768) {
        infoBtn2.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = infoTooltip2.style.display === "block";
            infoTooltip2.style.display = isVisible ? "none" : "block";
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


    const downloadBtn = document.getElementById("downloadBtn");
    const watchArea = document.getElementById("watchPreviewBox"); // Это div с часами

    downloadBtn.addEventListener("click", () => {
        const isMobile = window.innerWidth <= 768;

        const originalHeight = watchArea.style.height;
        const originalWidth = watchArea.style.width;

        // Временно задаем фиксированные размеры в зависимости от устройства
        if (isMobile) {
            watchArea.style.width = "360px";
            watchArea.style.height = "400px";
        } else {
            watchArea.style.width = "280px";
            watchArea.style.height = "400px";
        }

        html2canvas(watchArea, { scale: 2 }).then(canvas => {
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
