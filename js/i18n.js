/* i18n.js — everything to do with language.
 *
 * Decides which language to show, loads that language's interface labels,
 * flips the page to right-to-left for Arabic, and hands out a small `t()`
 * function that turns a label name into a sentence.
 *
 * "i18n" is the usual shorthand for "internationalisation" — i, 18 letters, n.
 */

export const SUPPORTED_LANGS = ['en', 'ar'];
export const DEFAULT_LANG = 'en';

const STORAGE_KEY = 'aiko.lang';

/**
 * Work out which language to use, in order of preference:
 *   1. ?lang=ar in the address bar  (lets you share a direct link)
 *   2. whatever the player chose last time
 *   3. English
 */
export function getLang() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (SUPPORTED_LANGS.includes(fromUrl)) return fromUrl;

  const stored = safeRead(STORAGE_KEY);
  if (SUPPORTED_LANGS.includes(stored)) return stored;

  return DEFAULT_LANG;
}

/** Remember the choice and reload the page in the new language. */
export function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;

  safeWrite(STORAGE_KEY, lang);

  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.location.href = url.toString();
}

/** Given the current language, which one does the toggle button switch to? */
export function otherLang(lang) {
  return SUPPORTED_LANGS.find((l) => l !== lang) ?? DEFAULT_LANG;
}

/** Fetch the interface labels for one language. */
export async function loadStrings(lang) {
  const response = await fetch(`data/strings.${lang}.json`);
  if (!response.ok) {
    throw new Error(`Could not load data/strings.${lang}.json (${response.status})`);
  }
  return response.json();
}

/**
 * Tell the browser what language this page is in, and which way it reads.
 * Arabic sets dir="rtl", which mirrors the entire layout — the CSS is written
 * with logical properties so this needs no extra styling.
 */
export function applyDocumentLanguage(strings) {
  document.documentElement.lang = strings.language;
  document.documentElement.dir = strings.dir ?? 'ltr';
}

/**
 * Build the translator. Call it with a label name and, if the label has
 * blanks in it, the values to fill them with:
 *
 *   t('start')                                 -> "Start Mission"
 *   t('progress', { current: 2, total: 3 })    -> "Mission 2 of 3"
 */
export function createTranslator(strings) {
  return function t(key, values = {}) {
    const template = strings.ui[key];

    if (template === undefined) {
      console.warn(`[Aiko] Missing label "${key}" in strings.${strings.language}.json`);
      return key;
    }

    return template.replace(/\{(\w+)\}/g, (match, name) =>
      name in values ? String(values[name]) : match
    );
  };
}

/* Browsers can block localStorage (private mode, strict settings). A player
   losing their language preference is not worth crashing the game over. */

function safeRead(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
