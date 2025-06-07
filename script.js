import 'animate.css';
// Карусель
const carousel = document.getElementById("carousel");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
let currentIndex = 0;
let autoSlideInterval;

const images = [
    "model-0-aquanaut.png",
    "model-1-classic.png",
    "model-2-Datejust.png",
    "model-3-daytona.png",
    "model-4-Nautilus.png",
    "model-5-royal.png",
    "model-6.png",
    "model-7-santos.png",
    "model-8.png",
    "model-9-skx007.png",
    "model-10-pressage.png",
    "model-11.png",
    "model-12.png",
    "model-13.png",
    "model-14-nautilus-sport.png"
];

function renderCarousel() {
    carousel.innerHTML = "";
    images.forEach((img, i) => {
        const slide = document.createElement("div");
        slide.className = "carousel-slide";
        slide.innerHTML = `
      <img src="first_page_switcher/${img}" alt="model-${i}" />
      <p>model ${i}</p>
      <p>1000 ZL</p>
      <a href="pageConstructorsSections.html">Конструктор</a>
    `;
        carousel.appendChild(slide);
    });
}

function moveCarousel(index) {
    const slide = carousel.querySelector(".carousel-slide");
    if (!slide) return;
    const visibleCount = window.innerWidth > 768 ? 4 : 1;
    const slideWidth = slide.offsetWidth + 20;
    const maxIndex = Math.max(0, images.length - visibleCount);
    currentIndex = Math.min(Math.max(index, 0), maxIndex);
    carousel.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
}

function nextSlide() {
    const step = window.innerWidth > 768 ? 2 : 1;
    moveCarousel(currentIndex + step);
}

function prevSlide() {
    const step = window.innerWidth > 768 ? 2 : 1;
    moveCarousel(currentIndex - step);
}

function swipeCarousel() {
    let startX = 0;
    carousel.addEventListener("touchstart", (e) => startX = e.touches[0].clientX);
    carousel.addEventListener("touchend", (e) => {
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        if (diff > 50) nextSlide();
        if (diff < -50) prevSlide();
    });
}

function startAutoSlide() {
    autoSlideInterval = setInterval(nextSlide, 5000);
}

function stopAutoSlide() {
    clearInterval(autoSlideInterval);
}

// FAQ переключение
// // FAQ переключение при клике
// document.querySelectorAll('.faq-question').forEach(btn => {
//     btn.addEventListener('click', () => {
//         const item = btn.closest('.faq-item');
//         const allItems = document.querySelectorAll('.faq-item');

//         allItems.forEach(el => {
//             if (el !== item) {
//                 el.classList.remove('active');
//                 el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
//                 el.querySelector('.faq-question .icon').textContent = '+';
//             }
//         });

//         const isExpanded = item.classList.toggle('active');
//         btn.setAttribute('aria-expanded', isExpanded);
//         btn.querySelector('.icon').textContent = isExpanded ? '−' : '+';
//     });
// });

document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const answer = item.querySelector('.faq-answer');
        const icon = btn.querySelector('.icon');
        const isActive = item.classList.contains('active');

        // Закрываем все открытые
        document.querySelectorAll('.faq-item').forEach(el => {
            if (el !== item) {
                el.classList.remove('active');
                el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                el.querySelector('.faq-question .icon').textContent = '+';
                el.querySelector('.faq-answer').style.maxHeight = null;
            }
        });

        // Переключаем текущий
        item.classList.toggle('active');
        btn.setAttribute('aria-expanded', !isActive);
        icon.textContent = !isActive ? '−' : '+';

        if (!isActive) {
            answer.style.maxHeight = answer.scrollHeight + 'px';
        } else {
            answer.style.maxHeight = null;
        }
    });
});


// Инициализация
window.addEventListener("DOMContentLoaded", () => {
    renderCarousel();
    moveCarousel(0);
    swipeCarousel();
    startAutoSlide();

    prevBtn.addEventListener("click", () => {
        stopAutoSlide();
        prevSlide();
        startAutoSlide();
    });

    nextBtn.addEventListener("click", () => {
        stopAutoSlide();
        nextSlide();
        startAutoSlide();
    });

    carousel.addEventListener("mouseenter", stopAutoSlide);
    carousel.addEventListener("mouseleave", startAutoSlide);

    window.addEventListener("resize", () => moveCarousel(currentIndex));
});