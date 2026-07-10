/* engine.js — the rulebook.
 *
 * Runs one topic's missions. For each mission it tracks the two interactive
 * beats — SPOT (tap every red flag hiding in the message) then DECIDE (pick the
 * safe response) — plus the score and the "rethink" count that feeds the note
 * for grown-ups. It knows nothing about buttons, bubbles, or images: hand it a
 * list of missions and it answers questions about the game. That keeps game
 * rules out of the drawing code and makes it testable without a browser.
 *
 * The third beat, REACT, is Aiko's teaching moment — it has no decisions of its
 * own, so it lives in the drawing code, not here.
 */

export class GameEngine {
  #missions;
  #index = 0;
  #score = 0;

  #beat = 'spot';              // 'spot' | 'decide'
  #flagsFound = new Set();     // message-piece indexes of flags found this mission
  #decideAttempts = 0;         // guesses made in the DECIDE beat this mission
  #solved = false;             // has the safe answer been found this mission?

  /* Topic-wide, for the grown-ups note: how many wrong Decide guesses in total,
     and which missions needed one. Reset only by reset(). */
  #slips = 0;
  #slippedIds = new Set();

  constructor(missions) {
    if (!Array.isArray(missions) || missions.length === 0) {
      throw new Error('GameEngine needs at least one mission.');
    }
    this.#missions = missions;
  }

  get total() { return this.#missions.length; }
  get score() { return this.#score; }
  get beat() { return this.#beat; }
  get missionNumber() { return this.#index + 1; }   // 1-based, for "Mission 2 of 3"
  get isFinished() { return this.#index >= this.#missions.length; }
  get isLastMission() { return this.#index === this.#missions.length - 1; }
  get isSolved() { return this.#solved; }

  currentMission() {
    return this.#missions[this.#index] ?? null;
  }

  /** Everything the topic-complete screen needs, in one bundle. */
  get stats() {
    return {
      score: this.#score,
      total: this.total,
      slips: this.#slips,
      slippedIds: [...this.#slippedIds],
      totalFlags: this.#missions.reduce(
        (sum, m) => sum + (m.message ?? []).filter((p) => p.flag === true).length, 0),
    };
  }

  /**
   * Jump to a mission by id and start it fresh at the SPOT beat. Used when the
   * player opens a mission link directly or moves to the next one. Returns true
   * if the mission exists.
   */
  goTo(missionId) {
    const index = this.#missions.findIndex((m) => m.id === missionId);
    if (index === -1) return false;
    this.#index = index;
    this.#startMission();
    return true;
  }

  #startMission() {
    this.#beat = 'spot';
    this.#flagsFound = new Set();
    this.#decideAttempts = 0;
    this.#solved = false;
  }

  /* ---------------- SPOT beat: tap the red flags in the message ---------------- */

  #flagIndexes() {
    return (this.currentMission()?.message ?? [])
      .map((piece, i) => (piece.flag === true ? i : -1))
      .filter((i) => i !== -1);
  }

  /** True once every flag in the message has been tapped (or there are none). */
  get canProceedFromSpot() {
    return this.#flagIndexes().every((i) => this.#flagsFound.has(i));
  }

  /**
   * Tap one piece of the message. Returns
   *   { piece, index, flag, alreadyFound, canProceed }
   * or null if the piece doesn't exist / we're not in the SPOT beat.
   * Spotting never scores and never punishes — it trains noticing.
   */
  revealSpot(index) {
    if (this.#beat !== 'spot') return null;
    const piece = (this.currentMission()?.message ?? [])[index];
    if (!piece) return null;

    const flag = piece.flag === true;
    const alreadyFound = flag && this.#flagsFound.has(index);
    if (flag) this.#flagsFound.add(index);

    return { piece, index, flag, alreadyFound, canProceed: this.canProceedFromSpot };
  }

  /** Move from SPOT to DECIDE. */
  toDecide() {
    if (this.#beat === 'spot') this.#beat = 'decide';
  }

  /* ---------------- DECIDE beat ---------------- */

  /**
   * Take a guess in the DECIDE beat. A point is scored only for getting it right
   * the first time — but a wrong guess doesn't end the mission; the child reads
   * why and tries again. Wrong guesses are counted as "rethink moments" for the
   * grown-ups note, never announced to the child.
   *
   * Returns { choice, correct, scored }, or null if there's nothing to answer.
   */
  answerDecide(choiceId) {
    if (this.#beat !== 'decide' || this.#solved) return null;

    const choice = (this.currentMission()?.decide?.choices ?? []).find((c) => c.id === choiceId);
    if (!choice) return null;

    this.#decideAttempts += 1;
    const correct = choice.correct === true;
    let scored = false;

    if (correct) {
      this.#solved = true;
      if (this.#decideAttempts === 1) {
        this.#score += 1;
        scored = true;
      }
    } else {
      this.#slips += 1;
      this.#slippedIds.add(this.currentMission().id);
    }

    return { choice, correct, scored };
  }

  /* ---------------- Between missions ---------------- */

  /** Advance to the next mission (fresh at SPOT). Returns false when the topic is done. */
  next() {
    if (this.isFinished) return false;
    this.#index += 1;
    if (this.isFinished) return false;
    this.#startMission();
    return true;
  }

  /** Back to the first mission with a fresh score and a clean slate of slips. */
  reset() {
    this.#index = 0;
    this.#score = 0;
    this.#slips = 0;
    this.#slippedIds = new Set();
    this.#startMission();
  }
}
