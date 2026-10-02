// Генерация уровней и правила движения. Чистая логика: без DOM, без графики.
//
// Уровень - сетка w x h и набор «линий». Линия - цепочка соседних клеток
// (от хвоста к голове) и направление головы. Тап по линии: если луч от головы
// до края поля свободен, линия уползает за край; иначе упирается и теряется жизнь.
//
// Решаемость гарантирована построением: каждая новая линия кладётся так, что её
// луч свободен от всех линий, положенных раньше. Значит, линии можно убрать
// в обратном порядке, а жадное «убирай любую свободную» всегда доходит до конца.

export const DIRS = [
  { x: 1, y: 0 },  // 0 вправо
  { x: 0, y: 1 },  // 1 вниз
  { x: -1, y: 0 }, // 2 влево
  { x: 0, y: -1 }, // 3 вверх
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ритм сложности: каждый 5-й уровень трудный, каждый 10-й - босс (большое поле, 2 сердца).
export function levelKind(level) {
  return level % 10 === 0 ? "boss" : level % 5 === 0 ? "hard" : "normal";
}

// Размер и сложность уровня по его номеру (с 1).
export function levelParams(level) {
  const kind = levelKind(level);
  const boss = kind === "boss";
  // Поле вытянуто вверх под телефон: не шире 9 клеток, чтобы клетка на экране
  // 390 точек была не меньше ~39 точек (удобно пальцу). Босс - на клетку шире и на 2 выше.
  const n = Math.min(4 + Math.floor((level - 1) / 3), 9);
  // Сложность от 0 (обучение, уровни 1-3) до 1 (с 30-го уровня); трудные и боссы - сразу выше.
  const ramp = Math.min(1, Math.max(0, (level - 3) / 27));
  const hard = kind === "normal" ? ramp : Math.min(1, ramp + 0.4);
  const effort = boss ? 3 : kind === "hard" ? 2 : 1;   // во сколько раз больше перебора
  return {
    kind,
    w: n + (boss ? 1 : 0),
    h: Math.round(n * 1.5) + (boss ? 2 : 0),
    hearts: boss ? 2 : 3,
    minLen: level < 3 ? 1 : 2,
    maxLen: Math.min(3 + Math.floor(level / 6), 6) + (kind === "hard" ? 1 : 0),   // у босса линии обычные: их больше
    fill: Math.min(0.6 + level * 0.02, 0.9),
    hard,
    minRay: Math.round(hard * 3) + (kind === "normal" ? 0 : 1),   // стрелку у края не перекрыть
    choices: 1 + Math.round(hard * 15) * effort,                  // сколько мест пробовать для линии
    variants: 1 + Math.round(hard * 7) * effort,                  // сколько вариантов уровня сравнить
  };
}

// Клетки луча от головы линии до края поля (без самой головы).
export function rayCells(w, h, head, dir) {
  const d = DIRS[dir];
  const out = [];
  let x = head.x + d.x, y = head.y + d.y;
  while (x >= 0 && y >= 0 && x < w && y < h) {
    out.push({ x, y });
    x += d.x; y += d.y;
  }
  return out;
}

// Уровень: из нескольких вариантов берётся самый трудный.
export function generateLevel(level, salt = 0) {
  const p = levelParams(level);
  const seed = level * 7919 + salt * 104729 + 17;
  let best = null, bestScore = Infinity;
  for (let v = 0; v < p.variants; v++) {
    const L = buildLevel(level, p, mulberry32(seed + v * 15485863));
    const d = difficultyOf(L);
    const score = d.freeStartShare * 10 + d.avgFree;
    if (score < bestScore) { best = L; bestScore = score; }
  }
  return best;
}

function buildLevel(level, p, rnd) {
  const { w, h } = p;
  const grid = new Int16Array(w * h).fill(-1);
  const rayCount = new Int16Array(w * h);   // сколько уже положенных линий смотрят через клетку
  const snakes = [];
  const target = Math.floor(w * h * p.fill);
  let filled = 0;

  // Предлагает линию с головой в клетке head (ничего не меняя). null, если не помещается.
  function propose(head, minLen, minRay = p.minRay) {
    if (grid[head.y * w + head.x] !== -1) return null;
    // Пробуем все направления, начиная со случайного: так поле заполняется плотнее.
    const d0 = Math.floor(rnd() * 4);
    let dir = -1, ray = null;
    for (let k = 0; k < 4 && dir < 0; k++) {
      const r = rayCells(w, h, head, (d0 + k) % 4);
      if (r.length >= minRay && !r.some(c => grid[c.y * w + c.x] !== -1)) { dir = (d0 + k) % 4; ray = r; }
    }
    if (dir < 0) return null;

    const forbidden = new Set(ray.map(c => c.y * w + c.x));
    forbidden.add(head.y * w + head.x);
    const len = p.minLen + Math.floor(rnd() * (p.maxLen - p.minLen + 1));
    const body = [head];   // от головы к хвосту
    // Первый шаг тела - строго назад от головы: стрелка продолжает линию
    // и честно показывает, куда она поедет.
    let last = (dir + 2) % 4;   // направление предыдущего шага (для «прямее»)
    while (body.length < len) {
      const cur = body[body.length - 1];
      const options = [];
      for (let k = 0; k < 4; k++) {
        if (body.length === 1 && k !== last) continue;
        const nx = cur.x + DIRS[k].x, ny = cur.y + DIRS[k].y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const i = ny * w + nx;
        if (grid[i] !== -1 || forbidden.has(i)) continue;
        options.push(k);
      }
      if (!options.length) break;
      // Чаще идём прямо: линии с плавными поворотами читаются лучше.
      const k = options.includes(last) && (body.length === 1 || rnd() < 0.55)
        ? last
        : options[Math.floor(rnd() * options.length)];
      const next = { x: cur.x + DIRS[k].x, y: cur.y + DIRS[k].y };
      forbidden.add(next.y * w + next.x);
      body.push(next);
      last = k;
    }
    if (body.length < minLen) return null;
    return { body, dir, ray };
  }

  // Чем больше чужих путей перекрывает линия и чем длиннее её собственный путь
  // (его перекроют следующие линии), тем длиннее цепочки «сначала убери ту».
  function blockScore(c) {
    let blocks = 0;
    for (const cell of c.body) blocks += rayCount[cell.y * w + cell.x];
    return blocks * 3 + c.ray.length * 0.4 + c.body.length * 0.5;
  }

  function commit(c) {
    const id = snakes.length;
    for (const cell of c.body) grid[cell.y * w + cell.x] = id;
    for (const cell of c.ray) rayCount[cell.y * w + cell.x]++;
    snakes.push({ id, cells: c.body.reverse(), dir: c.dir });   // хвост -> голова
    filled += c.body.length;
  }

  const randomCell = () => ({ x: Math.floor(rnd() * w), y: Math.floor(rnd() * h) });

  // Основной проход: для каждой линии несколько мест, берётся самое «блокирующее».
  for (let budget = w * h * 60; filled < target && budget > 0;) {
    let best = null, bestScore = -1;
    for (let k = 0; k < p.choices && budget > 0; k++, budget--) {
      const c = propose(randomCell(), p.minLen);
      if (!c) continue;
      const sc = p.choices > 1 ? blockScore(c) + rnd() : 0;
      if (sc > bestScore) { best = c; bestScore = sc; }
    }
    if (best) commit(best);
  }
  // Добор: пустые клетки по порядку, короткие линии допустимы. На трудных уровнях
  // линия, которая никого не перекрывает, - лишний бесплатный ход: такую не кладём.
  const empty = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y * w + x] === -1) empty.push({ x, y });
  for (let i = empty.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [empty[i], empty[j]] = [empty[j], empty[i]];
  }
  for (const cell of empty) {
    if (filled >= target) break;
    const c = propose(cell, Math.min(2, p.minLen));
    if (!c) continue;
    if (p.hard >= 0.5 && c.body.every(b => rayCount[b.y * w + b.x] === 0)) continue;
    commit(c);
  }
  // Хвосты: пустую клетку может занять хвост соседней линии X, если клетка не лежит
  // на луче X и на лучах линий, положенных после X (их убирают раньше X).
  const rays = snakes.map(sn => new Set(rayCells(w, h, sn.cells[sn.cells.length - 1], sn.dir).map(c => c.y * w + c.x)));
  for (let changed = true; changed;) {
    changed = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (grid[i] !== -1) continue;
      for (const d of DIRS) {
        const nx = x + d.x, ny = y + d.y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const sn = snakes[grid[ny * w + nx]];
        if (!sn || sn.cells[0].x !== nx || sn.cells[0].y !== ny || sn.cells.length >= p.maxLen + 2) continue;
        // У линии из одной клетки хвост - это голова: расти можно только назад от стрелки.
        if (sn.cells.length === 1 && (DIRS[sn.dir].x !== d.x || DIRS[sn.dir].y !== d.y)) continue;
        let ok = true;
        for (let k = sn.id; k < snakes.length && ok; k++) if (rays[k].has(i)) ok = false;
        if (!ok) continue;
        sn.cells.unshift({ x, y });
        grid[i] = sn.id;
        filled++;
        changed = true;
        break;
      }
    }
  }
  return { level, w, h, snakes };
}

