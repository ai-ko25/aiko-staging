/* content.js — the librarian.
 *
 * The only file that reads JSON. It fetches two kinds of file and checks each
 * one makes sense before handing it on:
 *
 *   • the world map      → loadWorld(lang)                 (data/world.<lang>.json)
 *   • a topic's missions → loadTopicMissions(topicId, lang) (data/missions/<topic>.<lang>.json)
 *
 * If the content ever moves to a database or a CMS, this is the one file that
 * changes. checkContent() runs quietly in the background and prints console
 * warnings when the languages have drifted apart.
 */

import { SUPPORTED_LANGS } from './i18n.js';

const STATUSES = ['available', 'coming-soon'];

/* ------------------------------------------------------------------ *
 *  Loading
 * ------------------------------------------------------------------ */

/** Fetch and check the world map for one language. Returns the world object. */
export async function loadWorld(lang) {
  const path = `data/world.${lang}.json`;
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status})`);
  }

  const data = await response.json();
  validateWorld(data, path);
  return data.world;
}

/** Fetch and check one topic's missions. Returns the missions array. */
export async function loadTopicMissions(topicId, lang) {
  const path = `data/missions/${topicId}.${lang}.json`;
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status})`);
  }

  const data = await response.json();
  validateMissions(data, path);
  return data.missions;
}

/* ------------------------------------------------------------------ *
 *  Validation — throws on problems that would break the game, warns on
 *  problems that are probably mistakes but still playable.
 * ------------------------------------------------------------------ */

function validateWorld(data, path) {
  const world = data.world;
  if (!world || !Array.isArray(world.regions) || world.regions.length === 0) {
    throw new Error(`${path}: expected "world.regions" to be a non-empty array.`);
  }

  world.regions.forEach((region, i) => {
    const where = `${path}: region ${i + 1}`;
    if (!region.id) throw new Error(`${where} has no "id".`);
    if (!region.name) throw new Error(`${where} ("${region.id}") has no "name".`);
    if (!STATUSES.includes(region.status)) {
      throw new Error(`${where} ("${region.id}") needs "status" of ${STATUSES.join(' or ')}.`);
    }

    (region.topics ?? []).forEach((topic, j) => {
      const tw = `${where} ("${region.id}"), topic ${j + 1}`;
      if (!topic.id) throw new Error(`${tw} has no "id".`);
      if (!topic.name) throw new Error(`${tw} ("${topic.id}") has no "name".`);
      if (!STATUSES.includes(topic.status)) {
        throw new Error(`${tw} ("${topic.id}") needs "status" of ${STATUSES.join(' or ')}.`);
      }
      /* An available topic must point at a mission file, or the child would
         tap it and reach a dead end. */
      if (topic.status === 'available' && !topic.missions) {
        throw new Error(`${tw} ("${topic.id}") is available but has no "missions" file reference.`);
      }
    });
  });

  warnDuplicates(world.regions.map((r) => r.id), `${path}: region ids`);
}

function validateMissions(data, path) {
  if (!Array.isArray(data.missions) || data.missions.length === 0) {
    throw new Error(`${path}: expected a non-empty "missions" array.`);
  }

  data.missions.forEach((mission, i) => {
    const where = `${path}: mission ${i + 1}`;
    if (!mission.id) throw new Error(`${where} has no "id".`);

    validateMessage(mission, where);
    validateDecide(mission, where);

    /* Aiko's opening line for the Spot beat. Playable without it (there is a
       generic fallback in strings), but a mission reads better with its own. */
    if (!mission.spot || !mission.spot.prompt) {
      console.warn(`[Aiko] ${where} ("${mission.id}") has no spot.prompt.`);
    }

    /* react.takeaway is the teaching line. Not fatal if missing, but flag it. */
    if (!mission.react || !mission.react.takeaway) {
      console.warn(`[Aiko] ${where} ("${mission.id}") has no react.takeaway.`);
    }
  });

  warnDuplicates(data.missions.map((m) => m.id), `${path}: mission ids`);
}

/* The scene IS the message: an array of pieces the child can tap. Pieces
   marked "flag": true are the red flags to find. */
function validateMessage(mission, where) {
  if (!Array.isArray(mission.message) || mission.message.length === 0) {
    throw new Error(`${where} ("${mission.id}") needs a non-empty "message" array.`);
  }
  mission.message.forEach((piece, k) => {
    if (!piece.text) throw new Error(`${where} ("${mission.id}"), message piece ${k + 1} has no "text".`);
    /* A flag with no "found" line means Aiko has nothing to say when the child
       finds it — the moment falls flat. */
    if (piece.flag === true && !piece.found) {
      console.warn(`[Aiko] ${where} ("${mission.id}") message piece ${k + 1} is a flag with no "found" line.`);
    }
  });
  if (!mission.message.some((p) => p.flag === true)) {
    console.warn(`[Aiko] ${where} ("${mission.id}") message has no piece marked "flag": true.`);
  }
}

