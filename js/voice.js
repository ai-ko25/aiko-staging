/* voice.js, Aiko's voice.
 *
 * Every line Aiko speaks already exists as text in the content files, and
 * data/voice-lines.json pairs each of those sentences with an mp3 filename.
 * So this needs no new call sites: it looks a sentence up BY ITS TEXT and plays
 * the matching clip. Say a line, and its voice follows.
 *
 *   assets/voice/en/age-found.mp3     ← "Nice eye! Asking your age is a red flag."
 *   assets/voice/ar/age-found.mp3     ← the Arabic recording of the same line
 *
 * It is entirely optional. With no mp3 files present the game plays exactly as
 * it does now, in silence: a missing clip is never an error, because a child
 * must never be blocked by a file that failed to download.
 */

import { versioned } from './version.js';

/* Emoji are in the text but never in the recording, and a stray double space
   should not stop a line finding its own voice. Both sides get flattened the
   same way before they are compared. */
const normalise = (text) => (text ?? '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export function createVoice() {
  let lines = new Map();      // normalised sentence -> file stem
  let lang = 'en';
  let current = null;         // the clip playing right now
  const missing = new Set();  // never ask twice for a file that isn't there
  let enabled = true;

  return {
    /**
     * Load the manifest for one language, then check ONCE whether a voice pack
     * is actually there.
     *
     * That single probe matters: without it, a game with no recordings yet asks
     * the server for an mp3 on every line Aiko speaks and gets a 404 each time.
     * One question up front, instead of thirty.
     */
    async load(language) {
      lang = language ?? 'en';
      try {
        const response = await fetch(versioned('data/voice-lines.json'));
        if (!response.ok) return;
        const rows = await response.json();
        lines = new Map(rows.map((row) => [normalise(row[lang]), row.file]));

        const probe = await fetch(versioned(`assets/voice/${lang}/${rows[0].file}.mp3`),
                                  { method: 'HEAD' });
        enabled = probe.ok;         /* no voice pack recorded yet: stay silent */
      } catch {
        /* No manifest, no voice. The game is unaffected. */
        enabled = false;
      }
    },

    /**
     * Speak a line, if there is a recording of it.
     *
     * Aiko never talks over itself: a new line cuts the previous one off, the
     * same way its speech bubble replaces the previous text.
     */
    say(text) {
      if (!enabled) return;

      const file = lines.get(normalise(text));
      if (!file || missing.has(file)) return;

      this.stop();

      const clip = new Audio(versioned(`assets/voice/${lang}/${file}.mp3`));
      current = clip;
      clip.play().catch(() => {
        /* Not recorded yet, or the browser refused to autoplay before the child
           has touched anything. Either way: stay quiet and never ask again. */
        missing.add(file);
        if (current === clip) current = null;
      });
    },

    /** Cut the current line off. Leaving a mission mid-sentence must not trail. */
    stop() {
      if (!current) return;
      current.pause();
      current = null;
    },

    /** For a future mute button, and for anyone who needs the room quiet. */
    setEnabled(on) {
      enabled = Boolean(on);
      if (!enabled) this.stop();
    },
  };
}
