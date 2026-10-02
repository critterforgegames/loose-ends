// Звуки синтезируются на лету (WebAudio): ни одного файла, ноль килобайт в сборке.

let ctx = null;
let enabled = true;
let paused = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended" && !paused) ctx.resume().catch(() => {});
  return ctx;
}

export const audio = {
  // Вызывать из обработчика нажатия: браузеры запускают звук только после жеста.
  unlock() { ensure(); },

  setEnabled(v) { enabled = !!v; },

  pause() {
    paused = true;
    if (ctx) ctx.suspend().catch(() => {});
  },

  resume() {
    paused = false;
    if (ctx) ctx.resume().catch(() => {});
  },

  play(name, pitch = 1) {
    if (!enabled || paused) return;
    const c = ensure();
    if (!c) return;
    const now = c.currentTime;
    if (name === "slide") tone(c, now, 520 * pitch, 900 * pitch, 0.12, "triangle", 0.18);
    else if (name === "bump") tone(c, now, 150, 90, 0.16, "sine", 0.35);
    else if (name === "win") [0, 4, 7, 12].forEach((n, i) => tone(c, now + i * 0.09, 523 * 2 ** (n / 12), null, 0.22, "triangle", 0.2));
    else if (name === "lose") [7, 3, 0].forEach((n, i) => tone(c, now + i * 0.14, 330 * 2 ** (n / 12), null, 0.25, "sine", 0.22));
    else if (name === "hint") tone(c, now, 880, 1320, 0.15, "sine", 0.12);
    else if (name === "combo") [0, 7, 12].forEach((n, i) => tone(c, now + i * 0.05, 660 * pitch * 2 ** (n / 12), null, 0.14, "square", 0.06));
    else if (name === "star") tone(c, now, 988 * pitch, 1480 * pitch, 0.18, "triangle", 0.16);
    else if (name === "tick") tone(c, now, 1760, null, 0.03, "square", 0.025);
    else if (name === "chest") [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(c, now + i * 0.07, 440 * 2 ** (n / 12), null, 0.3, "triangle", 0.16));
    else if (name === "rank") [0, 4, 7, 12, 7, 12, 16, 24].forEach((n, i) => tone(c, now + i * 0.08, 392 * 2 ** (n / 12), null, 0.28, "triangle", 0.15));
    else if (name === "buy") [12, 16, 19].forEach((n, i) => tone(c, now + i * 0.06, 523 * 2 ** (n / 12), null, 0.18, "sine", 0.18));
    else if (name === "nope") tone(c, now, 220, 180, 0.12, "square", 0.05);
  },
};

function tone(c, at, f0, f1, dur, type, vol) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, at);
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, at + dur);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}
