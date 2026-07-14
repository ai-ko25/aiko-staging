/* main.js, the conductor.
 *
 * Runs once on load. It works out the language, loads the world map, and then
 * listens to the address bar: whenever the position changes (a click, the Back
 * button, a shared link), it draws the matching screen, loading a topic's
 * missions the first time that topic is opened. It is the only file that knows
 * about all the others, and it holds no content of its own.
 */

import { getLang, setLang, otherLang, loadStrings, applyDocumentLanguage, createTranslator } from './i18n.js';
import { loadWorld, loadTopicMissions, checkContent } from './content.js';
import { isMissionDone, markMissionDone, topicProgress } from './progress.js';
import { GameEngine } from './engine.js';
import { createUI } from './ui.js';
import { navigate, onRouteChange, parseHash } from './router.js';

const state = {
  lang: 'en',
  t: null,
  regions: [],
  ui: null,
  missionsByTopic: new Map(),   // topic.id → missions array (loaded once)
  engine: null,
  currentTopicId: null,
  route: { screen: 'open' },
  renderToken: 0,               // guards against slow loads finishing out of order
};

async function start() {
  state.lang = getLang();

  /* Background only: prints console warnings if the languages drift apart. */
  checkContent();

  let strings;
  let world;
  try {
    [strings, world] = await Promise.all([loadStrings(state.lang), loadWorld(state.lang)]);
  } catch (error) {
    console.error('[Aiko]', error);
    fallbackErrorScreen();
    return;
  }

  applyDocumentLanguage(strings);
  const t = createTranslator(strings);
  state.t = t;
  state.regions = world.regions;

  state.ui = createUI(t, handlers);
  state.ui.applyStaticText(strings.langToggle);

  /* Draw the current position now, and again on every hash change. */
  onRouteChange(render);
}

/* ------------------------------------------------------------------ *
 *  Looking things up in the world data
 * ------------------------------------------------------------------ */

const findRegion = (id) => state.regions.find((r) => r.id === id) ?? null;
const findTopic = (region, id) => (region?.topics ?? []).find((t) => t.id === id) ?? null;

/** Load a topic's missions once, then serve them from memory. */
async function missionsFor(topic) {
  if (!state.missionsByTopic.has(topic.id)) {
    const missions = await loadTopicMissions(topic.missions, state.lang);
    state.missionsByTopic.set(topic.id, missions);
  }
  return state.missionsByTopic.get(topic.id);
}

/** Resolve a region+topic route into real data, or null if it isn't playable. */
async function resolveTopic(regionId, topicId) {
  const region = findRegion(regionId);
  const topic = findTopic(region, topicId);
  if (!region || !topic || topic.status !== 'available') return null;
  const missions = await missionsFor(topic);
  return { region, topic, missions };
}

/** Reuse one engine per topic; make a fresh one when the topic changes. The
    engine only ever sees playable missions, never the coming-soon slots, so
    "last mission" and the Mission complete flow stay correct. */
function engineFor(topicId, missions) {
  if (!state.engine || state.currentTopicId !== topicId) {
    state.engine = new GameEngine(missions.filter((m) => m.status !== 'coming-soon'));
    state.currentTopicId = topicId;
  }
  return state.engine;
}

/* ------------------------------------------------------------------ *
 *  Drawing whichever screen the route points at
 * ------------------------------------------------------------------ */

async function render(route) {
  state.route = route;
  const token = ++state.renderToken;
  const fresh = () => token === state.renderToken;   // still the newest render?

  try {
    switch (route.screen) {
      case 'open':
        return state.ui.renderOpen();

      case 'world':
        return state.ui.renderWorld(state.regions);

      case 'region': {
        const region = findRegion(route.regionId);
        if (!region || region.status !== 'available') return navigate({ screen: 'world' });

        /* Load the available topics so their cards can show "2 / 3 done". */
        const available = (region.topics ?? []).filter((tp) => tp.status === 'available');
        const loaded = await Promise.all(available.map((tp) => missionsFor(tp)));
        if (!fresh()) return;

        /* Count only the playable missions, not the coming-soon slots. */
        const stats = {};
        available.forEach((tp, i) => {
          const playable = loaded[i].filter((m) => m.status !== 'coming-soon').map((m) => m.id);
          stats[tp.id] = topicProgress(playable);
        });
        return state.ui.renderRegion(region, (topic) => stats[topic.id] ?? null);
      }

      case 'topic': {
        const ctx = await resolveTopic(route.regionId, route.topicId);
        if (!fresh()) return;
        if (!ctx) return navigate({ screen: 'region', regionId: route.regionId });

        engineFor(ctx.topic.id, ctx.missions);
        return state.ui.renderTopic(ctx.topic, ctx.missions, isMissionDone);
      }

      case 'mission': {
        const ctx = await resolveTopic(route.regionId, route.topicId);
        if (!fresh()) return;
        if (!ctx) return navigate({ screen: 'region', regionId: route.regionId });

        /* A coming-soon mission slot has no content, so it never opens (a direct
           link falls back to the mission list). */
        const target = ctx.missions.find((m) => m.id === route.missionId);
        if (!target || target.status === 'coming-soon') {
          return navigate({ screen: 'topic', regionId: route.regionId, topicId: route.topicId });
        }

        const engine = engineFor(ctx.topic.id, ctx.missions);
        if (!engine.goTo(route.missionId)) {
          return navigate({ screen: 'topic', regionId: route.regionId, topicId: route.topicId });
        }
        state.ui.hideScore();   // the scene HUD shows the stars during a mission
        showCurrentMessage(engine);
        return;
      }

      case 'complete': {
        const ctx = await resolveTopic(route.regionId, route.topicId);
        if (!fresh()) return;
        if (!ctx) return navigate({ screen: 'region', regionId: route.regionId });

        const engine = engineFor(ctx.topic.id, ctx.missions);
        const stats = engine.stats;
        return state.ui.showComplete(stats.stars, stats.totalMessages, parentNote(engine.currentMission(), stats));
      }

      default:
        return state.ui.renderOpen();
    }
  } catch (error) {
    console.error('[Aiko]', error);
    if (fresh()) state.ui.showError();
  }
}

