// Отрисовка поля и линий на canvas.

import { DIRS } from "./level.js?v=c5f3f44135";

const BUMP_COLOR = "#f87171";

// Размер клетки и отступы поля под текущий размер экрана (в CSS-пикселях).
export function computeLayout(cssW, cssH, game, top, bottom) {
  const pad = 18;
  const availW = cssW - pad * 2;
  const availH = cssH - top - bottom - pad * 2;
  const cs = Math.max(8, Math.min(availW / game.w, availH / game.h, 96));
  return {
    cs,
    ox: (cssW - cs * game.w) / 2,
    oy: top + pad + (availH - cs * game.h) / 2,
  };
}

// Центр клетки в CSS-пикселях.
export function cellCenter(L, c) {
  return { x: L.ox + (c.x + 0.5) * L.cs, y: L.oy + (c.y + 0.5) * L.cs };
}

export function cellAt(L, px, py) {
  return { x: Math.floor((px - L.ox) / L.cs), y: Math.floor((py - L.oy) / L.cs) };
}

export function draw(ctx, game, L, now, theme) {
  const { cs } = L;
  const ox = L.ox + Math.sin(now * 0.06) * game.shake * cs * 0.12;
  const oy = L.oy;

  // Подложка поля и точки клеток.
  ctx.fillStyle = theme.board;
  roundRect(ctx, ox - cs * 0.15, oy - cs * 0.15, cs * (game.w + 0.3), cs * (game.h + 0.3), cs * 0.35);
  ctx.fill();
  ctx.fillStyle = theme.dot;
  for (let y = 0; y < game.h; y++) {
    for (let x = 0; x < game.w; x++) {
      ctx.beginPath();
      ctx.arc(ox + (x + 0.5) * cs, oy + (y + 0.5) * cs, cs * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // В покое линии плоские. Нажатая линия, пока уезжает, светится неоном, как на иконке:
  // мягкий ореол её цвета и светлая сердцевина. Её рисуем поверх остальных.
  const pulse = 0.5 + 0.5 * Math.sin(now / 160);
  const moving = [];
  for (const s of game.snakes) {
    if (s.done) continue;
    const shape = snakeShape(s, game.offsetOf(s), ox, oy, cs);
    if (s.anim && s.anim.kind === "out") { moving.push({ s, shape }); continue; }
    const bump = s.anim && s.anim.kind === "bump";
    const color = bump ? BUMP_COLOR : theme.palette[s.id % theme.palette.length];
    const glow = s.id === game.hint ? 8 + pulse * 18 : theme.glow;
    const style = bump ? null : theme.texture;
    if (style === "candy") drawCandy(ctx, shape, cs, color, glow);
    else if (style === "chalk") drawChalkLine(ctx, shape, cs, color, theme.bg[1], s.id);
    else if (style === "ocean") drawOcean(ctx, shape, cs, color, glow, now, s.id);
    else if (style === "sunset") drawSunset(ctx, shape, cs, color, glow);
    else if (style === "gold") drawGold(ctx, shape, cs, color, glow, now, s.id);
    else drawFlat(ctx, shape, cs, color, glow);
  }
  for (const { s, shape } of moving) {
    const k = Math.min(1, 0.4 + s.anim.offset * 1.2);   // свечение быстро разгорается
    drawNeon(ctx, shape, cs, theme.palette[s.id % theme.palette.length], k);
  }
}

function drawFlat(ctx, shape, cs, color, glow) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  strokeShape(ctx, shape, cs, 0, 0, cs * 0.24, color);
  ctx.restore();
}

// Леденец: тень под линией, сама линия, белые поперечные полоски (как у карамельной трости)
// и глянцевый блик сверху.
function drawCandy(ctx, shape, cs, color, glow) {
  const w = cs * 0.34;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(120, 20, 70, 0.30)";
  ctx.shadowBlur = cs * 0.14;
  ctx.shadowOffsetY = cs * 0.08;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; ctx.shadowOffsetY = 0; }
  strokeShape(ctx, shape, cs, 0, 0, w, color);
  ctx.shadowColor = "transparent";
  // Широкие белые полосы поперёк линии, как у карамели.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = w * 0.92;
  ctx.lineCap = "butt";
  ctx.setLineDash([cs * 0.14, cs * 0.16]);
  tracePath(ctx, shape.px, 0, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  // Глянец: мягкий светлый отблеск у верхнего края.
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = w * 0.22;
  tracePath(ctx, shape.px, -w * 0.18, -w * 0.22);
  ctx.stroke();
  ctx.restore();
}

// Мел: линия нарисована от руки - неровный край, два прохода мелом и штрихи цвета доски.
function drawChalkLine(ctx, shape, cs, color, board, seed) {
  const rough = wobble(shape.px, cs * 0.035, seed, cs);
  const roughShape = { px: rough, dx: shape.dx, dy: shape.dy };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.9;
  strokeShape(ctx, roughShape, cs, 0, 0, cs * 0.22, color);
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = color;
  ctx.lineWidth = cs * 0.1;
  tracePath(ctx, wobble(shape.px, cs * 0.05, seed + 7, cs), cs * 0.03, cs * 0.02);
  ctx.stroke();
  ctx.restore();
  drawChalk(ctx, roughShape, cs, board);
}

// Точки линии с мелкой неровностью: отрезки делятся на шаги, к каждому - сдвиг поперёк.
// Шум зависит только от seed и номера шага, поэтому линия не дрожит от кадра к кадру.
function wobble(px, amp, seed, cs) {
  const out = [px[0]];
  let k = 0;
  for (let i = 1; i < px.length; i++) {
    const a = px[i - 1], b = px[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / (cs * 0.3)));
    const nx = -(b.y - a.y) / (len || 1), ny = (b.x - a.x) / (len || 1);
    for (let j = 1; j <= steps; j++) {
      const f = j / steps;
      const n = j === steps ? 0 : Math.sin(seed * 12.9898 + (k++) * 78.233) * amp;
      out.push({ x: a.x + (b.x - a.x) * f + nx * n, y: a.y + (b.y - a.y) * f + ny * n });
    }
  }
  return out;
}

// Океан: линия с бегущим светлым переливом, как блики на воде.
function drawOcean(ctx, shape, cs, color, glow, now, seed) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(glow, cs * 0.15);
  strokeShape(ctx, shape, cs, 0, 0, cs * 0.26, color);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = shade(color, 0.6);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = cs * 0.14;
  ctx.setLineDash([cs * 0.7, cs * 1.1]);
  ctx.lineDashOffset = -(now / 1000) * cs * 0.9 - seed * cs * 0.37;
  tracePath(ctx, shape.px, 0, 0);
  ctx.stroke();
  ctx.restore();
}

