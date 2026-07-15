/* sfx.js, the sounds of Aiko's world.
 *
 * Every sound here is SYNTHESISED, not a downloaded file: a few oscillators and
 * a volume envelope each. That keeps the game a small static site with nothing
 * to fetch, and means a sound fires the instant it is asked for, with none of
 * the lag that makes a tap feel broken.
 *
 * Two rules run through all of it, because of who is playing:
 *
 *   Nothing here punishes. A wrong answer gets a soft, warm note, never a buzz
 *   or a klaxon. A child who is wrong about a stranger has to feel safe enough
 *   to try again, and a harsh sound teaches them to stop touching things.
 *
 *   The stranger arriving is the only tense sound in the game, and even that is
 *   a quiet low tone, not a scare. We are teaching an 8-year-old to notice a
 *   feeling, not to be frightened of their game.
 */

/* Browsers refuse to make noise until the child has touched the screen, so the
   audio engine is built lazily on the first real interaction. */
let ctx = null;
let master = null;
let enabled = true;

function engine() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0.22;        /* under the voice, never over it */
  master.connect(ctx.destination);
  return ctx;
}

/**
 * One note. `type` is the waveform, `freq` its pitch (a single number, or
 * [from, to] to slide), `dur` its length, `delay` when it starts.
 *
 * The envelope matters more than the pitch: every note fades IN over a few
 * milliseconds and OUT to nothing. A note that starts or stops instantly clicks,
 * and a click is the sound of something breaking.
 */
function note({ type = 'sine', freq = 440, dur = 0.14, delay = 0, gain = 0.5 }) {
  const c = engine();
  if (!c || !enabled) return;

  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const vol = c.createGain();

  osc.type = type;
  if (Array.isArray(freq)) {
    osc.frequency.setValueAtTime(freq[0], t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq[1], 1), t + dur);
  } else {
    osc.frequency.setValueAtTime(freq, t);
  }

  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(gain, t + 0.012);      /* fade in */
  vol.gain.exponentialRampToValueAtTime(0.0001, t + dur);      /* fade out */

  osc.connect(vol);
  vol.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Filtered noise: air, not pitch. Used for the whoosh of a message flying. */
function noise({ dur = 0.2, delay = 0, gain = 0.16, from = 1400, to = 500 }) {
  const c = engine();
  if (!c || !enabled) return;

  const t = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(from, t);
  band.frequency.exponentialRampToValueAtTime(to, t + dur);
  band.Q.value = 1.2;

  const vol = c.createGain();
  vol.gain.setValueAtTime(gain, t);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(band); band.connect(vol); vol.connect(master);
  src.start(t);
  src.stop(t + dur);
}

/* The kit. Each entry is one sound, described in the game's own terms. */
const SOUNDS = {
  /* A finger lands on something that responds. Barely there on purpose: it is
     felt more than heard, and it fires on nearly every touch. */
  tap:      () => note({ type: 'triangle', freq: 660, dur: 0.05, gain: 0.18 }),

  /* The runner. A jump lifts, a cleared rock rings, a stumble is a soft bump
     with no sting in it: missing a rock costs nothing, and it should not sound
     like it does. A rock sliding in gives a faint tick, so the jump has a
     rhythm to fall into rather than arriving from silence. */
  tick:     () => note({ type: 'triangle', freq: 1500, dur: 0.03, gain: 0.08 }),
  jump:     () => note({ type: 'sine', freq: [420, 760], dur: 0.16, gain: 0.35 }),
  clear:    () => { note({ type: 'sine', freq: 880, dur: 0.09, gain: 0.3 });
                    note({ type: 'sine', freq: 1320, dur: 0.12, delay: 0.06, gain: 0.22 }); },
  stumble:  () => note({ type: 'triangle', freq: [260, 170], dur: 0.18, gain: 0.3 }),

  /* The dock sheet rising with a new question: a soft upward brush of air, so
     the panel feels like it slid rather than blinked into place. */
  slide:    () => noise({ dur: 0.22, gain: 0.1, from: 380, to: 1300 }),

  /* Footfalls under the stranger's arrival tone: two soft low thuds, the sound
     of someone walking up while you were not looking. Quiet on purpose. */
  footstep: () => { note({ type: 'sine', freq: 150, dur: 0.09, gain: 0.22 });
                    note({ type: 'sine', freq: 130, dur: 0.11, delay: 0.22, gain: 0.2 }); },

  /* The stranger arrives and the game stops. Two low notes, falling. The only
     tense sound in the game, and deliberately quiet: unease, not fear. */
  stranger: () => { note({ type: 'sine', freq: 300, dur: 0.34, gain: 0.3 });
                    note({ type: 'sine', freq: 214, dur: 0.5, delay: 0.16, gain: 0.28 }); },

  /* Handling the sketchy message: pick it up, it flies, the mailbox takes it.
     The landing is the most satisfying sound in the game, because posting it to
     a grown-up is the thing we want the child to want to do. */
  pickup:   () => note({ type: 'triangle', freq: [520, 700], dur: 0.1, gain: 0.32 }),
  fly:      () => noise({ dur: 0.26, gain: 0.14, from: 1600, to: 420 }),
  posted:   () => { note({ type: 'triangle', freq: 300, dur: 0.1, gain: 0.4 });
                    note({ type: 'sine', freq: 784, dur: 0.14, delay: 0.06, gain: 0.3 });
                    note({ type: 'sine', freq: 1175, dur: 0.22, delay: 0.13, gain: 0.26 }); },

  /* Right. A rising major triad: unmistakably "yes", warm rather than shrill. */
  correct:  () => { note({ type: 'sine', freq: 523, dur: 0.12, gain: 0.34 });
                    note({ type: 'sine', freq: 659, dur: 0.12, delay: 0.09, gain: 0.32 });
                    note({ type: 'sine', freq: 784, dur: 0.26, delay: 0.18, gain: 0.3 }); },

  /* Wrong. A gentle two-note dip, and nothing more. It says "not that one, keep
     going", never "you failed". No buzzer will ever go in this game. */
  wrong:    () => { note({ type: 'sine', freq: 400, dur: 0.13, gain: 0.26 });
                    note({ type: 'sine', freq: 330, dur: 0.2, delay: 0.1, gain: 0.24 }); },

  /* A star is earned. */
  star:     () => { note({ type: 'sine', freq: 1046, dur: 0.1, gain: 0.28 });
                    note({ type: 'sine', freq: 1568, dur: 0.18, delay: 0.07, gain: 0.24 }); },

  /* The mission is done. The only fanfare in the game, so it stays special. */
  complete: () => { [523, 659, 784, 1046].forEach((f, i) =>
                      note({ type: 'sine', freq: f, dur: 0.3, delay: i * 0.11, gain: 0.32 }));
                    note({ type: 'triangle', freq: 1568, dur: 0.5, delay: 0.46, gain: 0.24 }); },
};

export function createSfx() {
  return {
    /** Wake the audio engine on the child's first touch, as browsers require. */
    unlock() {
      const c = engine();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },

    play(name) {
      const sound = SOUNDS[name];
      if (sound && enabled) {
        try { sound(); } catch { /* audio must never break the game */ }
      }
    },

    setEnabled(on) { enabled = Boolean(on); },
  };
}
