// Точка входа: загрузка, игровой цикл, ввод, интерфейс, награды.

import { platform } from "./platform.js?v=233368dc1d";
import { setLanguage, t, fmt, LANGUAGES, resolveLanguage } from "./i18n.js?v=233368dc1d";
import { audio } from "./audio.js?v=233368dc1d";
import { Game } from "./game.js?v=233368dc1d";
import { levelKind } from "./level.js?v=233368dc1d";
import { computeLayout, cellAt, cellCenter, draw } from "./render.js?v=233368dc1d";
import { Fx } from "./fx.js?v=233368dc1d";
import { THEMES, themeById, applyTheme } from "./themes.js?v=233368dc1d";
import * as screens from "./screens.js?v=233368dc1d";
import {
  MAX_HINTS, DAILY_DIFFICULTY, DAILY_XP, parseSave, defaultSave,
  starsFor, levelReward, xpGain, iqFromXp, rankOf, rankProgress,
  chestDue, levelsToChest, chestReward, CHEST_EVERY,
  dayKey, dayNumber, currentStreak, dailySolvedToday, dailyAfterWin, dailyReward,
} from "./progress.js?v=233368dc1d";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);
const ui = {
  hud: $("hud"), bar: $("bar"), tip: $("tip"),
  level: $("level"), rank: $("rank"), hearts: $("hearts"), settings: $("settings"),
  hint: $("hint"), hintCount: $("hint-count"),
  daily: $("daily"), streak: $("streak"), dailyMark: $("daily-mark"),
  chest: $("chest"), chestLabel: $("chest-label"), chestPips: $("chest-pips"),
  shop: $("shop"), sparks: $("sparks"),
};

const game = new Game();
const fx = new Fx();
let save = defaultSave();
let theme = themeById("neon");
let mode = "levels";   // levels | daily
let layout = null;
let cssW = 0, cssH = 0;
let paused = false;
let last = performance.now();
let rafId = 0;

const AD_HINTS = 2;   // подсказок за просмотр рекламы
const TUTORIAL_MOVES = 3;   // на самом первом уровне палец показывает первые 3 хода
let tutorialLeft = 0;
const hand = document.getElementById("hand");

// Обучение: подсвечиваем свободную линию и ставим над ней палец.
function tutorialNext() {
  if (tutorialLeft <= 0 || game.state !== "play") { hand.hidden = true; return; }
  game.hint = game.findHint();
  hand.hidden = game.hint < 0;
}

function placeHand() {
  if (hand.hidden || !layout || game.hint < 0) return;
  const s = game.snakes[game.hint];
  const p = cellCenter(layout, s.cells[s.cells.length - 1]);
  hand.style.left = `${p.x}px`;
  hand.style.top = `${p.y}px`;
  hand.style.fontSize = `${Math.max(28, layout.cs * 0.75)}px`;
}
const persist = () => platform.save(JSON.stringify(save));
const rankName = xp => {
  const r = rankOf(xp);
  return t("rank_" + r.key) + (r.stars > 1 ? ` ★${r.stars}` : "");
};
const rankUp = (before, after) => rankOf(after).level > rankOf(before).level;
const today = () => dayKey();

// ---------- интерфейс ----------