// Закат: линия переливается от светлого тёплого хвоста к насыщенной голове.
function drawSunset(ctx, shape, cs, color, glow) {
  const { px } = shape;
  const t = px[0], h = px[px.length - 1];
  const g = ctx.createLinearGradient(t.x, t.y, h.x + shape.dx * cs * 0.3, h.y + shape.dy * cs * 0.3);
  g.addColorStop(0, mix(color, "#fde68a", 0.55));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -0.12));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(glow, cs * 0.18);
  strokeShape(ctx, shape, cs, 0, 0, cs * 0.26, g);
  ctx.restore();
}

// Золото: металлическая линия - тёмная кромка, светлый блик и пробегающий отсвет.
function drawGold(ctx, shape, cs, color, glow, now, seed) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  strokeShape(ctx, shape, cs, 0, 0, cs * 0.3, shade(color, -0.35));
  ctx.shadowBlur = 0;
  strokeShape(ctx, shape, cs, 0, 0, cs * 0.22, color);
  ctx.strokeStyle = shade(color, 0.65);
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = cs * 0.05;
  tracePath(ctx, shape.px, -cs * 0.035, -cs * 0.04);
  ctx.stroke();
  // Отсвет: светлая полоса раз в несколько секунд проходит по линии (у каждой линии - в своё время).
  const period = 3200, phase = ((now + seed * 530) % period) / period;
  if (phase < 0.35) {
    const xs = shape.px.map(p => p.x), ys = shape.px.map(p => p.y);
    const x0 = Math.min(...xs) - cs, x1 = Math.max(...xs) + cs;
    const y0 = Math.min(...ys) - cs, y1 = Math.max(...ys) + cs;
    const f = phase / 0.35;
    const cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f;
    const band = cs * 0.9;
    const g = ctx.createLinearGradient(cx - band, cy - band, cx + band, cy + band);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 1;
    strokeShape(ctx, shape, cs, 0, 0, cs * 0.22, g);
  }
  ctx.restore();
}

// Смесь двух цветов #rrggbb: k = 0 - первый, 1 - второй.
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// Меловая текстура: поверх линии - прерывистые штрихи цвета доски, как у мела на доске.
function drawChalk(ctx, shape, cs, board) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = board;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = cs * 0.035;
  ctx.setLineDash([cs * 0.16, cs * 0.09]);
  tracePath(ctx, shape.px, cs * 0.05, -cs * 0.05);
  ctx.stroke();
  ctx.setLineDash([cs * 0.06, cs * 0.14]);
  tracePath(ctx, shape.px, -cs * 0.06, cs * 0.04);
  ctx.stroke();
  ctx.restore();
}

