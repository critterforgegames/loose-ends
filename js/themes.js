// Темы оформления: покупаются за искры в магазине.
//
// В каждой теме 10 хорошо различимых цветов: линии должны легко отличаться друг от друга,
// иначе платная тема играется хуже бесплатной. Настроение темы задают фон, поле и оттенок
// палитры, а дорогие темы добавляют свой эффект (effect):
//   sprinkles - посыпка при вылете линии, dust - меловая пыль и меловая текстура линий,
//   bubbles - пузырьки, embers - тёплые искры, glitter - блёстки.
// ambient - редкие частицы того же эффекта на поле в покое.

export const THEMES = [
  {
    id: "neon", price: 0, effect: null, ambient: 0,
    bg: ["#1a1d2b", "#11131d"], card: "#1d2131", text: "#eef0fa", muted: "#8d93ad", accent: "#7dd3fc",
    board: "rgba(255,255,255,0.035)", dot: "rgba(255,255,255,0.10)", glow: 0,
    palette: ["#4cc3ff", "#ff6ec7", "#ffd23f", "#45e3a8", "#a78bfa", "#ff9f5a", "#38bdf8", "#f472d0", "#b5f23d", "#2fe0d0"],
  },
  {
    id: "candy", price: 50000, effect: "sprinkles", ambient: 0,
    bg: ["#fff1f7", "#fbd5e8"], card: "#fff7fb", text: "#3d1b2c", muted: "#8f5f75", accent: "#ec4899",
    board: "rgba(120,20,70,0.05)", dot: "rgba(120,20,70,0.16)", glow: 0,
    palette: ["#ec4899", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#d946ef", "#65a30d", "#f97316"],
  },
  {
    id: "chalk", price: 200000, effect: "dust", ambient: 0.6, texture: "chalk",
    bg: ["#33433a", "#1f2a23"], card: "#2a372f", text: "#f1f5ee", muted: "#a3b1a6", accent: "#fde68a",
    board: "rgba(255,255,255,0.04)", dot: "rgba(255,255,255,0.14)", glow: 0,
    palette: ["#f8fafc", "#fde047", "#f9a8d4", "#7dd3fc", "#86efac", "#fdba74", "#c4b5fd", "#fca5a5", "#5eead4", "#bef264"],
  },
  {
    id: "ocean", price: 500000, effect: "bubbles", ambient: 1.2,
    bg: ["#0e3350", "#071827"], card: "#0f2c44", text: "#e6f6ff", muted: "#7fa6bf", accent: "#22d3ee",
    board: "rgba(120,220,255,0.05)", dot: "rgba(160,230,255,0.16)", glow: 4,
    palette: ["#22d3ee", "#ff7f6e", "#ffe066", "#4ade80", "#c084fc", "#f9a8d4", "#60a5fa", "#fb923c", "#2dd4bf", "#f1f5f9"],
  },
  {
    id: "sunset", price: 1000000, effect: "embers", ambient: 1.4,
    bg: ["#46203f", "#1c1024"], card: "#3a1b36", text: "#fff1ea", muted: "#c39bb0", accent: "#fb923c",
    board: "rgba(255,180,150,0.05)", dot: "rgba(255,190,170,0.16)", glow: 4,
    palette: ["#fb923c", "#f472b6", "#facc15", "#38bdf8", "#a3e635", "#f87171", "#c084fc", "#2dd4bf", "#fda4af", "#fde68a"],
  },
  {
    id: "gold", price: 2000000, effect: "glitter", ambient: 1.6,
    bg: ["#22201c", "#0c0a09"], card: "#1f1c17", text: "#fdf6e3", muted: "#a8a08a", accent: "#fbbf24",
    board: "rgba(255,215,120,0.045)", dot: "rgba(255,215,120,0.16)", glow: 6,
    // Драгоценные камни в золоте: золото, изумруд, рубин, сапфир, аметист, жемчуг, медь, нефрит, розовый кварц, перидот.
    palette: ["#fbbf24", "#10b981", "#ef4444", "#3b82f6", "#a855f7", "#f5f5f4", "#ea7a3a", "#5eead4", "#f9a8d4", "#84cc16"],
  },
];

export function themeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

// Переносит цвета темы в CSS-переменные интерфейса.
export function applyTheme(theme) {
  const r = document.documentElement.style;
  r.setProperty("--bg", theme.bg[1]);
  r.setProperty("--bg-2", theme.bg[0]);
  r.setProperty("--card", theme.card);
  r.setProperty("--text", theme.text);
  r.setProperty("--muted", theme.muted);
  r.setProperty("--accent", theme.accent);
}

// Насколько два цвета #rrggbb различимы (0..1, по простому взвешенному RGB-расстоянию).
export function colorDistance(a, b) {
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const rm = (r1 + r2) / 2;
  const d = Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
  return d / 765;
}
