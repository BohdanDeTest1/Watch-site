document.addEventListener("DOMContentLoaded", function () {
    const carouselWrapper = document.querySelector(".carousel");       // внешний контейнер
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

        items.forEach((item) => {
            const card = document.createElement("div");
            card.className = "carousel-card";
            const buttonText = tab === "design" ? "go to constructor" : "check the model";
            const buttonLink = tab === "design" ? "/pageConstructorsSections.html" : "/pageModels.html";

            card.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <h3>${item.name}</h3>
            <p>${item.price}</p>
            <a href="${buttonLink}" class="btn-to-watch">${buttonText}</a>
        `;
            carousel.appendChild(card);
        });

        updateCarouselTransform();
    }



    // 

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelector(".tab-button.active").classList.remove("active");
            tab.classList.add("active");
            currentTab = tab.dataset.tab;
            currentIndex = 0;
            renderCarousel();
        });
    });

    prev.addEventListener("click", () => {
        const items = data[currentTab];
        const maxIndex = items.length - getVisibleCount();

        if (currentIndex > 0) {
            currentIndex--;
        } else {
            currentIndex = maxIndex;
        }

        updateCarouselTransform();
    });

    next.addEventListener("click", () => {
        const items = data[currentTab];
        const maxIndex = items.length - getVisibleCount();

        if (currentIndex < maxIndex) {
            currentIndex++;
        } else {
            currentIndex = 0;
        }

        updateCarouselTransform();
    });


    window.addEventListener("resize", () => {
        updateCarouselTransform(); // просто пересчитать, не рендерить заново
    });

    // Start with 'design' tab
    renderCarousel("design");


    let startX = 0;
    let isDragging = false;

    carousel.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
        isDragging = true;
    }, { passive: true });

    carousel.addEventListener("touchmove", e => {
        if (!isDragging) return;
        const deltaX = e.touches[0].clientX - startX;

        if (deltaX > 50 && currentIndex > 0) {
            currentIndex--;
            renderCarousel();
            isDragging = false;
        } else if (deltaX < -50 && currentIndex < data[currentTab].length - 1) {
            currentIndex++;
            renderCarousel();
            isDragging = false;
        }
    }, { passive: true });

    carousel.addEventListener("touchend", () => {
        isDragging = false;
    });



    function updateCarouselTransform() {
        const visibleCount = getVisibleCount();
        const items = data[currentTab];
        const maxIndex = items.length - visibleCount;

        if (currentIndex > maxIndex) {
            currentIndex = 0;
        }

        const cardWidth = carouselInner.querySelector(".carousel-card")?.offsetWidth || 240;
        const gap = 20;
        const offset = (cardWidth + gap) * currentIndex;

        carouselInner.style.setProperty('--animation-speed', `${animationSpeed}ms`);
        carouselInner.style.transform = `translateX(-${offset}px)`;
    }
});
