document.addEventListener("DOMContentLoaded", function () {
    const carouselInner = document.querySelector(".carousel-inner");
    const tabs = document.querySelectorAll(".tab-button");
    const prev = document.getElementById("prev");
    const next = document.getElementById("next");
    const animationSpeed = 500;

    const data = {
        design: [
            { image: "first_page_switcher/model-0-aquanaut.png", name: "Model Aquanaut", price: "$99" },
            { image: "first_page_switcher/model-1-classic.png", name: "Model Classic", price: "$100" },
            { image: "first_page_switcher/model-2-Datejust.png", name: "Model Datejust", price: "$110" },
            { image: "first_page_switcher/model-3-daytona.png", name: "Model Daytona", price: "$120" },
            { image: "first_page_switcher/model-4-Nautilus.png", name: "Model Nautilus", price: "$130" },
            { image: "first_page_switcher/model-14-nautilus-sport.png", name: "Model Nautilus Sport", price: "$135" },
            { image: "first_page_switcher/model-5-royal.png", name: "Model Royal Oak", price: "$140" },
            { image: "first_page_switcher/model-6.png", name: "Model PRX", price: "$150" },
            { image: "first_page_switcher/model-9-skx007.png", name: "Model SKX007", price: "$160" },
            { image: "first_page_switcher/model-12.png", name: "Model Speedmaster", price: "$180" },
            { image: "first_page_switcher/model-11.png", name: "Model Seamaster", price: "$190" },
            { image: "first_page_switcher/model-7-santos.png", name: "Model Santos", price: "$200" }
        ],
        ready: [
            { image: "first_page_switcher/model-4-Nautilus.png", name: "Model Nautilus", price: "$130" },
            { image: "first_page_switcher/model-14-nautilus-sport.png", name: "Model Nautilus Sport", price: "$135" },
            { image: "first_page_switcher/model-5-royal.png", name: "Model Royal Oak", price: "$140" },
            { image: "first_page_switcher/model-6.png", name: "Model PRX", price: "$150" },
            { image: "first_page_switcher/model-9-skx007.png", name: "Model SKX007", price: "$160" },
            { image: "first_page_switcher/model-12.png", name: "Model Speedmaster", price: "$180" },
            { image: "first_page_switcher/model-11.png", name: "Model Seamaster", price: "$190" },
            { image: "first_page_switcher/model-7-santos.png", name: "Model Santos", price: "$200" }
        ]
    };

    let currentTab = 'design';
    let currentIndex = 0;

    function getVisibleCount() {
        return window.innerWidth < 768 ? 1 : 4;
    }

    function renderCarousel(tab = currentTab) {
        const visibleCount = getVisibleCount();
        const items = data[tab];

        carouselInner.innerHTML = "";

        // Создаём клоны
        const cloneStart = items.slice(-visibleCount);
        const cloneEnd = items.slice(0, visibleCount);
        const fullList = [...cloneStart, ...items, ...cloneEnd];

        fullList.forEach(item => {
            const card = document.createElement("div");
            card.className = "carousel-card";
            const btnText = tab === "design" ? "GO TO CONSTRUCTOR" : "CHECK THE MODEL";
            const btnLink = tab === "design" ? "/pageConstructorsSections.html" : "/pageModels.html";

            card.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <h3>${item.name}</h3>
                <p>${item.price}</p>
                <a href="${btnLink}" class="btn-to-watch">${btnText}</a>
            `;
            carouselInner.appendChild(card);
        });

        currentIndex = visibleCount;
        updateTransform(false);
    }

    function updateTransform(animate = true) {
        const visibleCount = getVisibleCount();
        const card = carouselInner.querySelector(".carousel-card");
        if (!card) return;

        const cardWidth = card.offsetWidth;
        const gap = 20;
        const offset = (cardWidth + gap) * currentIndex;

        carouselInner.style.transition = animate ? `transform ${animationSpeed}ms ease` : "none";
        carouselInner.style.transform = `translateX(-${offset}px)`;
    }

    function shift(direction) {
        const visibleCount = getVisibleCount();
        const itemsLength = data[currentTab].length;

        if (direction === "next") {
            currentIndex++;
            updateTransform(true);
            if (currentIndex === itemsLength + visibleCount) {
                setTimeout(() => {
                    carouselInner.style.transition = "none";
                    currentIndex = visibleCount;
                    updateTransform(false);
                }, animationSpeed);
            }
        } else {
            currentIndex--;
            updateTransform(true);
            if (currentIndex === 0) {
                setTimeout(() => {
                    carouselInner.style.transition = "none";
                    currentIndex = itemsLength;
                    updateTransform(false);
                }, animationSpeed);
            }
        }
    }

    next.addEventListener("click", () => shift("next"));
    prev.addEventListener("click", () => shift("prev"));

    window.addEventListener("resize", () => renderCarousel());

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelector(".tab-button.active")?.classList.remove("active");
            tab.classList.add("active");
            currentTab = tab.dataset.tab;
            renderCarousel();
        });
    });

    renderCarousel();
});
