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

  update(dt) {
    for (const p of this.items) {
      p.age += dt;
      if (p.kind === "spark") {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt;
      } else if (p.kind === "text") {
        p.y -= 46 * dt;
      } else {
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
      } else {
        ctx.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
  }
}
