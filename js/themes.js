// Темы оформления: покупаются за искры в магазине.

export const THEMES = [
  {
    id: "neon", price: 0,
    bg: ["#1a1d2b", "#11131d"], card: "#1d2131", text: "#eef0fa", muted: "#8d93ad", accent: "#7dd3fc",
    board: "rgba(255,255,255,0.035)", dot: "rgba(255,255,255,0.10)", glow: 0,
    palette: ["#4cc3ff", "#ff6ec7", "#ffd23f", "#45e3a8", "#a78bfa", "#ff9f5a", "#38bdf8", "#f472d0", "#b5f23d", "#2fe0d0"],
  },
  {
    id: "candy", price: 50000,
    bg: ["#fff1f7", "#fbd5e8"], card: "#fff7fb", text: "#3d1b2c", muted: "#8f5f75", accent: "#ec4899",
    board: "rgba(120,20,70,0.05)", dot: "rgba(120,20,70,0.16)", glow: 0,
    palette: ["#ec4899", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#d946ef", "#84cc16", "#f97316"],
  },
  {
    id: "chalk", price: 200000,
    bg: ["#33433a", "#1f2a23"], card: "#2a372f", text: "#f1f5ee", muted: "#a3b1a6", accent: "#fde68a",
    board: "rgba(255,255,255,0.04)", dot: "rgba(255,255,255,0.14)", glow: 0,
    palette: ["#f8fafc", "#fde68a", "#fbcfe8", "#bae6fd", "#bbf7d0", "#fed7aa", "#ddd6fe", "#fecaca", "#e2e8f0", "#fef9c3"],
  },
  {
    id: "ocean", price: 500000,
    bg: ["#0e3350", "#071827"], card: "#0f2c44", text: "#e6f6ff", muted: "#7fa6bf", accent: "#22d3ee",
    board: "rgba(120,220,255,0.05)", dot: "rgba(160,230,255,0.16)", glow: 8,
    palette: ["#22d3ee", "#38bdf8", "#2dd4bf", "#a5f3fc", "#67e8f9", "#5eead4", "#93c5fd", "#c7d2fe", "#99f6e4", "#e0f2fe"],
  },
  {
    id: "sunset", price: 1000000,
    bg: ["#46203f", "#1c1024"], card: "#3a1b36", text: "#fff1ea", muted: "#c39bb0", accent: "#fb923c",
    board: "rgba(255,180,150,0.05)", dot: "rgba(255,190,170,0.16)", glow: 6,
    palette: ["#fb923c", "#f472b6", "#facc15", "#f87171", "#fda4af", "#fdba74", "#e879f9", "#fcd34d", "#fb7185", "#c084fc"],
  },
  {
    id: "gold", price: 2000000,
    bg: ["#22201c", "#0c0a09"], card: "#1f1c17", text: "#fdf6e3", muted: "#a8a08a", accent: "#fbbf24",
    board: "rgba(255,215,120,0.045)", dot: "rgba(255,215,120,0.16)", glow: 12,
    palette: ["#fcd34d", "#fbbf24", "#f59e0b", "#fde68a", "#eab308", "#facc15", "#d97706", "#fef3c7", "#ca8a04", "#fef08a"],
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