/* Navigate, and if the hash didn't actually change, redraw by hand. */
function go(route) {
  if (!navigate(route)) render(route);
}

/* Draw the engine's current message into the scene. Used when a mission opens
   and each time the next message in the conversation arrives. */
function showCurrentMessage(engine) {
  state.ui.renderMissionScene(
    engine.currentMission(), engine.currentMessage(),
    engine.messageNumber, engine.messageTotal, engine.score);

  /* A message with no flags (data mistake, validation already warned) should
     not strand the child in Spot forever. */
  if (engine.canProceedFromSpot) state.ui.showKeepGoing();
}

/* The "For grown-ups" line on the topic-complete screen: a perfect run lists
   every red-flag pattern covered; otherwise it suggests one conversation,
   taken from the first message that needed a rethink. */
function parentNote(mission, stats) {
  const messages = mission?.messages ?? [];
  const t = state.t;

  if (stats.slips === 0) {
    const topics = messages
      .map((m) => m.parentTag)
      .filter(Boolean)
      .join(t('listJoin'));
    return t('parentNotePerfect', { flags: stats.totalFlags, topics });
  }

  const firstSlipped = messages[stats.slippedIndexes[0]];
  return t('parentNoteRethink', {
    count: stats.slips,
    topic: firstSlipped?.parentTag ?? mission?.title ?? '',
  });
}

/* ------------------------------------------------------------------ *
 *  What each click does
 * ------------------------------------------------------------------ */

const handlers = {
  onHome:        () => go({ screen: 'world' }),
  onEnter:       () => go({ screen: 'world' }),
  onLangToggle:  () => setLang(otherLang(state.lang)),   // reloads, keeps your place

  onRegion:  (regionId) => go({ screen: 'region', regionId }),
  onTopic:   (topicId)  => go({ screen: 'topic', regionId: state.route.regionId, topicId }),
  onMission: (missionId) => go({
    screen: 'mission', regionId: state.route.regionId, topicId: state.route.topicId, missionId,
  }),

  onExitRegion:  () => go({ screen: 'world' }),
  onExitTopic:   () => go({ screen: 'region', regionId: state.route.regionId }),
  onExitMission: () => go({ screen: 'topic', regionId: state.route.regionId, topicId: state.route.topicId }),
  onExitComplete:() => go({ screen: 'topic', regionId: state.route.regionId, topicId: state.route.topicId }),

  /* SPOT beat: the child taps a part of the message. Aiko's line comes from the
     part itself, its "found" for a flag, its "hint" (or the message's fallback)
     for a harmless part. */
  onSpot: (partIndex) => {
    const result = state.engine.revealSpot(partIndex);
    if (!result) return;

    const message = state.engine.currentMessage();
    const say = result.flag
      ? (result.part.found ?? '')
      : (result.part.hint ?? message.spot?.missHint ?? '');

    state.ui.showSpotResult(result.index, result.flag, say, result.canProceed);
  },

  /* Every flag in this message is found: the child taps "Keep going". */
  onSpotContinue: () => {
    if (!state.engine || state.engine.beat !== 'spot') return;
    state.engine.toDecide();
    state.ui.renderDecide(state.engine.currentMessage());
  },

  /* DECIDE beat + REACT. The mission is marked done when the last message is
     solved; the closing takeaway shows only then. */
  onDecide: (choiceId) => {
    const engine = state.engine;
    const result = engine.answerDecide(choiceId);
    if (!result) return;

    const lastMessage = engine.isLastMessage;
    if (result.correct && lastMessage) {
      markMissionDone(engine.currentMission().id, engine.stats.slips === 0);
    }
    const takeaway = (result.correct && lastMessage) ? engine.currentMission().react?.takeaway : null;
    state.ui.showAnswer(result.choice, result.correct, lastMessage, takeaway);
    state.ui.setStars(engine.score);
  },

  /* Continue: the next message in the conversation, or the topic-complete
     screen once the whole mission is solved. */
  onNext: () => {
    const engine = state.engine;
    if (engine.nextMessage()) {
      showCurrentMessage(engine);
    } else if (engine.isLastMission) {
      go({ screen: 'complete', regionId: state.route.regionId, topicId: state.route.topicId });
    } else {
      engine.next();
      handlers.onMission(engine.currentMission().id);
    }
  },

  onReplay: () => {
    state.engine.reset();
    handlers.onMission(state.engine.currentMission().id);
  },
};

/* If even the strings file failed to load we have no translations, so the
   English markup already in index.html stands in. */
function fallbackErrorScreen() {
  document.getElementById('loading-screen').hidden = true;
  document.getElementById('error-screen').hidden = false;
}

start();
