/* ui.js, the stage crew.
 *
 * Takes what main.js and the engine say is true and paints it onto the page. It
 * decides nothing, it doesn't know what a correct answer is, only that it was
 * told to light a piece of the message gold. Every change to the page happens
 * here. It never builds a URL and never reads a data file: it calls the
 * handlers main.js gives it, and draws whatever it's handed.
 */

import { createRunner } from './minigame.js';
import { createVoice } from './voice.js';
import { createSfx } from './sfx.js';

const el = (id) => document.getElementById(id);

/* The little game the child is playing when the mission opens. */
const runner = createRunner();

/* Aiko's voice. Silent until the mp3 files exist, and silent for anyone whose
   browser blocks audio: a child is never blocked by a clip that did not load. */
const voice = createVoice();

/* The sounds of the world. Synthesised, so there is nothing to download. */
const sfx = createSfx();

/* Whether sound is on. Remembered, because a teacher who mutes this for a class
   should not have to mute it again after every reload. Blocked storage (private
   browsing, locked-down school devices) must never break the game, so a failure
   to remember simply means sound stays on. */
const SOUND_KEY = 'aiko.sound';
function soundRemembered() {
  try { return window.localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
function rememberSound(on) {
  try { window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* fine */ }
}

/* How long the child gets to play before the stranger walks in. The first
   message gives them longer, so they learn the game and are properly enjoying it
   when it gets taken away. That is the feeling the mission is teaching. */
const PLAY_MS_FIRST = 6500;
const PLAY_MS_NEXT  = 4500;

/* The demo beat's clock, in ms from the moment the stranger interrupts.
 *
 * These are READING times, not animation times, and that is the whole point: an
 * 8-year-old reads far slower than an adult skims, and the first pass of this
 * went by too fast to follow even for an adult. Each of Aiko's lines gets a
 * beat of silence after it before anything else moves. If it still reads fast,
 * these are the only numbers to change.
 */
const DEMO = {
  strangerIn:   200,
  bubbleUp:    1100,
  boxUp:       1500,
  watchLine:   2000,   // "Uh oh! A stranger stopped your game. Watch what I do."
  spotLight:   5700,   // Aiko hunts: the sketchy chip swells and pulses…
  takeChip:    9400,   // …and only 3.7s LATER is it taken. The hunt is the lesson.
  gulp:        9800,
  doingLine:  10200,   // "I never answer that. I take it to a grown-up."
  overLine:   13900,
  handOver:   17600,   // …3.7s to read "Now it's your turn"
};

/* Which sprite Aiko wears for each mood. Presentation assets, not mission
   content, so they live with the drawing code, the engine never sees them. */
const AIKO_SPRITE = {
  idle:  'assets/aiko/idle.png',
  safe:  'assets/aiko/safe.png',
  risky: 'assets/aiko/risky.png',
};

/* Swap Aiko's image and toggle the runner's cheer / worried classes, which
   tune its glow and give it a little pop or wobble as it reacts. */
function setAiko(mood) {
  const img = el('aiko-img');
  const figure = el('aiko-figure');
  if (!img || !figure) return;
  img.src = AIKO_SPRITE[mood] ?? AIKO_SPRITE.idle;
  figure.classList.toggle('cheer', mood === 'safe');
  figure.classList.toggle('worried', mood === 'risky');
}

/* Every screen is a <section> in index.html; show() reveals exactly one. */
const SCREENS = ['loading', 'error', 'open', 'world', 'region', 'topic', 'mission', 'complete'];

/** Small helper: make an element with a class and text in one line. */
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* The scene runs on a few short timers (the message "arrives", Aiko's hint
   fades). They are all registered here so a new render can cancel the lot , 
   otherwise a leftover timer from the previous mission could redraw stale
   content on top of the new one. */
let sceneTimers = [];
function later(fn, ms) { sceneTimers.push(setTimeout(fn, ms)); }
function clearSceneTimers() { sceneTimers.forEach(clearTimeout); sceneTimers = []; }

/* Which message of the conversation we're on, so the progress bar and stepping
   tiles can be updated from the spot/decide handlers without re-passing them. */
let sceneN = 1;
let sceneTotal = 1;

function aikoSay(text) {
  const bubble = el('aiko-bubble');
  el('aiko-bubble-text').textContent = text ?? '';
  bubble.classList.toggle('show', Boolean(text));
  if (text) voice.say(text);          /* the line finds its own recording */
  else voice.stop();
}

/* ------------------------------------------------------------------ *
 *  Taking the sketchy part of a message to a grown-up.
 *
 *  The gesture IS the lesson: you do not delete the bad thing and you do not
 *  answer it, you hand it to someone safe. Two ways to do it, because a drag
 *  can misbehave on a real device and a child must never be stranded:
 *
 *    drag  the chip into the mailbox, or
 *    tap   the chip (it lifts, the mailbox starts calling) then tap the mailbox.
 *
 *  Either way it ends in the same place: handlers.onSpot(index), which is the
 *  exact call a plain tap made before. The engine never learns any of this.
 * ------------------------------------------------------------------ */

const DRAG_SLOP = 8;     // finger wobble below this is a tap, not a drag
const CATCH_PAD = 14;    // the mailbox catches a little wider than it looks

let liftedIndex = null;

const chipAt = (index) =>
  el('message-text').querySelector(`[data-piece-index="${index}"]`);

function armGrownup(on) {
  el('grownup').classList.toggle('armed', on);
}

/** Tap path: the chip rises into the child's hand and the mailbox calls for it. */
function liftChip(btn) {
  dropChip();
  sfx.play('pickup');
  btn.classList.add('lifted');
  liftedIndex = Number(btn.dataset.pieceIndex);
  armGrownup(true);
}

function dropChip() {
  el('message-text').querySelectorAll('.lifted')
    .forEach((n) => n.classList.remove('lifted'));
  liftedIndex = null;
  armGrownup(false);
}

/**
 * Build the message out of tappable chips (buttons, so keyboards and screen
 * readers reach them too). `live: false` is the demo: the child watches these,
 * they are not theirs to touch yet.
 */
function renderParts(parts, { live = true } = {}) {
  el('message-text').replaceChildren(...(parts ?? []).map((part, i) => {
    const btn = make('button', 'msg-piece', part.text);
    btn.type = 'button';
    btn.dataset.pieceIndex = String(i);
    btn.disabled = !live;
    return btn;
  }));
}

/** How far a chip has already been shifted from where the text flow put it. */
function currentShift(btn) {
  const m = /(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(btn.style.translate || '');
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/**
 * Send the chip the rest of the way into the mailbox and leave it there.
 *
 * A dropped chip used to spring back to the bubble and only then fade, which
 * read as "rejected, put it back" at the exact moment the child got it right.
 * It now lands where they aimed it and disappears into the box. The tap path
 * calls this too, so the chip visibly flies across rather than teleporting.
 */
function flyIntoGrownup(btn) {
  sfx.play('fly');
  const [sx, sy] = currentShift(btn);
  const chip = btn.getBoundingClientRect();
  const box = el('grownup').getBoundingClientRect();
  const dx = (box.left + box.width / 2) - (chip.left + chip.width / 2);
  const dy = (box.top + box.height / 2) - (chip.top + chip.height / 2);
  btn.style.translate = `${sx + dx}px ${sy + dy}px`;
}

/** Generous hit box, because a child's aim with a thumb is not a mouse pointer. */
function overGrownup(x, y) {
  const box = el('grownup');
  if (box.hidden) return false;
  const r = box.getBoundingClientRect();
  return x >= r.left - CATCH_PAD && x <= r.right + CATCH_PAD
      && y >= r.top - CATCH_PAD  && y <= r.bottom + CATCH_PAD;
}

/** One pointer path for mouse and touch alike. `deliver` is handlers.onSpot. */
function startDrag(event, btn, deliver) {
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  btn.setPointerCapture(event.pointerId);

  const move = (e) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragging && Math.hypot(dx, dy) > DRAG_SLOP) {
      dragging = true;
      sfx.play('pickup');
      dropChip();
      btn.classList.add('dragging');
      armGrownup(true);
    }
    if (!dragging) return;

    btn.style.translate = `${dx}px ${dy}px`;
    el('grownup').classList.toggle('over', overGrownup(e.clientX, e.clientY));
  };

  const end = (e) => {
    btn.removeEventListener('pointermove', move);
    btn.removeEventListener('pointerup', end);
    btn.removeEventListener('pointercancel', end);
    el('grownup').classList.remove('over');

    /* Barely moved: that was a tap, so fall back to lift-then-tap-the-mailbox. */
    if (!dragging) { liftChip(btn); return; }

    const landed = overGrownup(e.clientX, e.clientY);
    btn.classList.remove('dragging');
    armGrownup(false);

    /* Landed: it stays where the child put it, and showSpotResult settles it the
       rest of the way in. Missed: it springs home, and only then. */
    if (!landed) { btn.style.translate = ''; return; }
    deliver(Number(btn.dataset.pieceIndex));
  };

  btn.addEventListener('pointermove', move);
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
}

/**
 * @param {Function} t         translator from i18n.js
 * @param {Object}   handlers  what to call when the child clicks something
 */
export function createUI(t, handlers) {
  /* The document's language is already set by i18n before this runs, so the
     right set of recordings is chosen without threading the language through. */
  voice.load(document.documentElement.lang || 'en');

  /* A browser will not make a sound until the child has touched the screen. The
     first touch anywhere wakes the audio engine, so the first sound that MATTERS
     is never the one that gets swallowed. */
  document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

  /* Sound on/off. It governs BOTH the effects and Aiko's voice: a child who
     mutes the game means all of it, not just the beeps. */
  let soundOn = soundRemembered();
  const applySound = () => {
    sfx.setEnabled(soundOn);
    voice.setEnabled(soundOn);
    const btn = el('sound-toggle');
    el('sound-icon').textContent = soundOn ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(soundOn));
    btn.setAttribute('aria-label', t(soundOn ? 'soundOn' : 'soundOff'));
    btn.title = t(soundOn ? 'soundOn' : 'soundOff');
  };
  applySound();

  el('sound-toggle').addEventListener('click', () => {
    soundOn = !soundOn;
    rememberSound(soundOn);
    applySound();
    if (soundOn) { sfx.unlock(); sfx.play('tap'); }   /* hear that it came back */
  });

  /* Persistent buttons, these exist for the whole session. */
  el('home-btn').addEventListener('click', handlers.onHome);
  el('lang-toggle').addEventListener('click', handlers.onLangToggle);
  el('enter-btn').addEventListener('click', handlers.onEnter);
  el('region-back').addEventListener('click', handlers.onExitRegion);
  el('topic-back').addEventListener('click', handlers.onExitTopic);
  el('mission-back').addEventListener('click', handlers.onExitMission);
  el('spot-continue').addEventListener('click', handlers.onSpotContinue);
  el('next-btn').addEventListener('click', handlers.onNext);
  el('replay-btn').addEventListener('click', handlers.onReplay);
  el('more-topics-btn').addEventListener('click', handlers.onExitComplete);

  /* Delegated clicks, cards, message pieces, and choice cards are rebuilt
     often, so we listen on the containers that stay put. */
  el('region-grid').addEventListener('click', (e) => {
    const island = e.target.closest('.island');
    if (island && !island.disabled) handlers.onRegion(island.dataset.regionId);
  });
  el('topic-grid').addEventListener('click', (e) => {
    const row = e.target.closest('.list-row');
    if (row && !row.disabled) handlers.onTopic(row.dataset.topicId);
  });
  el('mission-list').addEventListener('click', (e) => {
    const row = e.target.closest('.list-row');
    if (row && !row.disabled) handlers.onMission(row.dataset.missionId);
  });
  /* Tap anywhere in the scene to jump. Taps on the message chips are the child
     working on the red flag, not playing, so they never jump. */
  el('scene-stage').addEventListener('pointerdown', (e) => {
    if (e.target.closest('.bubble')) return;
    runner.jump();
  });

  /* Grab a chip: drag it to the grown-up, or tap it to lift it. */
  el('message-text').addEventListener('pointerdown', (e) => {
    const piece = e.target.closest('.msg-piece');
    if (!piece || piece.disabled) return;
    e.preventDefault();                 // no text selection, no scroll hijack
    startDrag(e, piece, handlers.onSpot);
  });

  /* Keyboard only (a real click from a pointer is handled above). Enter or Space
     lifts the chip; the child then moves to the mailbox and presses again. */
  el('message-text').addEventListener('click', (e) => {
    const piece = e.target.closest('.msg-piece');
    if (piece && !piece.disabled && e.detail === 0) liftChip(piece);
  });

  /* The mailbox: the second half of the tap fallback. */
  el('grownup').addEventListener('click', () => {
    if (liftedIndex == null) return;
    const index = liftedIndex;
    dropChip();
    handlers.onSpot(index);
  });
  el('choices').addEventListener('click', (e) => {
    const card = e.target.closest('.choice-card');
    if (card && !card.disabled) handlers.onDecide(card.dataset.choiceId);
  });

  return {
    /** Fill every element tagged data-i18n with its label. */
    applyStaticText(langToggleLabel) {
      document.title = t('appTitle');
      document.querySelectorAll('[data-i18n]').forEach((node) => {
        node.textContent = t(node.dataset.i18n);
      });
      el('lang-toggle').textContent = langToggleLabel;
    },

    show(name) {
      /* Leaving the mission must kill the game, or it keeps running (and
         spawning rocks) behind whatever screen is on top. */
      if (name !== 'mission') { runner.stop(); voice.stop(); }
      SCREENS.forEach((key) => { el(`${key}-screen`).hidden = key !== name; });

      /* On a phone the mission is not a card on a page, it IS the page: the
         frame fills the screen and the brand, language and back controls move
         inside it. Only the mission does this, so the world and topic screens
         are left exactly as they were. The CSS keys off this one class. */
      el('app').classList.toggle('on-mission', name === 'mission');
    },

    showError() {
      this.show('error');
      this.hideScore();
    },

    setScore(score) {
      const node = el('score');
      node.textContent = t('score', { score });
      node.hidden = false;
    },
    hideScore() { el('score').hidden = true; },

    /** The star chip inside the scene HUD. */
    setStars(count) {
      el('star-count').textContent = String(count);
    },

    /** Fill the HUD progress bar (0..1) as the beats of the mission clear. */
    setProgress(fraction) {
      const pct = Math.max(0, Math.min(1, fraction)) * 100;
      el('progress-fill').style.width = `${pct}%`;
    },

    /* ---------------- 1. Open ---------------- */
    renderOpen() {
      this.hideScore();
      this.show('open');
    },

    /* ---------------- 2. World map (islands along a path) ---------------- */
    renderWorld(regions) {
      this.hideScore();
      const grid = el('region-grid');
      grid.replaceChildren(...regions.map((region) => {
        const locked = region.status !== 'available';
        const island = make('button', `island ${locked ? 'is-locked' : 'is-active'}`);
        island.type = 'button';
        island.dataset.regionId = region.id;
        island.disabled = locked;
        if (region.accent) island.style.setProperty('--card-accent', `var(${region.accent})`);

        const blob = make('div', 'island-blob', region.icon ?? '◆');
        if (locked) blob.append(make('span', 'island-lock', '🔒'));
        island.append(blob);
        island.append(make('div', 'island-label', region.name));
        return island;
      }));
      this.show('world');
    },

    /* ---------------- 3. Region (topic list) ---------------- */
    renderRegion(region, statsFor) {
      this.hideScore();
      el('region-title').textContent = region.name;
      el('region-tagline').textContent = region.tagline ?? '';

      const grid = el('topic-grid');
      grid.replaceChildren(...(region.topics ?? []).map((topic) => {
        const locked = topic.status !== 'available';
        const row = make('button', `list-row ${locked ? 'is-locked' : ''}`);
        row.type = 'button';
        row.dataset.topicId = topic.id;
        row.disabled = locked;
        if (region.accent) row.style.setProperty('--card-accent', `var(${region.accent})`);

        row.append(make('div', 'list-icon', topic.icon ?? '•'));
        const info = make('div', 'list-info');
        info.append(make('h4', null, topic.name));
        if (topic.description) info.append(make('p', null, topic.description));
        row.append(info);

        if (locked) {
          row.append(make('span', 'list-badge', t('comingSoon')));
        } else {
          const stats = statsFor(topic);   // { done, total }
          if (stats) {
            row.append(make('span', 'list-badge',
              t('missionsDone', { done: stats.done, total: stats.total })));
          }
          row.append(make('span', 'list-go', '›'));
        }
        return row;
      }));
      this.show('region');
    },

    /* ---------------- 4. Topic (mission list) ---------------- */
    renderTopic(topic, missions, isDone) {
      this.hideScore();
      el('topic-title').textContent = topic.name;
      el('topic-desc').textContent = topic.description ?? '';

      const list = el('mission-list');
      const rows = missions.map((mission) => {
        const locked = mission.status === 'coming-soon';
        const done = !locked && isDone(mission.id);
        const row = make('button', `list-row ${locked ? 'is-locked' : done ? 'is-done' : ''}`);
        row.type = 'button';
        row.dataset.missionId = mission.id;
        if (locked) row.disabled = true;

        row.append(make('div', 'list-icon', mission.icon ?? '🎯'));
        const info = make('div', 'list-info');
        info.append(make('h4', null, mission.title ?? mission.id));
        if (mission.subtitle) info.append(make('p', null, mission.subtitle));
        row.append(info);

        if (locked) row.append(make('span', 'list-badge', t('comingSoon')));
        else if (done) row.append(make('span', 'list-badge list-done', '✓'));
        else row.append(make('span', 'list-go', '›'));
        return row;
      });

      list.replaceChildren(...rows);
      this.show('topic');
    },

    /* ---------------- 5a. Mission, a message plays (SPOT) ----------------
     * A mission is a conversation of several messages. This draws ONE message
     * (the current one) into the scene, then plays the little arrival sequence.
     * Aiko's opening question sits in the dock hint; its bubble is kept for its
     * reactions, exactly as the runner does, so two long bubbles never collide.
     */
    renderMissionScene(mission, message, messageNumber, messageTotal, stars) {
      clearSceneTimers();
      sceneN = messageNumber;
      sceneTotal = messageTotal;

      el('scene-setting').textContent = mission.setting ?? mission.title ?? '';
      el('sender-label').textContent = mission.sender ?? '';
      this.setStars(stars);
      this.setProgress((messageNumber - 1) / messageTotal);

      /* One stepping tile per message; the ones already cleared are lit. */
      el('path').replaceChildren(...Array.from({ length: messageTotal }, (_, i) => {
        const tile = make('div', `tile${i < messageNumber - 1 ? ' lit' : ''}`);
        return tile;
      }));

      renderParts(message.parts);

      /* Everything starts hidden and calm. */
      el('stranger-bubble').classList.remove('show');
      el('stranger').classList.remove('in');
      el('grownup').hidden = true;
      el('grownup').classList.remove('armed', 'over', 'got');
      dropChip();
      aikoSay('');
      setAiko('idle');
      const dock = el('dock');
      dock.classList.remove('up');
      el('choices').replaceChildren();
      el('choices').classList.remove('answered');
      this.hideKeepGoing();
      el('feedback').hidden = true;
      el('takeaway').hidden = true;

      this.show('mission');

      /* The child does NOT start by reading a message. They start by PLAYING.
         The stranger interrupts that game, which is the whole lesson: he arrives
         while you are busy and enjoying yourself, not with a fanfare. */
      /* On the very first message the stranger's opener is Aiko's to answer. Aiko
         shows the child the move once, on a throwaway line of its own, before
         handing them a real red flag. Nobody should have to guess what to do. */
      const demo = messageNumber === 1 ? mission.demo : null;

      runner.start({
        fresh: messageNumber === 1,
        playMs: messageNumber === 1 ? PLAY_MS_FIRST : PLAY_MS_NEXT,
        coachText: t('runCoach'),
        onInterrupt: () => (demo ? this.playDemo(demo, message) : this.interrupt(message)),
      });
    },

    /**
     * The demo beat. Aiko does the whole gesture itself, once, on a practice
     * message that is not part of the mission and is never scored, so watching
     * it never gives away a real answer. Then it hands over.
     *
     * It is fully scripted: the chips are dead (disabled) for its whole length,
     * so a child prodding the screen mid-demo cannot fall into the real Spot
     * beat early. It ends by swapping in the real message and calling the exact
     * same code path a normal message uses.
     */
    playDemo(demo, message) {
      const box = el('grownup');
      renderParts(demo.parts, { live: false });

      later(() => { el('stranger').classList.add('in'); sfx.play('stranger'); }, DEMO.strangerIn);
      later(() => el('stranger-bubble').classList.add('show'), DEMO.bubbleUp);
      later(() => { box.hidden = false; }, DEMO.boxUp);

      later(() => {
        el('dock-hint').textContent = demo.prompt ?? '';
        el('dock').classList.add('up');
        aikoSay(demo.watch ?? '');     /* the demo's own lines carry the voice */
      }, DEMO.watchLine);

      const flagChip = () => el('message-text')
        .querySelector(`[data-piece-index="${demo.parts.findIndex((p) => p.flag)}"]`);

      /* Aiko HUNTS first. The sketchy chip swells and pulses while Aiko names
         what it is doing, and it stays like that for a good few seconds. Before
         this, the bad line was snatched away the instant it was pointed at, and
         a child never saw WHICH part was the problem, only that something flew
         off the screen. The spotting is the lesson; the throw is just the end. */
      later(() => {
        setAiko('risky');
        aikoSay(demo.spotting ?? '');
        flagChip()?.classList.add('spotlight');
      }, DEMO.spotLight);

      /* Only now does Aiko take it. The chip travels the same path, into the same
         box, with the same animation the child's will: they are watching a
         rehearsal of their own next move. */
      later(() => {
        const chip = flagChip();
        if (!chip) return;
        chip.classList.remove('spotlight');
        chip.classList.add('found');
        flyIntoGrownup(chip);
        later(() => chip.classList.add('delivered'), 420);
        later(() => chip.classList.add('collapsed'), 860);
      }, DEMO.takeChip);

      later(() => box.classList.add('got'), DEMO.gulp);
      later(() => box.classList.remove('got'), DEMO.gulp + 600);

      later(() => { setAiko('safe'); aikoSay(demo.doing ?? ''); }, DEMO.doingLine);
      later(() => aikoSay(demo.over ?? ''), DEMO.overLine);

      /* Handover. The practice line is cleared away, the real one arrives, and
         from here everything behaves exactly as it always did. */
      later(() => {
        renderParts(message.parts);
        setAiko('idle');
        aikoSay('');
        box.classList.remove('armed', 'over', 'got');
        const task = message.spot?.prompt ?? t('spotHint');
        el('dock-hint').textContent = task;
        voice.say(task);               /* the child's first task is spoken too */
      }, DEMO.handOver);
    },

    /* The stranger walks in on the same track the rocks came from. The game
       freezes (the runner has already done that), he slides in, his message
       lands, and only then does the dock come up with the task. */
    interrupt(message) {
      later(() => el('stranger').classList.add('in'), 200);

      /* Say WHY the game just stopped. Without this the freeze reads as the game
         breaking, and the whole lesson (he turns up while you are busy and having
         fun, and playing has to wait) is left for the child to infer. */
      later(() => { sfx.play('stranger'); setAiko('risky'); aikoSay(t('strangerHere')); }, 500);

      later(() => el('stranger-bubble').classList.add('show'), 1100);
      later(() => { el('grownup').hidden = false; }, 1500);
      later(() => {
        const task = message.spot?.prompt ?? t('spotHint');
        el('dock-hint').textContent = task;
        el('dock').classList.add('up');
        voice.say(task);
      }, 1800);
    },

    /**
     * The child tapped a part of the message. `say` is Aiko's response (from the
     * part). `canProceed` is true once every flag has been found.
     *
     * Whatever Aiko says here STAYS on screen until the child's next action. It
     * is never cleared on a timer: a timer started by one tap would otherwise
     * still be running when the next tap lands, and would wipe the new line
     * mid-read. That is what made a second-try success flash and vanish.
     */
    showSpotResult(index, flag, say, canProceed) {
      const btn = chipAt(index);
      dropChip();
      if (flag && btn) btn.disabled = true;

      if (flag) {
        /* It flashes gold so the child SEES what they caught, rides the rest of
           the way into the mailbox, and is swallowed there. Handed over to a
           grown-up, never bounced back to the child and never just deleted. */
        const box = el('grownup');
        if (btn) {
          btn.classList.add('found');
          flyIntoGrownup(btn);
          later(() => btn.classList.add('delivered'), 380);
          later(() => btn.classList.add('collapsed'), 780);   /* take the space back */
        }
        later(() => { box.classList.add('got'); sfx.play('posted'); }, 300);  /* it gulps as the chip lands */
        later(() => box.classList.remove('got'), 900);
        setAiko('safe');
        aikoSay(say);

        if (canProceed) {
          sfx.play('star');
          /* Every flag found. Lock the rest of the message so the celebration
             is not interrupted, hold Aiko's cheer and its found line on screen,
             and after a few seconds offer a friendly Keep going. The child sets
             the pace and gets to enjoy the win. No auto-advance. */
          this.setProgress((sceneN - 0.5) / sceneTotal);
          el('message-text').querySelectorAll('.msg-piece').forEach((p) => { p.disabled = true; });
          /* The task line was still ordering them to drag it to a grown-up after
             they already had. It becomes the receipt for what they just did. */
          el('dock-hint').textContent = t('spotDone');
          voice.say(t('spotDone'));
          later(() => this.showKeepGoing(), 3000);
        }
      } else {
        /* The child brought a harmless part to the grown-up. It is NOT posted:
           it flies back to where it came from, and the message closes up around
           it as if nothing happened. Only a red flag ever leaves the bubble.
           It stays draggable, because "that's not the one" has to be followed by
           "so try another", not by a piece of the screen going dead.
           Aiko's nudge stays up for as long as the child needs it. */
        if (btn) {
          btn.style.translate = '';
          btn.classList.remove('lifted', 'dragging', 'spotlight');
        }
        sfx.play('wrong');
        setAiko('risky');
        aikoSay(say);
      }
    },

    /** Reveal the "Keep going" button that moves this message from Spot to Decide. */
    showKeepGoing() {
      const btn = el('spot-continue');
      btn.hidden = false;
      btn.classList.add('show');
      /* preventScroll matters on a phone. A plain focus() scrolls the button
         into view, and that scroll shifts it out from under a finger already on
         its way down, so the first tap lands on nothing and the child has to tap
         twice. The focus itself stays, because a keyboard user needs it. */
      btn.focus({ preventScroll: true });
    },
    hideKeepGoing() {
      const btn = el('spot-continue');
      btn.hidden = true;
      btn.classList.remove('show');
    },

    /* ---------------- 5b. Mission, DECIDE ---------------- */
    renderDecide(message) {
      clearSceneTimers();
      setAiko('idle');
      aikoSay('');
      this.hideKeepGoing();
      dropChip();
      el('grownup').hidden = true;      /* Spot is over, the mailbox has its flag */

      el('dock-hint').textContent = message.decide?.prompt ?? '';
      voice.say(message.decide?.prompt ?? '');
      el('choices').classList.remove('answered');
      el('choices').replaceChildren(...(message.decide?.choices ?? []).map((choice) => {
        const item = document.createElement('li');
        item.style.display = 'contents';
        const card = make('button', 'choice-card');
        card.type = 'button';
        card.dataset.choiceId = choice.id;
        if (choice.icon) card.append(make('span', 'choice-ic', choice.icon));
        card.append(make('span', 'choice-lb', choice.text));
        item.append(card);
        return item;
      }));

      el('feedback').hidden = true;
      el('takeaway').hidden = true;
      el('dock').classList.add('up');
    },

    /* ---------------- 5c. Mission, REACT (after a Decide guess) ----------------
     * `takeaway` is the closing lesson, passed only on the final message's safe
     * pick. The stranger's bubble is hidden here so Aiko's reply has full room.
     */
    showAnswer(choice, correct, isLastMessage, takeaway) {
      sfx.play(correct ? 'correct' : 'wrong');
      const picked = el('choices').querySelector(`[data-choice-id="${choice.id}"]`);
      el('stranger-bubble').classList.remove('show');

      if (correct) {
        if (picked) picked.classList.add('safe-pick');
        el('choices').querySelectorAll('.choice-card').forEach((card) => {
          card.disabled = true;
          if (card !== picked) card.classList.add('dim');
        });
        /* The cards have done their job. Folding them away gives the scene back
           the room the takeaway panel takes, so Aiko is not crowded onto the kid
           and its closing line stays readable. */
        el('choices').classList.add('answered');

        setAiko('safe');
        aikoSay(choice.feedback ?? '');
        this.setProgress(sceneN / sceneTotal);
        el('path').children[sceneN - 1]?.classList.add('lit');

        if (takeaway) {
          el('takeaway-text').textContent = takeaway;
          el('takeaway').hidden = false;
        }
        /* Between messages the button continues the SAME mission ("Keep going");
           only the last message ends the mission ("Finish mission"). */
        const next = el('next-btn');
        next.textContent = isLastMessage ? t('finish') : t('keepGoing');
        el('feedback').hidden = false;
        next.focus();
      } else {
        /* A tempting wrong pick: brief amber ring, then it dims and locks. Aiko
           explains why and invites another try. */
        if (picked) {
          picked.disabled = true;
          picked.classList.add('risk-pick');
          later(() => { picked.classList.remove('risk-pick'); picked.classList.add('dim'); }, 950);
        }
        setAiko('risky');
        /* Aiko explains WHY. The invitation to try again goes to the dock, where
           the child's other instructions live, instead of being bolted onto the
           end of the speech bubble: it was the longest thing Aiko ever said, and
           on a small phone it grew up over the progress bar and the top of the
           screen. The explanation is Aiko's; the instruction is the dock's. */
        aikoSay(choice.feedback ?? '');
        el('dock-hint').textContent = t('tryAgain');
      }
    },

    /* ---------------- Topic complete: the big celebration ---------------- */
    showComplete(stars, total, parentNoteText) {
      this.hideScore();

      el('star-row').replaceChildren(...Array.from({ length: total }, (_, i) => {
        const star = make('span', `s${i < stars ? ' on' : ''}`, '⭐');
        star.style.animationDelay = `${i * 0.16}s`;
        return star;
      }));

      el('final-score').textContent = t('finalScore', { score: stars, total });
      el('parent-note-text').textContent = parentNoteText ?? '';

      sfx.play('complete');
      this.show('complete');
      confetti();
    },
  };
}

/* Confetti for the end-of-topic celebration. Colours come from theme.css so
   the brand stays in one place; pieces clean themselves up. */
function confetti() {
  const styles = getComputedStyle(document.documentElement);
  const palette = ['--c-primary', '--c-accent', '--c-correct', '--c-primary-dark', '--c-wrong']
    .map((name) => styles.getPropertyValue(name).trim())
    .filter(Boolean);

  for (let i = 0; i < 60; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = palette[i % palette.length];
    piece.style.animationDuration = `${2 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4500);
  }
}
