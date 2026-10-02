// Состояние партии: линии, жизни, анимации. Без DOM и без отрисовки.

import { generateLevel, levelParams, buildGrid, blockedAt, rayCells, DIRS } from "./level.js";
import { COMBO_WINDOW, comboMultiplier, linePoints } from "./progress.js";

const OUT_SPEED = 20;   // клеток в секунду при вылете
const BUMP_TIME = 0.34; // секунды на «упёрлась и вернулась»

export class Game {
  // salt != 0 - другой набор уровней той же сложности (головоломка дня).
  start(level, salt = 0) {
    const L = generateLevel(level, salt);
    this.level = level;
    this.w = L.w;
    this.h = L.h;
    this.snakes = L.snakes.map(s => ({ ...s, gone: false, done: false, anim: null }));
    this.grid = buildGrid(L.w, L.h, this.snakes);
    this.left = this.snakes.length;
    this.kind = levelParams(level).kind;
    this.maxHearts = levelParams(level).hearts;
    this.hearts = this.maxHearts;
    this.state = "play";   // play | won | lost
    this.hint = -1;
    this.shake = 0;
    this.time = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastOut = -99;
    this.points = 0;
    this.mistakes = 0;
  }

  snakeAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.grid[y * this.w + x];
  }

  // Нажатие по клетке. Возвращает, что произошло: none | out | bump.
  tap(x, y) {
    if (this.state !== "play") return { type: "none" };
    const id = this.snakeAt(x, y);
    if (id < 0) return { type: "none" };
    const s = this.snakes[id];
    if (s.gone || s.anim) return { type: "none" };

    const free = blockedAt(this.grid, this.w, this.h, s);
    const head = s.cells[s.cells.length - 1];
    const ray = rayCells(this.w, this.h, head, s.dir);

    if (free === -1) {
      for (const c of s.cells) this.grid[c.y * this.w + c.x] = -1;
      s.gone = true;
      this.left--;
      if (this.hint === id) this.hint = -1;
      // Путь вылета: сама линия, луч до края и ещё столько же клеток за краем.
      const path = [...s.cells, ...ray];
      const d = DIRS[s.dir];
      let p = path[path.length - 1];
      for (let i = 0; i < s.cells.length + 2; i++) {
        p = { x: p.x + d.x, y: p.y + d.y };
        path.push(p);
      }
      s.anim = { kind: "out", path, offset: 0, end: ray.length + s.cells.length + 1 };

      const prevMult = comboMultiplier(this.combo);
      this.combo = this.time - this.lastOut <= COMBO_WINDOW ? this.combo + 1 : 1;
      this.lastOut = this.time;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const mult = comboMultiplier(this.combo);
      const points = linePoints(s.cells.length, this.combo);
      this.points += points;

      if (this.left === 0) this.state = "won";
      return { type: "out", snake: s, points, combo: this.combo, mult, multUp: mult > prevMult };
    }

    const blocker = ray[free];
    s.anim = { kind: "bump", path: [...s.cells, ...ray], t: 0, reach: free + 0.3 };
    this.hearts--;
    this.mistakes++;
    this.combo = 0;
    this.shake = 1;
    if (this.hearts <= 0) this.state = "lost";
    return { type: "bump", snake: s, blocker: this.grid[blocker.y * this.w + blocker.x] };
  }

  update(dt) {
    this.time += dt;
    for (const s of this.snakes) {
      const a = s.anim;
      if (!a) continue;
      if (a.kind === "out") {
        a.offset += OUT_SPEED * dt * Math.min(1, 0.35 + a.offset);   // мягкий старт
        if (a.offset >= a.end) { s.anim = null; s.done = true; }
      } else {
        a.t += dt / BUMP_TIME;
        if (a.t >= 1) s.anim = null;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 4);
  }

  // Смещение линии вдоль пути (в клетках) для отрисовки.
  offsetOf(s) {
    const a = s.anim;
    if (!a) return 0;
    if (a.kind === "out") return a.offset;
    const k = a.t < 0.45 ? a.t / 0.45 : 1 - (a.t - 0.45) / 0.55;
    return a.reach * Math.sin(k * Math.PI / 2);
  }

  findHint() {
    for (const s of this.snakes) {
      if (!s.gone && !s.anim && blockedAt(this.grid, this.w, this.h, s) === -1) return s.id;
    }
    return -1;
  }

  get busy() {
    return this.snakes.some(s => s.anim);
  }
}