function updateHud() {
  ui.level.textContent = mode === "daily" ? t("dailyTitle") : `${t("level")} ${game.level}`;
  if (mode === "levels" && game.kind !== "normal") {
    const badge = document.createElement("span");
    badge.className = `badge ${game.kind}`;
    badge.textContent = game.kind === "boss" ? t("kindBoss") : t("kindHard");
    ui.level.appendChild(badge);
  }
  ui.rank.textContent = `${rankName(save.xp)} · ${t("iq")} ${iqFromXp(save.xp)}`;

  ui.hearts.innerHTML = "";
  for (let i = 0; i < game.maxHearts; i++) {
    const el = document.createElement("span");
    el.className = "heart" + (i < game.hearts ? "" : " lost");
    el.textContent = "♥";
    ui.hearts.appendChild(el);
  }

  ui.hint.setAttribute("aria-label", t("hint"));
  const adHint = save.hints <= 0 && platform.rewardedSupported();
  ui.hintCount.textContent = adHint ? "📺" : save.hints;
  ui.hint.disabled = (save.hints <= 0 && !adHint) || game.state !== "play" || game.hint !== -1;

  const streak = currentStreak(save.daily, today());
  ui.streak.textContent = streak > 0 ? `🔥${streak}` : t("daily");
  ui.dailyMark.hidden = dailySolvedToday(save.daily, today()) || mode === "daily";
  ui.daily.classList.toggle("done", dailySolvedToday(save.daily, today()));

  ui.chest.classList.toggle("off", mode === "daily");
  const n = levelsToChest(game.level);
  ui.chestLabel.textContent = n === 1 ? t("chestNow") : t("chestIn", { n });
  ui.chestPips.innerHTML = Array.from({ length: CHEST_EVERY }, (_, i) =>
    `<i class="${i < CHEST_EVERY - n ? "on" : ""}"></i>`).join("");

  ui.sparks.textContent = fmt(save.sparks);

  ui.tip.textContent = mode === "levels"
    ? ({ 1: t("tutorial"), 2: t("tutorial2"), 3: t("tutorial3") }[game.level] || "")
    : "";
}

function startLevel(level) {
  mode = "levels";
  game.start(level);
  updateHud();
  resize();   // после updateHud: высота подсказки внизу влияет на размер поля
  if (game.kind === "normal") platform.gameplayStart();
  tutorialLeft = level === 1 && save.best === 0 ? TUTORIAL_MOVES : 0;
  tutorialNext();
  if (game.kind === "hard") {
    screens.show(`<h2>${t("hardTitle")}</h2><p class="big-emoji">🧩</p><p class="muted">${t("hardIntro")}</p>`,
      [{ text: t("start"), value: "go", primary: true }]);
  } else if (game.kind === "boss") {
    audio.play("combo", 0.8);
    screens.show(`<h2>${t("bossTitle")}</h2><p class="big-emoji">👑</p><p class="muted">${t("bossIntro")}</p>`,
      [{ text: t("start"), value: "go", primary: true }]);
  }
}

function startDaily() {
  mode = "daily";
  game.start(DAILY_DIFFICULTY, dayNumber(today()));
  updateHud();
  resize();
  platform.gameplayStart();
}

function setTheme(id) {
  theme = themeById(id);
  applyTheme(theme);
}

// Пробный просмотр темы, на которую пока не хватает искр: 10 секунд, потом своя тема.
const PREVIEW_MS = 10000;
let previewTimer = null;

function startPreview(id) {
  clearTimeout(previewTimer);
  setTheme(id);
  if (layout) fx.text(cssW / 2, layout.oy - 6, t("previewOn", { name: t("theme_" + id) }), theme.accent, 24, 2.2);
  previewTimer = setTimeout(endPreview, PREVIEW_MS);
}

function endPreview() {
  clearTimeout(previewTimer);
  previewTimer = null;
  if (theme.id !== save.theme) setTheme(save.theme);
}

// ---------- ввод ----------

canvas.addEventListener("pointerdown", e => {
  audio.unlock();
  if (paused || !layout || screens.isOpen()) return;
  const r = canvas.getBoundingClientRect();
  const c = cellAt(layout, e.clientX - r.left, e.clientY - r.top);
  const res = game.tap(c.x, c.y);

  if (res.type === "out") {
    const color = theme.palette[res.snake.id % theme.palette.length];
    const centers = res.snake.cells.map(cell => cellCenter(layout, cell));
    for (const p of centers) fx.burst(p.x, p.y, color, theme.effect ? 3 : 5, 150, layout.cs * 0.07);
    fx.themed(theme.effect, centers, color, layout.cs);
    const head = cellCenter(layout, res.snake.cells[res.snake.cells.length - 1]);
    fx.text(head.x, head.y - layout.cs * 0.3, `+${res.points}`, color, Math.max(16, layout.cs * 0.42));
    audio.play("slide", 2 ** (Math.min(res.combo - 1, 14) / 12));
    if (tutorialLeft > 0) {
      tutorialLeft--;
      hand.hidden = true;
      setTimeout(tutorialNext, 450);   // дать линии уехать, потом показать следующую
    }
    if (res.multUp) {
      fx.text(cssW / 2, layout.oy - 6, t("combo", { n: res.mult }), theme.accent, 34, 1.1);
      audio.play("combo", 1 + (res.mult - 2) * 0.12);
    }
    if (game.state === "won") onWin();
  } else if (res.type === "bump") {
    audio.play("bump");
    if (save.vibration && navigator.vibrate) navigator.vibrate(40);
    if (game.state === "lost") onLose();
  }
  updateHud();
});

