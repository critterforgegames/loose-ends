// Обёртка над SDK площадки. Игра обращается только к этому модулю, поэтому
// для новой площадки меняется только он (и вариант сборки в tools/build.py).
//
// YouTube Playables: в index.html первым скриптом https://www.youtube.com/game_api/v1 -> window.ytgame.
// Яндекс Игры: сборка подставляет <script src="/sdk.js"> -> window.YaGames.
// Playgama (и их сеть площадок): сборка подставляет playgama-bridge.js -> window.bridge.
// CrazyGames: сборка подставляет crazygames-sdk-v3.js -> window.CrazyGames.SDK.
// Telegram (мини-приложение): сборка подставляет telegram-web-app.js -> window.Telegram.WebApp,
//   реклама Adsgram подгружается сама, номера блоков - window.LE_IDS из tools/ids.json.
// GameDistribution: сборка задаёт window.GD_OPTIONS и подключает их SDK -> window.gdsdk.
// Иначе (локально, своя страница) - localStorage и события браузера.

const yt = window.ytgame;
const tg = window.Telegram?.WebApp;
const IDS = window.LE_IDS || {};
const KIND = yt && yt.IN_PLAYABLES_ENV ? "youtube"
  : window.YaGames ? "yandex"
  : window.bridge ? "playgama"
  : window.CrazyGames?.SDK ? "crazygames"
  : tg?.initData ? "telegram"
  : window.GD_OPTIONS ? "gamedistribution"
  : "web";
const KEY = "loose-ends-save";

let ysdk = null;     // SDK Яндекса после init
let yPlayer = null;  // игрок Яндекса (для облачных сохранений)
let pg = null;       // Playgama Bridge после init
let cg = null;       // CrazyGames SDK после init
let adsgram = {};    // контроллеры рекламы Adsgram в Telegram: { interstitial, rewarded }
const TG_LIMIT = 4096;   // предел значения в облачном хранилище Telegram
let playing = false; // идёт ли сейчас игровой процесс (GameplayAPI / gameplay_started)
const pauseHandlers = [];
const resumeHandlers = [];
const audioHandlers = [];
const firePause = () => pauseHandlers.forEach(f => f());
const fireResume = () => resumeHandlers.forEach(f => f());

function localLoad() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

function localSave(text) {
  try { localStorage.setItem(KEY, text); } catch { /* приватный режим */ }
}

// Показ рекламы через Bridge: ждём, пока состояние дойдёт до closed/failed.
// Игра никогда не должна зависнуть из-за рекламы: если площадка не прислала ни одного
// состояния за 3 с (реклама не будет показана) - идём дальше; дольше минуты не ждём вообще;
// после рекламы паузу снимаем сами, не надеясь только на сигнал площадки.
function pgAd(kind) {
  return new Promise(resolve => {
    const ad = pg.advertisement;
    const E = pg.EVENT_NAME;
    const event = kind === "rewarded" ? E.REWARDED_STATE_CHANGED : E.INTERSTITIAL_STATE_CHANGED;
    let rewarded = false, seen = false, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(idle);
      clearTimeout(limit);
      ad.off?.(event, onState);
      fireResume();
      resolve(rewarded);
    };
    const onState = state => {
      seen = true;
      if (state === "opened") firePause();
      if (state === "rewarded") rewarded = true;
      if (state === "closed" || state === "failed") finish();
    };
    const idle = setTimeout(() => { if (!seen) finish(); }, 3000);
    const limit = setTimeout(finish, 60000);
    ad.on(event, onState);
    try {
      if (kind === "rewarded") ad.showRewarded();
      else ad.showInterstitial();
    } catch { finish(); }
  });
}

// Реклама GameDistribution: паузу и продолжение присылает их SDK (SDK_GAME_PAUSE / SDK_GAME_START),
// но игра всё равно идёт дальше сама, если реклама не началась за 3 с или длится дольше минуты.
let gdRewarded = false;
function gdAd(type) {
  return new Promise(resolve => {
    let done = false;
    gdRewarded = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      fireResume();
      resolve(gdRewarded);
    };
    const limit = setTimeout(finish, 60000);
    try {
      const p = type === "rewarded" ? window.gdsdk.showAd("rewarded") : window.gdsdk.showAd();
      if (p && p.then) p.then(finish, finish);
      else setTimeout(finish, 3000);
    } catch { finish(); }
  });
}

