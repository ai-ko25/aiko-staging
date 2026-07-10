/* ui.js, the stage crew.
 *
 * Takes what main.js and the engine say is true and paints it onto the page. It
 * decides nothing, it doesn't know what a correct answer is, only that it was
 * told to light a piece of the message gold. Every change to the page happens
 * here. It never builds a URL and never reads a data file: it calls the
 * handlers main.js gives it, and draws whatever it's handed.
 */

const el = (id) => document.getElementById(id);

/* Which sprite Aiko wears for each mood. Presentation assets, not mission
   content, so they live with the drawing code, the engine never sees them. */
const AIKO_SPRITE = {
  idle:  'assets/aiko/idle.png',
  safe:  'assets/aiko/safe.png',
  risky: 'assets/aiko/risky.png',
};

/* Swap Aiko's image and toggle the runner's cheer / worried classes, which
   tune her glow and give her a little pop or wobble as she reacts. */
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
}

/**
 * @param {Function} t         translator from i18n.js
 * @param {Object}   handlers  what to call when the child clicks something
 */
export function createUI(t, handlers) {
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
     * Aiko's opening question sits in the dock hint; her bubble is kept for her
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

      /* Build the message from tappable parts (buttons, so keyboards and screen
         readers can reach them too). */
      el('message-text').replaceChildren(...(message.parts ?? []).map((part, i) => {
        const btn = make('button', 'msg-piece', part.text);
        btn.type = 'button';
        btn.dataset.pieceIndex = String(i);
        return btn;
      }));

      /* Everything starts hidden and calm. */
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

      /* Then the moment plays: the stranger walks in, their message arrives,
         and the dock slides up with Aiko's question and the tap hint. */
      later(() => el('stranger').classList.add('in'), 300);
      later(() => el('stranger-bubble').classList.add('show'), 600);
      later(() => {
        el('dock-hint').textContent = message.spot?.prompt ?? t('spotHint');
        dock.classList.add('up');
      }, 1200);
    },

    /**
     * The child tapped a part of the message. `say` is Aiko's response (from the
     * part); `promptText` is what the dock hint returns to after a miss, so the
     * goal is never lost. `canProceed` is true once every flag has been found.
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
             is not interrupted, hold Aiko's cheer and her found line on screen,
             and after a few seconds offer a friendly Keep going. The child sets
             the pace and gets to enjoy the win. No auto-advance. */
          this.setProgress((sceneN - 0.5) / sceneTotal);
          el('message-text').querySelectorAll('.msg-piece').forEach((p) => { p.disabled = true; });
          later(() => this.showKeepGoing(), 3000);
        }
      } else {
        /* A harmless tap: Aiko's gentle line stays up at least 3 seconds so a
           child can read it, then fades and the question returns. */
        setAiko('risky');
        aikoSay(say);
        later(() => { setAiko('idle'); el('dock-hint').textContent = promptText; aikoSay(''); }, 3200);
      }
    },

    /** Reveal the "Keep going" button that moves this message from Spot to Decide. */
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

    /* ---------------- 5b. Mission, DECIDE ---------------- */
    renderDecide(message) {
      clearSceneTimers();
      setAiko('idle');
      aikoSay('');
      this.hideKeepGoing();

      el('dock-hint').textContent = message.decide?.prompt ?? '';
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
      const picked = el('choices').querySelector(`[data-choice-id="${choice.id}"]`);
      el('stranger-bubble').classList.remove('show');

      if (correct) {
        if (picked) picked.classList.add('safe-pick');
        el('choices').querySelectorAll('.choice-card').forEach((card) => {
          card.disabled = true;
          if (card !== picked) card.classList.add('dim');
        });

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
        aikoSay(`${choice.feedback ?? ''} ${t('tryAgain')}`.trim());
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
