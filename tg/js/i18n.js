// Тексты интерфейса. Английский обязателен для YouTube Playables и служит запасным:
// если в языке нет строки, берётся английская. Сами тексты - в папке lang/.
// В строках можно подставлять значения: t("chestIn", { n: 3 }).

import en from "./lang/en.js?v=c5f3f44135";
import ru from "./lang/ru.js?v=c5f3f44135";
import uk from "./lang/uk.js?v=c5f3f44135";
import es from "./lang/es.js?v=c5f3f44135";
import pt from "./lang/pt.js?v=c5f3f44135";
import fr from "./lang/fr.js?v=c5f3f44135";
import de from "./lang/de.js?v=c5f3f44135";
import it from "./lang/it.js?v=c5f3f44135";
import tr from "./lang/tr.js?v=c5f3f44135";
import pl from "./lang/pl.js?v=c5f3f44135";
import id from "./lang/id.js?v=c5f3f44135";
import hi from "./lang/hi.js?v=c5f3f44135";

// Порядок - как в списке выбора. name - самоназвание языка, locale - формат чисел.
export const LANGUAGES = [
  { code: "en", name: "English", locale: "en-US", strings: en },
  { code: "es", name: "Español", locale: "es-ES", strings: es },
  { code: "pt", name: "Português", locale: "pt-BR", strings: pt },
  { code: "fr", name: "Français", locale: "fr-FR", strings: fr },
  { code: "de", name: "Deutsch", locale: "de-DE", strings: de },
  { code: "it", name: "Italiano", locale: "it-IT", strings: it },
  { code: "pl", name: "Polski", locale: "pl-PL", strings: pl },
  { code: "tr", name: "Türkçe", locale: "tr-TR", strings: tr },
  { code: "uk", name: "Українська", locale: "uk-UA", strings: uk },
  { code: "ru", name: "Русский", locale: "ru-RU", strings: ru },
  { code: "id", name: "Bahasa Indonesia", locale: "id-ID", strings: id },
  { code: "hi", name: "हिन्दी", locale: "hi-IN", strings: hi },
];

let current = LANGUAGES[0];

// Код вида "pt-BR", "uk", "in" (старый код индонезийского) -> поддерживаемый язык или английский.
export function resolveLanguage(code) {
  let short = String(code || "en").toLowerCase().slice(0, 2);
  if (short === "in") short = "id";
  return LANGUAGES.find(l => l.code === short) || LANGUAGES[0];
}

export function setLanguage(code) {
  current = resolveLanguage(code);
  document.documentElement.lang = current.code;
  return current.code;
}

export function currentLanguage() {
  return current;
}

export function t(key, vars) {
  let s = current.strings[key] ?? en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

export function fmt(n) {
  return Math.round(n).toLocaleString(current.locale);
}
