/* ui.js — the stage crew.
 *
 * Takes what main.js and the engine say is true and paints it onto the page. It
 * decides nothing — it doesn't know what a correct answer is, only that it was
 * told to light a piece of the message gold. Every change to the page happens
 * here. It never builds a URL and never reads a data file: it calls the
 * handlers main.js gives it, and draws whatever it's handed.
 */

const el = (id) => document.getElementById(id);

/* Which sprite Aiko wears for each mood. Presentation assets, not mission
   content, so they live with the drawing code — the engine never sees them. */
const AIKO_SPRITE = {
  idle:  'assets/aiko/idle.png',
  safe:  'assets/aiko/safe.png',
  risky: 'assets/aiko/risky.png',
};

function setAiko(mood) {
  const img = el('aiko-img');
  const figure = el('aiko-figure');
  if (!img || !figure) return;
  img.src = AIKO_SPRITE[mood] ?? AIKO_SPRITE.idle;
  figure.classList.toggle('is-safe', mood === 'safe');
  figure.classList.toggle('is-risky', mood === 'risky');
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
   fades). They are all registered here so a new render can cancel the lot —
   otherwise a leftover timer from the previous mission could redraw stale
   content on top of the new one. */
let sceneTimers = [];
function later(fn, ms) { sceneTimers.push(setTimeout(fn, ms)); }
function clearSceneTimers() { sceneTimers.forEach(clearTimeout); sceneTimers = []; }

function aikoSay(text) {
  const bubble = el('aiko-bubble');
  el('aiko-bubble-text').textContent = text ?? '';
  bubble.classList.toggle('show', Boolean(text));
}

/**
 * @param {Function} t         translator from i18n.js
 * @param {Object}   handlers  what to call when the child clicks something
 */
