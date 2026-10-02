// Мета-прогресс: очки и комбо, звёзды, IQ и звания, сундуки, головоломка дня и серия.
// Чистая логика без DOM: всё проверяется тестами.

import { levelKind } from "./level.js?v=233368dc1d";

export const SAVE_VERSION = 3;
export const MAX_HINTS = 5;
export const COMBO_WINDOW = 1.8;   // секунды между ходами, чтобы комбо не сбросилось
export const CHEST_EVERY = 5;      // сундук за каждый 5-й уровень
export const DAILY_DIFFICULTY = 35;   // параметры трудного уровня (каждый 5-й)

// Звания по накопленному опыту мозга (xp). Первые даются за пару уровней,
// дальше пороги растут примерно экспоненциально: Легенда - сотни уровней.
export const RANKS = [
  { xp: 0, key: "novice" },
  { xp: 15, key: "amateur" },
  { xp: 30, key: "apprentice" },
  { xp: 55, key: "curious" },
  { xp: 80, key: "quick" },
  { xp: 120, key: "sharp" },
  { xp: 175, key: "clever" },
  { xp: 245, key: "thinker" },
  { xp: 335, key: "expert" },
  { xp: 455, key: "scholar" },
  { xp: 620, key: "brilliant" },
  { xp: 830, key: "sage" },
  { xp: 1100, key: "professor" },
  { xp: 1480, key: "genius" },
  { xp: 1970, key: "visionary" },
  { xp: 2630, key: "mastermind" },
  { xp: 3480, key: "grandmaster" },
  { xp: 4640, key: "oracle" },
  { xp: 6140, key: "legend" },
  { xp: 8200, key: "mythic" },
];
// После последнего звания - звёзды: «Мифический ★2» за каждые следующие 3000 xp.
export const STAR_XP = 3000;

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    level: 1,
    best: 0,
    hints: 3,
    sparks: 0,
    xp: 0,
    bestCombo: 0,
    theme: "neon",
    owned: ["neon"],
    sound: true,
    vibration: true,
    lang: "auto",   // "auto" - язык браузера или YouTube, иначе код языка
    daily: { last: "", streak: 0 },
  };
}

// Читает сохранение любой версии: чего нет или что испорчено - берётся по умолчанию.
export function parseSave(text) {
  const s = defaultSave();
  let d;
  try { d = JSON.parse(text); } catch { return s; }
  if (!d || typeof d !== "object") return s;
  const int = (v, min, max, def) => Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : def;
  s.level = int(d.level, 1, 1e6, 1);
  s.best = int(d.best, 0, 1e6, 0);
  s.hints = int(d.hints, 0, MAX_HINTS, 3);
  s.sparks = int(d.sparks, 0, 1e9, 0);
  // Версия 2 хранила IQ (90 + 2 за уровень); переводим в опыт по 5 xp за единицу.
  s.xp = Number.isFinite(d.xp) ? int(d.xp, 0, 1e9, 0) : Number.isFinite(d.iq) ? Math.max(0, Math.floor(d.iq) - 90) * 5 : 0;
  s.bestCombo = int(d.bestCombo, 0, 1e6, 0);
  if (Array.isArray(d.owned)) s.owned = [...new Set(["neon", ...d.owned.filter(x => typeof x === "string")])];
  if (typeof d.theme === "string" && s.owned.includes(d.theme)) s.theme = d.theme;
  if (typeof d.sound === "boolean") s.sound = d.sound;
  if (typeof d.vibration === "boolean") s.vibration = d.vibration;
  if (typeof d.lang === "string" && /^(auto|[a-z]{2})$/.test(d.lang)) s.lang = d.lang;
  if (d.daily && typeof d.daily.last === "string") {
    s.daily = { last: d.daily.last, streak: int(d.daily.streak, 0, 1e5, 0) };
  }
  return s;
}

// ---------- очки ----------

// ×1 до третьего хода подряд, дальше +1 за каждые три, максимум ×4.
export function comboMultiplier(combo) {
  return Math.min(4, 1 + Math.floor(combo / 3));
}

export function linePoints(length, combo) {
  return 10 * length * comboMultiplier(combo);
}

export function starsFor(mistakes) {
  return Math.max(1, 3 - mistakes);
}

// Итог уровня: очки за линии, +50% за чистое прохождение; к сумме +50% на трудном
// уровне и x2 на боссе (kind: normal | hard | boss).
export function levelReward(points, mistakes, kind = "normal") {
  const perfect = mistakes === 0 ? Math.round(points / 2) : 0;
  const base = points + perfect;
  const bonus = kind === "boss" ? base : kind === "hard" ? Math.round(base / 2) : 0;
  return { points, perfect, bonus, kind, total: base + bonus };
}

// Опыт мозга за уровень: 10 за 3 звезды, 6 за 2, 4 за 1; трудный x1.5, босс x2.
export function xpGain(stars, kind = "normal") {
  const k = kind === "boss" ? 2 : kind === "hard" ? 1.5 : 1;
  return Math.round([0, 4, 6, 10][stars] * k);
}

export const DAILY_XP = 15;

// IQ растёт всё медленнее: 70 на старте, ~100 к 12-му уровню, ~143 к сотому, ~200 к тысячному.
export function iqFromXp(xp) {
  return 70 + Math.round(25 * Math.log(1 + xp / 40));
}

// Номер звания; после последнего растут звёзды (stars >= 1 только на последнем).
export function rankOf(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const lastXp = RANKS[RANKS.length - 1].xp;
  const stars = i === RANKS.length - 1 ? 1 + Math.floor((xp - lastXp) / STAR_XP) : 0;
  return { index: i, key: RANKS[i].key, stars, level: i + Math.max(0, stars - 1) };
}

// Доля пути до следующего звания или звезды (0..1).
export function rankProgress(xp) {
  const r = rankOf(xp);
  if (r.stars) return ((xp - RANKS[RANKS.length - 1].xp) % STAR_XP) / STAR_XP;
  return (xp - RANKS[r.index].xp) / (RANKS[r.index + 1].xp - RANKS[r.index].xp);
}

// ---------- сундуки ----------

export function chestDue(level) {
  return level % CHEST_EVERY === 0;
}

// Сколько уровней пройти (включая текущий), чтобы получить сундук.
export function levelsToChest(level) {
  return CHEST_EVERY - ((level - 1) % CHEST_EVERY);
}

export function chestReward(level) {
  const k = levelKind(level) === "boss" ? 2 : 1;
  return { sparks: (300 + level * 60) * k, hints: k };
}

// ---------- головоломка дня ----------

export function dayKey(date = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function dayNumber(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// Серия, которую видит игрок сегодня: жива, если последний раз решал сегодня или вчера.
export function currentStreak(daily, today) {
  if (!daily.last) return 0;
  const gap = dayNumber(today) - dayNumber(daily.last);
  return gap <= 1 ? daily.streak : 0;
}

export function dailySolvedToday(daily, today) {
  return daily.last === today;
}

export function dailyAfterWin(daily, today) {
  if (daily.last === today) return daily;
  const streak = currentStreak(daily, today) + 1;
  return { last: today, streak };
}

export function dailyReward(streak) {
  return { sparks: 200 + Math.min(streak, 10) * 50, hints: 1 };
}