ui.hint.addEventListener("click", async () => {
  audio.unlock();
  if (game.state !== "play" || game.hint !== -1 || screens.isOpen()) return;
  if (save.hints <= 0) {
    if (!platform.rewardedSupported()) return;
    const v = await screens.show(
      `<h2>${t("adHintTitle")}</h2><p class="big-emoji">💡</p><p class="muted">${t("adHintText", { n: AD_HINTS })}</p>`,
      [{ text: t("watchAd"), value: "watch", primary: true }, { text: t("cancel"), value: "no" }],
    );
    if (v !== "watch" || !(await platform.showRewarded())) return;
    save.hints = Math.min(MAX_HINTS, save.hints + AD_HINTS);
    persist();
    updateHud();
    return;
  }
  game.hint = game.findHint();
  if (game.hint === -1) return;
  save.hints--;
  persist();
  audio.play("hint");
  updateHud();
});

ui.daily.addEventListener("click", () => { audio.unlock(); openDaily(); });
ui.shop.addEventListener("click", () => { audio.unlock(); openShop(); });
ui.settings.addEventListener("click", () => { audio.unlock(); openSettings(); });

window.addEventListener("keydown", e => {
  if (e.key === "Escape") return;   // Esc принадлежит YouTube
  if ((e.key === "Enter" || e.key === " ") && screens.isOpen()) { e.preventDefault(); screens.pressPrimary(); }
  else if ((e.key === "h" || e.key === "H") && !screens.isOpen()) ui.hint.click();
});

// ---------- победа и поражение ----------

const wait = ms => new Promise(r => setTimeout(r, ms));

async function onWin() {
  platform.gameplayStop();
  await wait(450);
  audio.play("win");
  fx.confetti(cssW, theme.palette, 70);
  if (mode === "daily") return winDaily();

  const level = game.level;
  const kind = levelKind(level);
  const stars = starsFor(game.mistakes);
  const reward = levelReward(game.points, game.mistakes, kind);
  const xpBefore = save.xp;

  save.sparks += reward.total;
  save.xp += xpGain(stars, kind);
  save.best = Math.max(save.best, level);
  save.level = level + 1;
  save.bestCombo = Math.max(save.bestCombo, game.maxCombo);
  const chest = chestDue(level) ? chestReward(level) : null;
  if (chest) {
    save.sparks += chest.sparks;
    save.hints = Math.min(MAX_HINTS, save.hints + chest.hints);
  }
  persist();
  platform.sendScore(save.best);

  const title = kind === "boss" ? t("bossCleared") : kind === "hard" ? t("hardCleared") : t("cleared");
  await showSummary(title, stars, reward, xpBefore, save.xp);
  if (chest) await showChest(chest);
  if (rankUp(xpBefore, save.xp)) await showRankUp(save.xp);
  // Реклама в естественной паузе: с 5-го уровня, после каждого 3-го, не чаще раза в 3 минуты.
  if (level >= 5 && level % 3 === 0) await platform.showInterstitial();
  startLevel(save.level);
}

