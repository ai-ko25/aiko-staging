/* version.js, one line the whole app hangs its cache off.
 *
 * The data files (strings, world, missions) are fetched at runtime, and neither
 * a local python server nor GitHub Pages tells the browser how long it may keep
 * them. Browsers therefore guess, and a phone will happily keep serving an old
 * strings.ar.json for hours after a deploy: new Arabic labels silently go
 * missing while everything else updates, which looks like a translation bug and
 * is not one.
 *
 * Every fetch carries ?v=BUILD, so changing this one line makes every data file
 * a new address that no cache has ever seen. BUMP IT WHENEVER DATA CHANGES.
 */
export const BUILD = '2026-07-15b';

/** Stamp a data path so a stale cached copy can never be served in its place. */
export const versioned = (path) => `${path}?v=${BUILD}`;
