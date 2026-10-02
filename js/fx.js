// Частицы, всплывающие надписи и конфетти поверх поля. Координаты - CSS-пиксели.

export class Fx {
  constructor() {
    this.items = [];
  }

  burst(x, y, color, count = 10, speed = 170, size = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.8);
      this.items.push({
        kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        age: 0, life: 0.45 + Math.random() * 0.35, color, size: size * (0.6 + Math.random() * 0.8),
      });
    }
  }

  text(x, y, str, color, size = 22, life = 0.9) {
    this.items.push({ kind: "text", x, y, str, color, size, age: 0, life });
  }

  confetti(width, palette, count = 90) {
    for (let i = 0; i < count; i++) {
      this.items.push({
        kind: "confetti",
        x: Math.random() * width, y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 180,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
        color: palette[i % palette.length], age: 0, life: 2.2 + Math.random(),
      });
    }
  }

  // Эффект темы при вылете линии: несколько частиц вдоль линии (points - центры клеток).
  themed(effect, points, color, cs) {
    if (!effect) return;
    for (const p of points) {
      const n = effect === "dust" ? 3 : 2;
      for (let i = 0; i < n; i++) this.particle(effect, p.x + (Math.random() - 0.5) * cs * 0.6, p.y + (Math.random() - 0.5) * cs * 0.6, color, cs);
    }
  }

  // Редкие частицы на поле в покое (box - прямоугольник поля), rate - частиц в секунду.
  ambient(effect, rate, box, palette, cs, dt) {
    if (!effect || !rate || Math.random() > rate * dt) return;
    if (this.items.length > 160) return;
    const x = box.x + Math.random() * box.w, y = box.y + Math.random() * box.h;
    this.particle(effect, x, y, palette[(Math.random() * palette.length) | 0], cs, true);
  }

  particle(effect, x, y, color, cs, calm = false) {
    const r = Math.random;
    const base = { kind: effect, x, y, age: 0, color, phase: r() * 6.28 };
    if (effect === "bubbles") {
      Object.assign(base, { vx: 0, vy: -(18 + r() * 30) * (calm ? 0.6 : 1), size: cs * (0.05 + r() * 0.09), life: calm ? 2.6 : 1.4 + r() * 0.6 });
    } else if (effect === "embers") {
      Object.assign(base, { vx: (r() - 0.5) * 20, vy: -(25 + r() * 40), size: cs * (0.03 + r() * 0.04), life: calm ? 2.2 : 1.1 + r() * 0.6 });
      if (calm) base.color = ["#fb923c", "#facc15", "#f472b6"][(r() * 3) | 0];
    } else if (effect === "glitter") {
      Object.assign(base, { vx: (r() - 0.5) * (calm ? 4 : 60), vy: (r() - 0.5) * (calm ? 4 : 60), size: cs * (0.09 + r() * 0.1), life: calm ? 1.4 : 0.7 + r() * 0.5 });
      if (calm) base.color = "#fde68a";
    } else if (effect === "dust") {
      Object.assign(base, { vx: (r() - 0.5) * 24, vy: 10 + r() * 20, size: cs * (0.04 + r() * 0.06), life: calm ? 2 : 0.9 + r() * 0.5 });
      base.color = calm ? "#f1f5ee" : base.color;
    } else {   // sprinkles
      Object.assign(base, {
        vx: (r() - 0.5) * 160, vy: -40 - r() * 120, rot: r() * 6, vr: (r() - 0.5) * 14,
        w: cs * 0.14, h: cs * 0.05, life: 0.9 + r() * 0.4,
      });
    }
    this.items.push(base);
  }

  update(dt) {
    for (const p of this.items) {
      p.age += dt;
      if (p.kind === "spark") {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt;
      } else if (p.kind === "text") {
        p.y -= 46 * dt;
      } else if (p.kind === "bubbles" || p.kind === "embers" || p.kind === "dust" || p.kind === "glitter") {
        p.x += (p.vx + (p.kind === "bubbles" ? Math.sin(p.age * 5 + p.phase) * 12 : 0)) * dt;
        p.y += p.vy * dt;
      } else {   // confetti, sprinkles
        if (p.kind === "sprinkles") p.vy += 380 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        p.vy += 60 * dt;
      }
    }
    this.items = this.items.filter(p => p.age < p.life);
  }

  draw(ctx) {
    for (const p of this.items) {
      const k = p.age / p.life;
      ctx.save();
      if (p.kind === "spark") {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "text") {
        const pop = p.age < 0.12 ? 0.6 + (p.age / 0.12) * 0.55 : Math.max(1, 1.15 - (p.age - 0.12) * 1.5);
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.translate(p.x, p.y);
        ctx.scale(pop, pop);
        ctx.font = `800 ${p.size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(3, p.size * 0.18);
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.strokeText(p.str, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.str, 0, 0);
      } else if (p.kind === "bubbles") {
        // Пузырёк: тонкое кольцо цвета линии и блик.
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.22);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "embers") {
        // Искра: тёплая точка с мерцанием и ореолом.
        ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(p.age * 18 + p.phase));
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "glitter") {
        // Блёстка: четырёхлучевая звёздочка, вспыхивает и гаснет.
        const tw = Math.sin(Math.PI * k);
        ctx.globalAlpha = tw;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.phase);
        ctx.fillStyle = p.color;
        const R = p.size * (0.6 + tw * 0.6), r2 = R * 0.22;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4, rr = i % 2 ? r2 : R;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === "dust") {
        // Меловая пыль: мягкое светлое облачко.
        ctx.globalAlpha = (1 - k) * 0.45;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + k), 0, Math.PI * 2);
        ctx.fill();
      } else {   // confetti, sprinkles
        ctx.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === "sprinkles") {
          roundBar(ctx, p.w, p.h);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
      }
      ctx.restore();
    }
  }
}

// Посыпка: маленькая палочка со скруглёнными концами.
function roundBar(ctx, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + r, -r);
  ctx.lineTo(w / 2 - r, -r);
  ctx.arc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-w / 2 + r, r);
  ctx.arc(-w / 2 + r, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
}