// Насколько уровень трудный: доля линий, свободных на старте, и сколько линий
// в среднем свободно на каждом шаге решения. Меньше - труднее.
export function difficultyOf(L) {
  const { w, h } = L;
  const grid = buildGrid(w, h, L.snakes);
  let alive = L.snakes.slice();
  let freeStart = -1, sumFree = 0, steps = 0;
  while (alive.length) {
    const free = alive.filter(s => blockedAt(grid, w, h, s) === -1);
    if (freeStart < 0) freeStart = free.length;
    if (!free.length) break;
    sumFree += free.length;
    steps++;
    const s = free[0];
    for (const c of s.cells) grid[c.y * w + c.x] = -1;
    alive = alive.filter(x => x !== s);
  }
  return {
    lines: L.snakes.length,
    freeStart,
    freeStartShare: freeStart / Math.max(1, L.snakes.length),
    avgFree: sumFree / Math.max(1, steps),
  };
}

// Сколько свободных клеток перед головой до препятствия; -1, если путь до края свободен.
export function blockedAt(grid, w, h, snake) {
  const head = snake.cells[snake.cells.length - 1];
  const ray = rayCells(w, h, head, snake.dir);
  for (let i = 0; i < ray.length; i++) {
    const owner = grid[ray[i].y * w + ray[i].x];
    if (owner !== -1 && owner !== snake.id) return i;
  }
  return -1;
}

export function buildGrid(w, h, snakes) {
  const grid = new Int16Array(w * h).fill(-1);
  for (const s of snakes) for (const c of s.cells) grid[c.y * w + c.x] = s.id;
  return grid;
}

// Жадный решатель: используется в тестах и для подсказки.
export function solve(levelData) {
  const { w, h } = levelData;
  const alive = levelData.snakes.slice();
  const grid = buildGrid(w, h, alive);
  const order = [];
  let progress = true;
  while (alive.length && progress) {
    progress = false;
    for (let i = 0; i < alive.length; i++) {
      const s = alive[i];
      if (blockedAt(grid, w, h, s) === -1) {
        for (const c of s.cells) grid[c.y * w + c.x] = -1;
        order.push(s.id);
        alive.splice(i, 1);
        progress = true;
        break;
      }
    }
  }
  return { solved: alive.length === 0, order };
}