async function winDaily() {
  const stars = starsFor(game.mistakes);
  const reward = levelReward(game.points, game.mistakes);
  const first = !dailySolvedToday(save.daily, today());
  const xpBefore = save.xp;
  let bonus = null;
  if (first) {
    save.daily = dailyAfterWin(save.daily, today());
    bonus = dailyReward(save.daily.streak);
    save.sparks += reward.total + bonus.sparks;
    save.hints = Math.min(MAX_HINTS, save.hints + bonus.hints);
    save.xp += DAILY_XP;
    persist();
  }
  const extra = bonus
    ? [{ label: `🔥 ${t("streak")} ${save.daily.streak}`, value: bonus.sparks }]
    : [];
  await showSummary(t("dailySolved"), stars, first ? reward : { points: 0, perfect: 0, bonus: 0, total: 0 }, xpBefore, save.xp, extra);
  if (rankUp(xpBefore, save.xp)) await showRankUp(save.xp);
  startLevel(save.level);
}

async function onLose() {
  platform.gameplayStop();
  await wait(450);
  audio.play("lose");
  const buttons = [{ text: t("retry"), value: "retry", primary: true }];
  if (mode === "daily") buttons.push({ text: t("backToLevels"), value: "back" });
  const v = await screens.show(`<h2>${t("outOfHearts")}</h2><p class="big-emoji">💔</p>`, buttons);
  if (v === "back") startLevel(save.level);
  else if (mode === "daily") startDaily();
  else startLevel(game.level);
}

// ---------- карточки ----------

function showSummary(title, stars, reward, xpBefore, xpAfter, extra = []) {
  const rows = [[t("lines"), reward.points]];
  if (reward.perfect) rows.push([t("perfect"), reward.perfect]);
  if (reward.bonus) rows.push([reward.kind === "boss" ? t("bossBonus") : t("hardBonus"), reward.bonus]);
  for (const e of extra) rows.push([e.label, e.value]);
  const total = rows.reduce((s, r) => s + r[1], 0);

  const starHtml = [0, 1, 2].map(i =>
    `<span class="star ${i < stars ? "on" : ""}" style="animation-delay:${0.15 + i * 0.22}s">★</span>`).join("");
  const rowHtml = rows.map(([l, v]) => `<div class="row"><span>${l}</span><b>+${fmt(v)}</b></div>`).join("");
  const fromW = rankUp(xpBefore, xpAfter) ? 0 : rankProgress(xpBefore) * 100;
  const iqAfter = iqFromXp(xpAfter), iqDelta = iqAfter - iqFromXp(xpBefore);

  const html = `
    <h2>${title}</h2>
    <div class="stars">${starHtml}</div>
    <div class="rows">${rowHtml}
      <div class="row total"><span>${t("total")}</span><b><span id="total-count">0</span> ✦</b></div>
    </div>
    <div class="iq">
      <div class="iq-head"><span>${rankName(xpAfter)}</span><span>${t("iq")} ${iqAfter}${iqDelta > 0 ? ` <em>+${iqDelta}</em>` : ""}</span></div>
      <div class="meter"><i id="iq-fill" style="width:${fromW}%"></i></div>
    </div>`;

  return screens.show(html, [{ text: t("next"), value: "next", primary: true }], card => {
    for (let i = 0; i < stars; i++) setTimeout(() => audio.play("star", 1 + i * 0.12), 150 + i * 220);
    setTimeout(() => {
      screens.countUp(card.querySelector("#total-count"), total, 900, fmt, () => audio.play("tick"));
    }, 750);
    setTimeout(() => {
      const fill = card.querySelector("#iq-fill");
      if (fill) fill.style.width = `${rankProgress(xpAfter) * 100}%`;
    }, 900);
  });
}

async function showChest(reward) {
  await screens.show(
    `<h2>${t("chest")}</h2><p class="big-emoji chest-shake">🎁</p>`,
    [{ text: t("open"), value: "open", primary: true }],
  );
  audio.play("chest");
  fx.confetti(cssW, theme.palette, 50);
  await screens.show(
    `<h2>${t("chest")}</h2><p class="big-emoji">✨</p>
     <div class="rows"><div class="row total"><span>✦</span><b>+${fmt(reward.sparks)}</b></div>
     <div class="row total"><span>💡 ${t("hints")}</span><b>+${reward.hints}</b></div></div>`,
    [{ text: t("collect"), value: "ok", primary: true }],
  );
}

