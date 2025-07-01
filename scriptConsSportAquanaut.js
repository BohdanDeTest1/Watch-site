
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


});
