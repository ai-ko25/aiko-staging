/* progress.js — the memory of what a child has done.
 *
 * The only file that touches the player's saved history. It records which
 * missions have been completed (and whether they were nailed first try) in the
 * browser's localStorage — the same place the language choice already lives.
 *
 * This is deliberately separate from the "coming soon" locks in world.json.
 * Those locks are about what CONTENT exists (same for everyone). This file is
 * about what THIS child has played. Two different ideas, two different homes.
 */

const STORAGE_KEY = 'aiko.progress';

/** Read the whole progress record: { missionId: { done, firstTry }, ... }. */
function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    /* Blocked storage or corrupt data — start from a clean slate rather than
       crash. Losing progress is a small price; crashing the game is not. */
    return {};
  }
}

function writeAll(record) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* ignore — the game still plays, it just won't remember next time. */
  }
}

/** Has this mission been completed at all? */
export function isMissionDone(missionId) {
  return readAll()[missionId]?.done === true;
}

/**
 * Record that a mission was completed. `firstTry` is whether the child picked
 * the safe answer on their first guess. Once earned, a first-try win is never
 * downgraded by a later replay.
 */
export function markMissionDone(missionId, firstTry) {
  const record = readAll();
  const existing = record[missionId] ?? {};
  record[missionId] = {
    done: true,
    firstTry: existing.firstTry === true || firstTry === true,
  };
  writeAll(record);
}

/**
 * Given the ids of the missions in a topic, how many are done?
 * Returns { done, total } for showing "2 of 3 done" on a topic card.
 */
export function topicProgress(missionIds) {
  const record = readAll();
  const done = missionIds.filter((id) => record[id]?.done === true).length;
  return { done, total: missionIds.length };
}

/** Wipe all progress (used by a future "start over" button). */
export function resetProgress() {
  writeAll({});
}
