// Файл: watch-configurator.js

function changePart(part, id) {
    const img = document.getElementById(`layer-${part}`);
    if (img) {
        img.src = `img/${part}${id}.png`;
    }
}
