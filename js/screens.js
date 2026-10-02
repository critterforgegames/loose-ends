// Карточки поверх игры: итог уровня, сундук, новое звание, головоломка дня, магазин.

const overlay = document.getElementById("overlay");
const card = document.getElementById("card");

export function isOpen() {
  return !overlay.hidden;
}

// Показывает карточку. buttons: [{ text, value, primary, danger }]. Возвращает Promise с value нажатой кнопки.
// onMount(card) вызывается после показа: для анимаций и своих обработчиков.
let closeCurrent = null;
let hooks = {};

// open/close вызываются при показе и закрытии карточки (игровой процесс останавливается).
export function setHooks(h) {
  hooks = h;
}

export function show(html, buttons, onMount) {
  return new Promise(resolve => {
    closeCurrent = value => { overlay.hidden = true; closeCurrent = null; hooks.close?.(); resolve(value); };
    hooks.open?.();
    const actions = buttons
      .map((b, i) => `<button type="button" data-i="${i}" class="${b.primary ? "primary" : b.danger ? "danger" : "secondary"}">${b.text}</button>`)
      .join("");
    card.innerHTML = `${html}<div class="actions">${actions}</div>`;
    card.classList.remove("pop");
    void card.offsetWidth;   // перезапуск анимации появления
    card.classList.add("pop");
    overlay.hidden = false;
    card.querySelectorAll(".actions button").forEach(el => {
      el.addEventListener("click", () => closeCurrent?.(buttons[+el.dataset.i].value));
    });
    const primary = card.querySelector(".actions .primary");
    if (primary) primary.focus({ preventScroll: true });
    if (onMount) onMount(card);
  });
}

// Закрыть текущую карточку из кода (например, чтобы перерисовать её на другом языке).
export function close(value) {
  closeCurrent?.(value);
}

export function pressPrimary() {
  if (isOpen()) card.querySelector(".actions .primary")?.click();
}

// Плавный счёт числа в элементе от 0 до to.
export function countUp(el, to, duration, format, onTick) {
  const start = performance.now();
  let lastShown = -1;
  const step = now => {
    const k = Math.max(0, Math.min(1, (now - start) / duration));   // кадр может прийти чуть раньше старта
    const v = Math.round(to * (1 - (1 - k) ** 3));
    if (v !== lastShown) {
      el.textContent = format(v);
      if (onTick && v !== to) onTick();
      lastShown = v;
    }
    if (k < 1 && document.body.contains(el)) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