function validateDecide(mission, where) {
  const decide = mission.decide;
  if (!decide || !Array.isArray(decide.choices) || decide.choices.length < 2) {
    throw new Error(`${where} ("${mission.id}") needs "decide.choices" with at least two choices.`);
  }
  decide.choices.forEach((c, k) => {
    if (!c.id) throw new Error(`${where} ("${mission.id}"), decide choice ${k + 1} has no "id".`);
    if (!c.text) throw new Error(`${where} ("${mission.id}"), decide choice "${c.id}" has no "text".`);
  });
  if (decide.choices.filter((c) => c.correct === true).length !== 1) {
    console.warn(`[Aiko] ${where} ("${mission.id}") decide should have exactly one "correct": true choice.`);
  }
}

function warnDuplicates(ids, label) {
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    console.warn(`[Aiko] ${label} has repeats: ${[...new Set(dupes)].join(', ')}`);
  }
}

/* ------------------------------------------------------------------ *
 *  Cross-language parity — a development aid, never blocks the game.
 *  Open the console and you learn the day English and Arabic drift apart,
 *  instead of a month later.
 * ------------------------------------------------------------------ */

export async function checkContent() {
  try {
    const worlds = await Promise.all(
      SUPPORTED_LANGS.map(async (lang) => ({ lang, world: await fetchJson(`data/world.${lang}.json`) }))
    );

    const [ref, ...others] = worlds;
    const refRegionIds = regionIds(ref.world);

    for (const other of others) {
      compareIdLists(refRegionIds, regionIds(other.world),
        `regions`, ref.lang, other.lang, 'world');

      /* Topic ids and statuses, region by region. */
      for (const region of ref.world.world.regions) {
        const otherRegion = other.world.world.regions.find((r) => r.id === region.id);
        if (!otherRegion) continue;
        compareIdLists(topicIds(region), topicIds(otherRegion),
          `topics in region "${region.id}"`, ref.lang, other.lang, 'world');
      }
    }

    /* Every available topic's mission file, across languages, plus a global
       check that no mission id is used in two different topics. */
    const availableTopics = ref.world.world.regions
      .flatMap((r) => r.topics ?? [])
      .filter((t) => t.status === 'available');

    const globalMissionIds = [];

    for (const topic of availableTopics) {
      const perLang = await Promise.all(
        SUPPORTED_LANGS.map(async (lang) => ({
          lang,
          missions: (await fetchJson(`data/missions/${topic.missions}.${lang}.json`)).missions ?? [],
        }))
      );

      const [refM, ...otherM] = perLang;
      globalMissionIds.push(...refM.missions.map((m) => m.id));

      for (const om of otherM) {
        compareIdLists(refM.missions.map((m) => m.id), om.missions.map((m) => m.id),
          `missions in topic "${topic.id}"`, refM.lang, om.lang, topic.missions);

        for (const mission of refM.missions) {
          const twin = om.missions.find((m) => m.id === mission.id);
          if (!twin) continue;

          /* Message pieces have no ids — they line up by position. A different
             piece count or different flag positions means the two languages
             would play differently (e.g. a flag findable in English but not
             in Arabic). */
          const refFlags = flagPositions(mission.message);
          const twinFlags = flagPositions(twin.message);
          if (refFlags !== twinFlags) {
            console.warn(
              `[Aiko] ${topic.missions}: mission "${mission.id}" message flags differ — ` +
              `${refM.lang} [${refFlags}] vs ${om.lang} [${twinFlags}].`
            );
          }

          compareIdLists(sortedIds(mission.decide?.choices), sortedIds(twin.decide?.choices),
            `decide choices in "${mission.id}"`, refM.lang, om.lang, topic.missions);
        }
      }
    }

    warnDuplicates(globalMissionIds, 'mission ids across all topics');
  } catch {
    /* Missing a language file is not fatal to play; the console just stays quiet. */
  }
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path);
  return response.json();
}

const regionIds = (worldFile) => worldFile.world.regions.map((r) => r.id);
const topicIds = (region) => (region.topics ?? []).map((t) => t.id);
const sortedIds = (list) => (list ?? []).map((x) => x.id).sort();

/* "0:plain, 1:FLAG, 2:plain" — a positional fingerprint of a message. */
const flagPositions = (message) =>
  (message ?? []).map((p, i) => (p.flag === true ? `${i}:FLAG` : `${i}:plain`)).join(', ');

function compareIdLists(refIds, otherIds, label, refLang, otherLang, file) {
  const missing = refIds.filter((id) => !otherIds.includes(id));
  const extra = otherIds.filter((id) => !refIds.includes(id));
  if (missing.length) {
    console.warn(`[Aiko] ${file}.${otherLang}: ${label} missing vs ${refLang}: ${missing.join(', ')}`);
  }
  if (extra.length) {
    console.warn(`[Aiko] ${file}.${otherLang}: ${label} not in ${refLang}: ${extra.join(', ')}`);
  }
}
