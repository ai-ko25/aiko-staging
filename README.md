# Aiko

An online-safety companion for kids aged 8–12. The world is a hierarchy —
**World → Regions → Topics → Missions** — and each mission is a little scene in
three beats: **Spot** (tap the red flags hiding in the message), **Decide**
(pick the safe response), **React** (Aiko cheers or worries, and teaches).

Plain HTML, CSS and JavaScript. No build step, no dependencies, no install.

---

## Running it

**Double-clicking `index.html` will not work.** Aiko loads its world and
missions from JSON files, and browsers block that when a page is opened straight
from a folder.

From this folder, run:

```bash
python3 serve.py
```

Then open <http://localhost:8000>.

**Use `serve.py` while you're editing, not `python3 -m http.server`.** The plain
server lets your browser hold on to old, cached copies of the CSS and JavaScript,
so a change can look like it "didn't work" when it did. `serve.py` is the same
server with caching off, so every edit shows on a normal refresh. If you ever do
see stale behaviour, hard-refresh once: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows).

Arabic: visit <http://localhost:8000/?lang=ar>, or press the language button in
the top corner. Your place in the world and your language choice are both kept.

---

## The one rule

**JSON holds the words. JavaScript holds the behaviour. CSS holds the looks.**

If you ever find yourself typing a sentence a child will read into a `.js` file,
something has gone wrong.

---

## Where the content lives

```
data/world.en.json          The map: regions → topics, with "available" or
data/world.ar.json          "coming-soon" on each. Add a region/topic here.

data/missions/<topic>.en.json   One file per topic, holding its missions.
data/missions/<topic>.ar.json   ← you'll live here

data/strings.en.json        The chrome around the game: buttons, labels,
data/strings.ar.json        hints, the "For grown-ups" note templates.
```

An `available` topic's `"missions"` field names its mission file. A
`coming-soon` topic has no file yet — it shows greyed with a badge.

---

## Adding a mission

Open the topic's file (e.g. `data/missions/strangers-online.en.json`) and add
one object to the `missions` list:

```json
{
  "id": "a-short-nickname",
  "title": "The title shown on the topic list",
  "setting": "🎮 Where it happens (the chip at the top of the scene)",
  "sender": "who the message is from (label over the chat bubble)",
  "message": [
    { "text": "A harmless part of the message. ",
      "hint": "What Aiko says if the child taps this — warm, points them back." },
    { "text": "The suspicious part.",
      "flag": true,
      "found": "What Aiko says when they find it — celebrate the noticing. 🚩" }
  ],
  "spot": {
    "prompt": "Aiko's opening line: what just happened, and 'can you tap it?'",
    "missHint": "Fallback nudge for taps on pieces that have no hint of their own."
  },
  "decide": {
    "prompt": "Aiko's question above the choice cards",
    "choices": [
      { "id": "tempting-wrong", "icon": "💬", "text": "Short button label",
        "correct": false, "feedback": "Why not — kind, never scolding." },
      { "id": "the-safe-one",   "icon": "🛡️", "text": "Short button label",
        "correct": true,  "feedback": "Why this was the right call." }
    ]
  },
  "react": {
    "takeaway": "The one sentence you hope they remember tomorrow.",
    "parentTag": "a short name for this risky pattern, used in the grown-ups note"
  }
}
```

The pieces of `message` are joined into one chat bubble; every piece marked
`"flag": true` must be tapped before the choices appear, so a mission can hide
one red flag or several. Then add the same mission to the Arabic file, **keeping
every `id` identical and the message pieces in the same order with the same
pieces flagged** — position is how the two languages line up.

Save, refresh. No code to touch.

### Rules the game enforces for you

Open the browser console (F12) while playing. Aiko checks the files and
complains there if:

- a mission has no `id`, no `message`, or fewer than two choices — the game
  refuses to start and names the mission
- a message has no `flag: true` piece, a flag has no `found` line, or no choice
  is `"correct": true` — playable, but warned, because it's almost certainly a
  mistake
- a region, topic, or mission exists in one language but not the other
- the same mission has different flag positions or choice `id`s across languages

That last pair is the one that catches you months later. The console tells you
the day it happens.

---

## Adding a language

1. Copy `data/world.en.json`, `data/strings.en.json`, and each
   `data/missions/*.en.json` to `.xx.json` and translate the text. Leave every
   `id` — and the order of message pieces — exactly as it is.
2. In `data/strings.xx.json`, set `"language"` and, if the language reads right
   to left, `"dir": "rtl"`.
3. In `js/i18n.js`, add `'xx'` to `SUPPORTED_LANGS`.

That third step is the only code change, and it's one word. The layout mirrors
itself for right-to-left languages automatically.

---

## What each file does

```
index.html              The empty stage: labelled boxes, no words of its own.
serve.py                The dev server (caching off). python3 serve.py

css/base.css            Flattens browser defaults so every browser starts equal.
css/theme.css           The brand: colours, fonts, glow, sky, corners.
css/game.css            How everything looks: cards, the scene, bubbles, dock.

js/main.js              The conductor: loads the world, listens to the router,
                        wires clicks to engine + progress + navigation.
js/router.js            The address bar: #/r/region/topic/mission ↔ position.
js/content.js           The librarian. The only file that reads a JSON file.
js/engine.js            The rulebook: beats, score, rethink counting.
js/ui.js                The stage crew. Draws everything, decides nothing.
js/progress.js          The memory: which missions this child has finished.
js/i18n.js              Language: which one, its labels, and right-to-left.

data/                   All the words (see "Where the content lives").
assets/aiko/            Aiko's cleaned sprites: idle, safe, risky, celebrate.
assets/images/          The raw art drops, untouched.
reference/              Earlier prototypes the design is ported from.
```

The split between `engine.js` and `ui.js` is the important one. The engine can
be tested without a browser, and the game's rules can never quietly leak into
the drawing code.

---

## Deploying

Upload the whole folder to any static host — GitHub Pages, Netlify, Cloudflare
Pages, Vercel. Nothing to build, nothing to configure. The local-server
requirement disappears the moment the site has a real URL.

---

## Notes

- The Arabic translations were drafted by the assistant and have **not** been
  reviewed by a native speaker. Do that before this reaches real children —
  safety advice needs to sound warm, not stiff.
- A wrong answer never ends a mission: Aiko explains why in her bubble and the
  child tries again. The star is only earned for a first-try safe choice, and
  wrong tries are counted quietly as "rethink moments" for the grown-ups note —
  never announced to the child.
- Spotting red flags never scores and never punishes. It trains noticing.