// Реклама Adsgram в Telegram. true, если ролик за награду досмотрен.
function tgAd(ctrl) {
  return new Promise(resolve => {
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      fireResume();
      resolve(ok);
    };
    const limit = setTimeout(() => finish(false), 60000);
    firePause();
    try {
      ctrl.show().then(r => finish(!!r?.done), () => finish(false));
    } catch { finish(false); }
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

// Межуровневую рекламу просим не чаще раза в 3 минуты.
let lastInterstitial = 0;
const INTERSTITIAL_GAP = 180000;

// Реклама CrazyGames: на время показа - пауза и тишина. true, если ролик досмотрен.
function cgAd(type) {
  return new Promise(resolve => {
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      fireResume();
      resolve(ok);
    };
    const limit = setTimeout(() => finish(false), 60000);
    try {
      cg.ad.requestAd(type, {
        adStarted: () => firePause(),
        adFinished: () => finish(true),
        adError: () => finish(false),
      });
    } catch { finish(false); }
  });
}

export const platform = {
  name: KIND,

  async init() {
    if (KIND === "yandex") {
      try {
        ysdk = await window.YaGames.init();
        ysdk.on("game_api_pause", firePause);
        ysdk.on("game_api_resume", fireResume);
        yPlayer = await ysdk.getPlayer({ scopes: false }).catch(() => null);
      } catch { ysdk = null; }
    }
    if (KIND === "playgama") {
      try {
        await window.bridge.initialize();
        pg = window.bridge;
        // Bridge сам присылает паузу на рекламу, переключение вкладки и системные паузы.
        pg.platform.on(pg.EVENT_NAME.PAUSE_STATE_CHANGED, paused => (paused ? firePause() : fireResume()));
        pg.platform.on(pg.EVENT_NAME.AUDIO_STATE_CHANGED, on => audioHandlers.forEach(f => f(on)));
      } catch { pg = null; }
    }
    if (KIND === "crazygames") {
      try {
        await window.CrazyGames.SDK.init();
        cg = window.CrazyGames.SDK;
        // Звук можно выключить в интерфейсе CrazyGames - слушаем их настройку.
        cg.game.addSettingsChangeListener(s => audioHandlers.forEach(f => f(!s.muteAudio)));
      } catch { cg = null; }
    }
    if (KIND === "telegram") {
      tg.ready();
      tg.expand();
      tg.disableVerticalSwipes?.();   // чтобы свайп по полю не закрывал игру
      try { tg.setHeaderColor("#11131d"); tg.setBackgroundColor("#11131d"); } catch { /* старый клиент */ }
      tg.onEvent?.("deactivated", firePause);
      tg.onEvent?.("activated", fireResume);
      if (IDS.adsgramInterstitial || IDS.adsgramRewarded) {
        try {
          await loadScript("https://sad.adsgram.ai/js/sad.min.js");
          if (IDS.adsgramInterstitial) adsgram.interstitial = window.Adsgram.init({ blockId: IDS.adsgramInterstitial });
          if (IDS.adsgramRewarded) adsgram.rewarded = window.Adsgram.init({ blockId: IDS.adsgramRewarded });
        } catch { adsgram = {}; }
      }
    }
    if (KIND === "gamedistribution") {
      // События SDK копятся в window.__gdQueue (см. GD_OPTIONS в tools/build.py), пока модуль не загрузился.
      const onGd = e => {
        if (e.name === "SDK_GAME_PAUSE") firePause();
        if (e.name === "SDK_GAME_START") fireResume();
        if (e.name === "SDK_REWARDED_WATCH_COMPLETE") gdRewarded = true;
      };
      (window.__gdQueue || []).forEach(onGd);
      window.__gdHandler = onGd;
    }
    // В YouTube Page Visibility API запрещён - там паузу присылает SDK. В Playgama - Bridge.
    if (KIND === "youtube") {
      yt.system.onPause(firePause);
      yt.system.onResume(fireResume);
    } else if (!pg) {
      document.addEventListener("visibilitychange", () => (document.hidden ? firePause() : fireResume()));
    }
  },

  firstFrameReady() {
    if (KIND === "youtube") yt.game.firstFrameReady();
  },

  gameReady() {
    if (KIND === "youtube") yt.game.gameReady();
    if (ysdk) ysdk.features.LoadingAPI?.ready();
    if (pg) pg.platform.sendMessage("game_ready");
    if (cg) cg.game.loadingStop?.();
  },

  // Игровой процесс идёт / остановлен (карточки, реклама). Нужно Яндексу и Playgama.
  gameplayStart() {
    if (playing) return;
    playing = true;
    if (ysdk) ysdk.features.GameplayAPI?.start();
    if (pg) pg.platform.sendMessage("gameplay_started");
    if (cg) cg.game.gameplayStart();
  },

  gameplayStop() {
    if (!playing) return;
    playing = false;
    if (ysdk) ysdk.features.GameplayAPI?.stop();
    if (pg) pg.platform.sendMessage("gameplay_stopped");
    if (cg) cg.game.gameplayStop();
  },

  async load() {
    if (KIND === "youtube") {
      try { return (await yt.game.loadData()) || ""; } catch { return ""; }
    }
    if (pg) {
      // Playgama требует хранить прогресс только через их хранилище.
      try {
        const [data] = await pg.storage.get(["save"]);
        return typeof data === "string" ? data : "";
      } catch { return ""; }
    }
    if (cg) {
      // Модуль данных CrazyGames: сохраняет в облако, если игрок вошёл в аккаунт.
      try { return (await cg.data.getItem(KEY)) || ""; } catch { return ""; }
    }
    if (KIND === "telegram" && tg.CloudStorage) {
      // Облако Telegram: прогресс один и тот же на телефоне и компьютере.
      const cloud = await new Promise(r => {
        try { tg.CloudStorage.getItem(KEY, (err, v) => r(err ? "" : v || "")); } catch { r(""); }
      });
      return cloud || localLoad();
    }
    if (yPlayer) {
      try {
        const data = await yPlayer.getData(["save"]);
        if (data && typeof data.save === "string" && data.save) return data.save;
      } catch { /* ниже - локальная копия */ }
    }
    return localLoad();
  },

  save(text) {
    if (KIND === "youtube") {
      yt.game.saveData(text).catch(() => {});
      return;
    }
    if (pg) {
      pg.storage.set(["save"], [text]).catch(() => {});
      return;
    }
    if (cg) {
      try { cg.data.setItem(KEY, text); } catch { /* ниже не дублируем */ }
      return;
    }
    if (yPlayer) yPlayer.setData({ save: text }).catch(() => {});
    if (KIND === "telegram" && tg.CloudStorage && text.length <= TG_LIMIT) {
      try { tg.CloudStorage.setItem(KEY, text, () => {}); } catch { /* только локально */ }
    }
    localSave(text);
  },

  sendScore(value) {
    if (KIND === "youtube") yt.engagement.sendScore({ value }).catch(() => {});
  },

  audioEnabled() {
    if (KIND === "youtube") return yt.system.isAudioEnabled();
    if (pg) return pg.platform.isAudioEnabled !== false;
    if (cg) return !cg.game.settings?.muteAudio;
    return true;
  },

  onAudioChange(cb) {
    if (KIND === "youtube") yt.system.onAudioEnabledChange(cb);
    else audioHandlers.push(cb);
  },

  onPause(cb) { pauseHandlers.push(cb); },
  onResume(cb) { resumeHandlers.push(cb); },

  async language() {
    if (KIND === "youtube") {
      try { return await yt.system.getLanguage(); } catch { return "en"; }
    }
    if (ysdk) return ysdk.environment?.i18n?.lang || "en";
    if (pg) return pg.platform.language || "en";
    if (cg) return cg.user?.systemInfo?.locale || navigator.language || "en";
    if (KIND === "telegram") return tg.initDataUnsafe?.user?.language_code || navigator.language || "en";
    return navigator.language || "en";
  },

  // ---------- реклама ----------

  // Межуровневая реклама в естественной паузе. Частоту ограничивает сама площадка.
  // Promise выполняется, когда реклама закрылась или не показалась.
  showInterstitial() {
    const now = Date.now();
    if (now - lastInterstitial < INTERSTITIAL_GAP) return Promise.resolve();
    lastInterstitial = now;
    if (pg) return pg.advertisement.isInterstitialSupported ? pgAd("interstitial").then(() => {}) : Promise.resolve();
    if (cg) return cgAd("midgame").then(() => {});
    if (KIND === "telegram") return adsgram.interstitial ? tgAd(adsgram.interstitial).then(() => {}) : Promise.resolve();
    if (KIND === "gamedistribution") return window.gdsdk ? gdAd("interstitial").then(() => {}) : Promise.resolve();
    if (!ysdk) return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(limit); fireResume(); resolve(); } };
      const limit = setTimeout(finish, 60000);
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: firePause,
          onClose: finish,
          onError: finish,
          onOffline: finish,
        },
      });
    });
  },

  rewardedSupported() {
    if (pg) return !!pg.advertisement.isRewardedSupported;
    if (cg) return cg.environment === "crazygames";
    if (KIND === "telegram") return !!adsgram.rewarded;
    if (KIND === "gamedistribution") return !!window.gdsdk;
    return !!ysdk;
  },

  // Реклама за награду. Promise<boolean>: true, если досмотрел и награда положена.
  showRewarded() {
    if (pg) return pgAd("rewarded");
    if (cg) return cgAd("rewarded");
    if (KIND === "telegram") return adsgram.rewarded ? tgAd(adsgram.rewarded) : Promise.resolve(false);
    if (KIND === "gamedistribution") return window.gdsdk ? gdAd("rewarded") : Promise.resolve(false);
    if (!ysdk) return Promise.resolve(false);
    return new Promise(resolve => {
      let rewarded = false;
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: firePause,
          onRewarded: () => { rewarded = true; },
          onClose: () => { fireResume(); resolve(rewarded); },
          onError: () => { fireResume(); resolve(false); },
        },
      });
    });
  },
};