async function showRankUp(xp) {
  audio.play("rank");
  fx.confetti(cssW, theme.palette, 110);
  await screens.show(
    `<h2>${t("rankUp")}</h2><p class="big-emoji">🧠</p>
     <p class="muted">${t("youAre")}</p><p class="rank-name">${rankName(xp)}</p>
     <p class="muted">${t("iq")} ${iqFromXp(xp)}</p>`,
    [{ text: t("next"), value: "ok", primary: true }],
  );
}

async function openDaily() {
  if (screens.isOpen() || mode === "daily") return;
  const streak = currentStreak(save.daily, today());
  if (dailySolvedToday(save.daily, today())) {
    await screens.show(
      `<h2>${t("dailyDone")}</h2><p class="big-emoji">✅</p>
       <p class="streak-big">🔥 ${streak}</p><p class="muted">${t("dailyComeBack")}</p>`,
      [{ text: t("close"), value: "ok", primary: true }],
    );
    return;
  }
  const v = await screens.show(
    `<h2>${t("dailyTitle")}</h2><p class="big-emoji">📅</p>
     <p class="streak-big">🔥 ${streak}</p><p class="muted">${t("dailyIntro")}</p>`,
    [{ text: t("play"), value: "play", primary: true }, { text: t("close"), value: "close" }],
  );
  if (v === "play") startDaily();
}

function openShop() {
  if (screens.isOpen()) return;
  endPreview();
  const tiles = () => THEMES.map(th => {
    const owned = save.owned.includes(th.id);
    const using = save.theme === th.id;
    const label = using ? t("inUse") : owned ? t("use") : `${fmt(th.price)} ✦`;
    const locked = !owned && save.sparks < th.price;
    const dots = th.palette.slice(0, 4).map(c => `<i style="background:${c}"></i>`).join("");
    return `<button type="button" class="tile ${using ? "using" : ""} ${locked ? "locked" : ""}" data-id="${th.id}"
      style="background:linear-gradient(160deg, ${th.bg[0]}, ${th.bg[1]}); color:${th.text}">
      <span class="swatch">${dots}</span><span class="tname">${t("theme_" + th.id)}</span><span class="tprice">${label}</span></button>`;
  }).join("");

  const render = card => {
    card.querySelector(".tiles").innerHTML = tiles();
    card.querySelector(".wallet").textContent = `${fmt(save.sparks)} ✦`;
  };

  screens.show(
    `<h2>${t("themes")}</h2><p class="wallet"></p><div class="tiles"></div><p class="hint-line">${t("previewHint")}</p>`,
    [{ text: t("close"), value: "close", primary: true }],
    card => {
      render(card);
      card.querySelector(".tiles").addEventListener("click", e => {
        const el = e.target.closest(".tile");
        if (!el) return;
        const th = themeById(el.dataset.id);
        if (!save.owned.includes(th.id)) {
          if (save.sparks < th.price) {
            // Не хватает искр - даём посмотреть тему в игре 10 секунд.
            audio.play("nope");
            screens.close("close");
            startPreview(th.id);
            return;
          }
          save.sparks -= th.price;
          save.owned.push(th.id);
          audio.play("buy");
        }
        save.theme = th.id;
        endPreview();
        setTheme(th.id);
        persist();
        render(card);
        updateHud();
      });
    },
  );
}

