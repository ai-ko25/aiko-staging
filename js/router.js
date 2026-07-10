/* router.js — where in the world are we?
 *
 * Keeps the child's position in the address bar's "hash" (the part after #), so
 * the browser's Back button works and a link points straight at a place:
 *
 *   #/                                  → the opening greeting
 *   #/world                             → the world map
 *   #/r/people-friends                  → a region
 *   #/r/people-friends/strangers-online → a topic
 *   #/r/people-friends/strangers-online/stranger-dm → one mission
 *   #/r/people-friends/strangers-online/done        → the topic-complete screen
 *
 * The router only reads and writes that text. It knows nothing about regions or
 * missions themselves — main.js looks those up in the data. The language lives
 * in the "?lang=" search part, untouched here, so switching language keeps your
 * place.
 */

/** Turn the current hash into a plain position object. */
export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');   // drop leading "#/"
  const parts = raw.split('/').filter(Boolean);

  if (parts.length === 0) return { screen: 'open' };
  if (parts[0] === 'world') return { screen: 'world' };

  if (parts[0] === 'r') {
    const [, regionId, topicId, fourth] = parts;
    if (!regionId) return { screen: 'world' };
    if (!topicId) return { screen: 'region', regionId };
    if (!fourth) return { screen: 'topic', regionId, topicId };
    if (fourth === 'done') return { screen: 'complete', regionId, topicId };
    return { screen: 'mission', regionId, topicId, missionId: fourth };
  }

  return { screen: 'open' };
}

/** Build the hash text for a position (used to navigate and for links). */
export function hashFor(route) {
  switch (route.screen) {
    case 'world':    return '#/world';
    case 'region':   return `#/r/${route.regionId}`;
    case 'topic':    return `#/r/${route.regionId}/${route.topicId}`;
    case 'mission':  return `#/r/${route.regionId}/${route.topicId}/${route.missionId}`;
    case 'complete': return `#/r/${route.regionId}/${route.topicId}/done`;
    case 'open':
    default:         return '#/';
  }
}

/** Go to a position by changing the hash (this triggers onRouteChange). */
export function navigate(route) {
  const target = hashFor(route);
  if (window.location.hash === target) {
    /* Same place — the hashchange event won't fire, so tell the caller to
       redraw by hand. */
    return false;
  }
  window.location.hash = target;
  return true;
}

/** Run `handler(route)` now and again every time the hash changes. */
export function onRouteChange(handler) {
  window.addEventListener('hashchange', () => handler(parseHash()));
  handler(parseHash());
}