// Неоновая линия: ореол (размытая тень того же цвета) + сама линия + светлая сердцевина.
function drawNeon(ctx, shape, cs, color, k) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = cs * 0.9 * k;
  strokeShape(ctx, shape, cs, 0, 0, cs * 0.26, color);
  ctx.shadowBlur = cs * 0.35 * k;
  strokeShape(ctx, shape, cs, 0, 0, cs * 0.26, color);
  ctx.shadowBlur = 0;
  const core = shade(color, 0.6);
  ctx.globalAlpha = 0.85 * k;
  ctx.strokeStyle = core;
  ctx.fillStyle = core;
  ctx.lineWidth = cs * 0.08;
  tracePath(ctx, shape.px, 0, 0);
  ctx.stroke();
  traceHead(ctx, shape, cs, 0, 0, 0.4);
  ctx.fill();
  ctx.restore();
}

// Точки линии в пикселях и направление головы.
function snakeShape(s, offset, ox, oy, cs) {
  const P = s.anim ? s.anim.path : s.cells;
  const n = s.cells.length;
  const at = t => {
    const i = Math.max(0, Math.min(P.length - 1, Math.floor(t)));
    const j = Math.min(P.length - 1, i + 1);
    const f = Math.max(0, Math.min(1, t - i));
    return { x: P[i].x + (P[j].x - P[i].x) * f, y: P[i].y + (P[j].y - P[i].y) * f };
  };

  const a = offset, b = offset + n - 1;
  let pts;
  if (n === 1) {
    const h = at(b), d = DIRS[s.dir];
    pts = [{ x: h.x - d.x * 0.4, y: h.y - d.y * 0.4 }, h];
  } else {
    pts = [at(a)];
    for (let i = Math.floor(a) + 1; i < b; i++) pts.push(P[i]);
    pts.push(at(b));
  }
  const px = pts.map(p => ({ x: ox + (p.x + 0.5) * cs, y: oy + (p.y + 0.5) * cs }));

  // Направление головы - по последнему отрезку.
  const h = px[px.length - 1], pr = px[px.length - 2];
  let dx = h.x - pr.x, dy = h.y - pr.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) { dx = DIRS[s.dir].x; dy = DIRS[s.dir].y; } else { dx /= len; dy /= len; }
  return { px, dx, dy };
}

function tracePath(ctx, px, ox, oy) {
  ctx.beginPath();
  ctx.moveTo(px[0].x + ox, px[0].y + oy);
  for (let i = 1; i < px.length; i++) ctx.lineTo(px[i].x + ox, px[i].y + oy);
}

// Треугольник наконечника; k - масштаб (для блика поменьше).
function traceHead(ctx, shape, cs, ox, oy, k = 1) {
  const { px, dx, dy } = shape;
  const h = px[px.length - 1];
  const tip = { x: h.x + dx * cs * 0.34 * k, y: h.y + dy * cs * 0.34 * k };
  const base = { x: h.x - dx * cs * 0.06 * k, y: h.y - dy * cs * 0.06 * k };
  const wing = cs * 0.27 * k;
  ctx.beginPath();
  ctx.moveTo(tip.x + ox, tip.y + oy);
  ctx.lineTo(base.x - dy * wing + ox, base.y + dx * wing + oy);
  ctx.lineTo(base.x + dy * wing + ox, base.y - dx * wing + oy);
  ctx.closePath();
}

function strokeShape(ctx, shape, cs, ox, oy, width, style) {
  ctx.strokeStyle = style;
  ctx.fillStyle = style;
  ctx.lineWidth = width;
  tracePath(ctx, shape.px, ox, oy);
  ctx.stroke();
  ctx.lineWidth = width / 3;
  traceHead(ctx, shape, cs, ox, oy);
  ctx.fill();
  ctx.stroke();
}

// Цвет #rrggbb, осветлённый (k > 0, к белому) или затемнённый (k < 0, к чёрному).
const shadeCache = new Map();
function shade(hex, k) {
  const key = hex + k;
  let v = shadeCache.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    const target = k > 0 ? 255 : 0, f = Math.abs(k);
    const ch = c => Math.round(c + (target - c) * f);
    v = `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
    shadeCache.set(key, v);
  }
  return v;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