async function openSettings() {
  if (screens.isOpen()) return;
  // В YouTube звуком управляет сам YouTube: своя кнопка звука там не рекомендуется.
  const rows = [
    ...(platform.name === "youtube" ? [] : [["sound", t("sound")]]),
    ["vibration", t("vibration")],
  ];
  const html = () => rows.map(([key, label]) =>
    `<div class="setting"><span>${label}</span><button type="button" class="switch ${save[key] ? "on" : ""}" data-key="${key}" aria-pressed="${save[key]}">${save[key] ? t("on") : t("off")}</button></div>`).join("");

  const auto = resolveLanguage(systemLang);
  const langOptions = [`<option value="auto">${t("auto")} (${auto.name})</option>`,
    ...LANGUAGES.map(l => `<option value="${l.code}">${l.name}</option>`)].join("");

  const v = await screens.show(
    `<h2>${t("settings")}</h2><div class="settings">${html()}</div>
     <div class="setting lang-row"><label for="lang-select">${t("language")}</label>
     <select id="lang-select">${langOptions}</select></div>`,
    [{ text: t("close"), value: "close", primary: true }, { text: t("resetProgress"), value: "reset", danger: true }],
    card => {
      card.querySelector(".settings").addEventListener("click", e => {
        const el = e.target.closest(".switch");
        if (!el) return;
        save[el.dataset.key] = !save[el.dataset.key];
        persist();
        applySound();
        card.querySelector(".settings").innerHTML = html();
        if (el.dataset.key === "sound" && save.sound) audio.play("hint");
      });
      const select = card.querySelector("#lang-select");
      select.value = save.lang;
      select.addEventListener("change", () => {
        save.lang = select.value;
        persist();
        applyLanguage();
        screens.close("relang");
      });
    },
  );
  if (v === "relang") return openSettings();   // перерисовать настройки на новом языке
  if (v !== "reset") return;
  const sure = await screens.show(
    `<h2>${t("resetTitle")}</h2><p class="big-emoji">⚠️</p><p class="muted">${t("resetWarn")}</p>`,
    [{ text: t("cancel"), value: "no", primary: true }, { text: t("resetYes"), value: "yes", danger: true }],
  );
  if (sure !== "yes") return;
  const keep = { sound: save.sound, vibration: save.vibration, lang: save.lang };
  save = { ...defaultSave(), ...keep };
  persist();
  setTheme(save.theme);
  startLevel(1);
}

let systemLang = "en";   // язык браузера или YouTube
function applyLanguage() {
  setLanguage(save.lang === "auto" ? systemLang : save.lang);
  updateHud();
  resize();
}

let ytAudio = true;   // звук разрешён площадкой (YouTube может его выключить)
function applySound() {
  audio.setEnabled(ytAudio && save.sound);
}

// ---------- экран и цикл ----------

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = ui.hud.offsetHeight;
  const bottom = ui.bar.offsetHeight + (ui.tip.textContent ? ui.tip.offsetHeight + 6 : 0);
  if (game.snakes) layout = computeLayout(cssW, cssH, game, top, bottom);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  if (layout && game.state === "play" && theme.effect) {
    const box = { x: layout.ox, y: layout.oy, w: layout.cs * game.w, h: layout.cs * game.h };
    fx.ambient(theme.effect, theme.ambient, box, theme.palette, layout.cs, dt);
  }
  fx.update(dt);
  ctx.clearRect(0, 0, cssW, cssH);
  if (layout) draw(ctx, game, layout, now, theme);
  placeHand();
  fx.draw(ctx);
  if (!paused) rafId = requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
document.addEventListener("contextmenu", e => e.preventDefault());

platform.onPause(() => {
  paused = true;
  cancelAnimationFrame(rafId);
  audio.pause();
});

platform.onResume(() => {
  if (!paused) return;
  paused = false;
  audio.resume();
  last = performance.now();
  rafId = requestAnimationFrame(frame);
});

platform.onAudioChange(enabled => { ytAudio = enabled; applySound(); });

// ---------- запуск ----------

async function boot() {
  resize();
  ctx.clearRect(0, 0, cssW, cssH);
  platform.firstFrameReady();
  await platform.init();
  screens.setHooks({
    open: () => platform.gameplayStop(),
    close: () => { if (game.state === "play") platform.gameplayStart(); },
  });

  systemLang = await platform.language();
  ytAudio = platform.audioEnabled();
  save = parseSave(await platform.load());
  setLanguage(save.lang === "auto" ? systemLang : save.lang);
  applySound();
  setTheme(save.theme);

  startLevel(save.level);
  rafId = requestAnimationFrame(frame);
  platform.gameReady();
}


boot().then(() => window.__le?.demo());
