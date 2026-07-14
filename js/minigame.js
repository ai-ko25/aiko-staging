/* minigame.js, the game the child is actually playing.
 *
 * The whole point of this file is the INTERRUPTION. A real stranger does not
 * announce himself; he arrives while you are busy doing something you enjoy. So
 * the child starts the mission already playing: the kid runs, rocks slide in
 * along the ground, and a tap makes them jump. Then the stranger walks in on the
 * same track the rocks come from, and the game stops dead.
 *
 * The child's game score is kept safe while the message is dealt with. Nothing
 * is taken away for engaging with the safety moment: the message is an obstacle,
 * not a punishment.
 *
 * It knows nothing about missions, red flags, or Aiko. It runs a little game and
 * calls back when the stranger should arrive. ui.js does the rest.
 */

import { createSfx } from './sfx.js';

const el = (id) => document.getElementById(id);

const TRAVEL_MS = 2600;   // how long a rock takes to cross the whole scene
const HIT_AT    = 0.68;   // ...and roughly where along that it draws level with the kid
const SPAWN_MS  = 1500;   // gap between rocks
const JUMP_MS   = 620;    // how long the kid is in the air


const sfx = createSfx();

export function createRunner() {
  let timers = [];
  let live = false;
  let jumping = false;
  let score = 0;

  const after = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const clearAll = () => { timers.forEach(clearTimeout); timers = []; };

  /* Someone who asked their system for less motion has every animation switched
     off by base.css, which would leave them staring at a frozen, unplayable
     game. They skip the round and go straight to the message instead. */
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setScore(n) {
    score = n;
    el('run-score').textContent = String(n);
  }

  function jump() {
    if (!live || jumping) return;
    jumping = true;
    sfx.play('jump');
    const kid = el('kid');
    kid.classList.remove('stumble');
    kid.classList.add('jump');
    after(() => { kid.classList.remove('jump'); jumping = false; }, JUMP_MS);
  }

  function spawn() {
    if (!live) return;

    const rock = document.createElement('i');
    rock.className = 'obstacle';
    el('obstacles').append(rock);

    /* The only rule in the game: when the rock draws level with the kid, was he
       in the air? A miss costs nothing but a stumble. Nothing here can fail a
       child, because failing at the mini-game is not the lesson. */
    after(() => {
      if (!live) return;
      if (jumping) {
        sfx.play('clear');
        setScore(score + 1);
        rock.classList.add('cleared');
      } else {
        const kid = el('kid');
        sfx.play('stumble');
        kid.classList.add('stumble');
        after(() => kid.classList.remove('stumble'), 500);
      }
    }, TRAVEL_MS * HIT_AT);

    after(() => rock.remove(), TRAVEL_MS + 300);
    after(spawn, SPAWN_MS);
  }

  return {
    /**
     * Play a round. `fresh` resets the score (a new mission, not the next
     * message). `onInterrupt` is the stranger arriving, and it fires once
     * `playMs` has passed.
     */
    start({ fresh, playMs, coachText, onInterrupt }) {
      this.stop();
      if (fresh) score = 0;
      setScore(score);

      if (reduceMotion()) { onInterrupt(); return; }

      live = true;
      el('scene-stage').classList.add('runner-live');
      el('kid').classList.add('running');
      el('run-hud').hidden = false;

      const coach = el('run-coach');
      coach.textContent = coachText ?? '';
      coach.hidden = false;
      after(() => { coach.hidden = true; }, 2400);

      after(spawn, 700);
      after(() => { this.freeze(); onInterrupt(); }, playMs);
    },

    /** The stranger arrives. Everything stops exactly where it is, score kept. */
    freeze() {
      live = false;
      jumping = false;
      clearAll();                       // rocks stay put, mid-air, unremoved
      el('scene-stage').classList.add('runner-frozen');
      el('kid').classList.remove('running', 'jump', 'stumble');
      el('run-coach').hidden = true;
    },

    /** Leaving the mission, or starting the next message: wipe the board. */
    stop() {
      live = false;
      jumping = false;
      clearAll();
      const stage = el('scene-stage');
      if (!stage) return;
      stage.classList.remove('runner-live', 'runner-frozen');
      el('kid').classList.remove('running', 'jump', 'stumble');
      el('obstacles').replaceChildren();
      el('run-hud').hidden = true;
      el('run-coach').hidden = true;
    },

    jump,
    get score() { return score; },
  };
}