export function createUI(t, handlers) {
  /* Persistent buttons — these exist for the whole session. */
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

  /* Delegated clicks — cards, message pieces, and choice cards are rebuilt
     often, so we listen on the containers that stay put. */
  el('region-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.disabled) handlers.onRegion(card.dataset.regionId);
  });
  el('topic-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.disabled) handlers.onTopic(card.dataset.topicId);
  });
  el('mission-list').addEventListener('click', (e) => {
    const row = e.target.closest('.mission-row');
    if (row) handlers.onMission(row.dataset.missionId);
  });
  el('message-text').addEventListener('click', (e) => {
    const piece = e.target.closest('.msg-piece');
    if (piece && !piece.disabled) handlers.onSpot(Number(piece.dataset.pieceIndex));
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
      SCREENS.forEach((key) => { el(`${key}-screen`).hidden = key !== name; });
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

    /* ---------------- 2. World map ---------------- */
    renderWorld(regions) {
      this.hideScore();
      const grid = el('region-grid');
      grid.replaceChildren(...regions.map((region) => {
        const locked = region.status !== 'available';
        const card = make('button', `card${locked ? ' is-locked' : ''}`);
        card.type = 'button';
        card.dataset.regionId = region.id;
        card.disabled = locked;
        if (region.accent) card.style.setProperty('--card-accent', `var(${region.accent})`);

        card.append(make('span', 'card-title', region.name));
        if (region.tagline) card.append(make('span', 'card-desc', region.tagline));
        if (locked) card.append(make('span', 'badge badge-soon', t('comingSoon')));
        return card;
      }));
      this.show('world');
    },

    /* ---------------- 3. Region ---------------- */
    renderRegion(region, statsFor) {
      this.hideScore();
      el('region-title').textContent = region.name;
      el('region-tagline').textContent = region.tagline ?? '';

      const grid = el('topic-grid');
      grid.replaceChildren(...(region.topics ?? []).map((topic) => {
        const locked = topic.status !== 'available';
        const card = make('button', `card${locked ? ' is-locked' : ''}`);
        card.type = 'button';
        card.dataset.topicId = topic.id;
        card.disabled = locked;
        if (region.accent) card.style.setProperty('--card-accent', `var(${region.accent})`);

        card.append(make('span', 'card-title', topic.name));
        if (topic.description) card.append(make('span', 'card-desc', topic.description));

        if (locked) {
          card.append(make('span', 'badge badge-soon', t('comingSoon')));
        } else {
          const stats = statsFor(topic);   // { done, total }
          if (stats) {
            card.append(make('span', 'badge badge-progress',
              t('missionsDone', { done: stats.done, total: stats.total })));
          }
        }
        return card;
      }));
      this.show('region');
    },

    /* ---------------- 4. Topic ---------------- */
    renderTopic(topic, missions, isDone) {
      this.hideScore();
      el('topic-title').textContent = topic.name;
      el('topic-desc').textContent = topic.description ?? '';

      const list = el('mission-list');
      list.replaceChildren(...missions.map((mission, i) => {
        const done = isDone(mission.id);
        const row = make('button', `mission-row${done ? ' is-done' : ''}`);
        row.type = 'button';
        row.dataset.missionId = mission.id;

        row.append(make('span', 'mission-row-num', String(i + 1)));
        row.append(make('span', 'mission-row-title', mission.title ?? mission.id));
        if (done) row.append(make('span', 'mission-row-tick', '✓'));
        return row;
      }));
      this.show('topic');
    },

    /* ---------------- 5a. Mission — the scene plays (SPOT) ---------------- */
    renderMissionScene(mission, missionNumber, total, stars) {
      clearSceneTimers();

      el('scene-setting').textContent = mission.setting ?? mission.title ?? '';
      el('sender-label').textContent = mission.sender ?? '';
      this.setStars(stars);
      this.setProgress(0.12);   // a little filled at the start of the mission

      /* Build the message from tappable pieces (buttons, so keyboards and
         screen readers can reach them too). */
      el('message-text').replaceChildren(...(mission.message ?? []).map((piece, i) => {
        const btn = make('button', 'msg-piece', piece.text);
        btn.type = 'button';
        btn.dataset.pieceIndex = String(i);
        return btn;
      }));

      /* Everything starts hidden and calm… */
      el('stranger-bubble').classList.remove('show');
      el('stranger').classList.remove('in');
      aikoSay('');
      setAiko('idle');
      const dock = el('dock');
      dock.classList.remove('up');
      el('choices').replaceChildren();
      this.hideKeepGoing();
      el('feedback').hidden = true;
      el('takeaway').hidden = true;

      this.show('mission');

      /* …then the moment plays: the stranger walks in, their message arrives,
         Aiko wonders about it, and the hint dock slides up. */
      later(() => el('stranger').classList.add('in'), 300);
      later(() => el('stranger-bubble').classList.add('show'), 600);
      later(() => aikoSay(mission.spot?.prompt ?? t('spotPrompt')), 1200);
      later(() => {
        el('dock-hint').textContent = t('spotHint');
        dock.classList.add('up');
      }, 1600);
    },

    /**
     * The child tapped a message piece. `say` is Aiko's response (computed by
     * main.js from the piece); `promptText` is what her bubble returns to after
     * a miss, so the goal is never lost. `canProceed` is true once every flag
     * has been found.
     */
    showSpotResult(index, flag, say, promptText, canProceed) {
      const btn = el('message-text').querySelector(`[data-piece-index="${index}"]`);
      if (btn) btn.disabled = true;

      if (flag) {
        if (btn) btn.classList.add('found');
        setAiko('safe');
        aikoSay(say);

        if (canProceed) {
          /* Every flag found. Lock the rest of the message so the celebration
             isn't interrupted, hold Aiko's cheer and her "found" line on
             screen, and after a few seconds offer a friendly Keep going — the
             child sets the pace and gets to enjoy the win. No auto-advance. */
          this.setProgress(0.55);
          el('message-text').querySelectorAll('.msg-piece').forEach((p) => { p.disabled = true; });
          later(() => this.showKeepGoing(), 3000);
        }
      } else {
        setAiko('risky');
        aikoSay(say);
        /* Gentle nudge over — back to the hunt. */
        later(() => { setAiko('idle'); aikoSay(promptText); }, 2100);
      }
    },

    /** Reveal the "Keep going" button that moves Spot → Decide. */
    showKeepGoing() {
      const btn = el('spot-continue');
      btn.hidden = false;
      btn.classList.add('show');
      btn.focus();
    },
    hideKeepGoing() {
      const btn = el('spot-continue');
      btn.hidden = true;
      btn.classList.remove('show');
    },

    /* ---------------- 5b. Mission — DECIDE ---------------- */
    renderDecide(mission) {
      clearSceneTimers();
      setAiko('idle');
      aikoSay('');
      this.hideKeepGoing();

      el('dock-hint').textContent = mission.decide?.prompt ?? '';
      el('choices').replaceChildren(...(mission.decide?.choices ?? []).map((choice) => {
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

    /* ---------------- 5c. Mission — REACT (after a Decide guess) ---------------- */
    showAnswer(mission, choice, correct, isLastMission) {
      const picked = el('choices').querySelector(`[data-choice-id="${choice.id}"]`);

      if (correct) {
        if (picked) picked.classList.add('safe-pick');
        el('choices').querySelectorAll('.choice-card').forEach((card) => {
          card.disabled = true;
          if (card !== picked) card.classList.add('dim');
        });

        setAiko('safe');
        aikoSay(choice.feedback ?? '');
        this.setProgress(1);   // mission solved — bar full

        if (mission.react?.takeaway) {
          el('takeaway-text').textContent = mission.react.takeaway;
          el('takeaway').hidden = false;
        }
        const next = el('next-btn');
        next.textContent = isLastMission ? t('finish') : t('next');
        el('feedback').hidden = false;
        next.focus();
      } else {
        /* A tempting wrong pick: brief warm ring, then it dims and locks.
           Aiko explains why and invites another try. */
        if (picked) {
          picked.disabled = true;
          picked.classList.add('risk-pick');
          later(() => { picked.classList.remove('risk-pick'); picked.classList.add('dim'); }, 950);
        }
        setAiko('risky');
        aikoSay(`${choice.feedback ?? ''} ${t('tryAgain')}`.trim());
      }
    },

    /* ---------------- Topic complete: the big celebration ---------------- */
    showComplete(score, total, parentNoteText) {
      this.setScore(score);

      el('star-row').replaceChildren(...Array.from({ length: total }, (_, i) => {
        const star = make('span', `s${i < score ? ' on' : ''}`, '⭐');
        star.style.animationDelay = `${i * 0.16}s`;
        return star;
      }));

      el('final-score').textContent = t('finalScore', { score, total });
      el('parent-note-text').textContent = parentNoteText ?? '';

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
