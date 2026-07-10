/* engine.js, the rulebook.
 *
 * Runs one topic's missions. A mission is now a short conversation: an array of
 * messages, each with its own two beats, SPOT (tap every red flag hiding in the
 * message) then DECIDE (pick the safe reply). The engine walks message by
 * message, tracks the stars (a message solved on the first try) and the
 * "rethink" count that feeds the note for grown-ups. It knows nothing about
 * bubbles, characters, or images: hand it missions and it answers questions
 * about the game. That keeps rules out of the drawing code and testable.
 *
 * REACT (Aiko cheering and teaching) has no decisions of its own, so it lives
 * in the drawing code, not here.
 */

export class GameEngine {
  #missions;
  #index = 0;            // which mission in the topic

  #msgIndex = 0;         // which message inside the current mission
  #beat = 'spot';        // 'spot' | 'decide'
  #flagsFound = new Set(); // part indexes of flags found in this message
  #attempts = 0;         // decide guesses in this message
  #msgSolved = false;

  #stars = 0;            // messages solved on the first try (this mission)
  #slips = 0;            // wrong decide picks in this mission
  #slippedIdx = new Set(); // message indexes that needed a rethink

  constructor(missions) {
    if (!Array.isArray(missions) || missions.length === 0) {
      throw new Error('GameEngine needs at least one mission.');
    }
    this.#missions = missions;
  }

  get missionTotal() { return this.#missions.length; }
  get missionNumber() { return this.#index + 1; }
  get isLastMission() { return this.#index === this.#missions.length - 1; }
  get isFinished() { return this.#index >= this.#missions.length; }

  get beat() { return this.#beat; }
  get score() { return this.#stars; }
  get messageNumber() { return this.#msgIndex + 1; }
  get messageTotal() { return this.currentMission()?.messages?.length ?? 0; }
  get isLastMessage() { return this.#msgIndex === this.messageTotal - 1; }
  get isSolved() { return this.#msgSolved; }

  currentMission() { return this.#missions[this.#index] ?? null; }
  currentMessage() { return this.currentMission()?.messages?.[this.#msgIndex] ?? null; }

  /** Everything the topic-complete screen needs, in one bundle. */
  get stats() {
    const mission = this.currentMission();
    const messages = mission?.messages ?? [];
    return {
      stars: this.#stars,
      totalMessages: messages.length,
      slips: this.#slips,
      slippedIndexes: [...this.#slippedIdx].sort((a, b) => a - b),
      totalFlags: messages.reduce(
        (sum, m) => sum + (m.parts ?? []).filter((p) => p.flag === true).length, 0),
    };
  }

  /** Jump to a mission by id and start it fresh at its first message. */
  goTo(missionId) {
    const index = this.#missions.findIndex((m) => m.id === missionId);
    if (index === -1) return false;
    this.#index = index;
    this.#startMission();
    return true;
  }

  #startMission() {
    this.#msgIndex = 0;
    this.#stars = 0;
    this.#slips = 0;
    this.#slippedIdx = new Set();
    this.#startMessage();
  }

  #startMessage() {
    this.#beat = 'spot';
    this.#flagsFound = new Set();
    this.#attempts = 0;
    this.#msgSolved = false;
  }

  /* ---------------- SPOT beat ---------------- */

  #flagIndexes() {
    return (this.currentMessage()?.parts ?? [])
      .map((part, i) => (part.flag === true ? i : -1))
      .filter((i) => i !== -1);
  }

  /** True once every flag in this message has been tapped (or there are none). */
  get canProceedFromSpot() {
    return this.#flagIndexes().every((i) => this.#flagsFound.has(i));
  }

  /**
   * Tap one part of the message. Returns
   *   { part, index, flag, alreadyFound, canProceed }
   * or null if the part doesn't exist / we're not in the SPOT beat.
   * Spotting never scores and never punishes; it trains noticing.
   */
  revealSpot(index) {
    if (this.#beat !== 'spot') return null;
    const part = (this.currentMessage()?.parts ?? [])[index];
    if (!part) return null;

    const flag = part.flag === true;
    const alreadyFound = flag && this.#flagsFound.has(index);
    if (flag) this.#flagsFound.add(index);

    return { part, index, flag, alreadyFound, canProceed: this.canProceedFromSpot };
  }

  toDecide() {
    if (this.#beat === 'spot') this.#beat = 'decide';
  }

  /* ---------------- DECIDE beat ---------------- */

  /**
   * Take a guess in the DECIDE beat. A star is earned only for getting it right
   * the first time, but a wrong guess doesn't end the message: the child reads
   * why and tries again. Wrong guesses are counted as rethink moments for the
   * grown-ups note, never announced to the child.
   *
   * Returns { choice, correct, scored }, or null if there's nothing to answer.
   */
  answerDecide(choiceId) {
    if (this.#beat !== 'decide' || this.#msgSolved) return null;

    const choice = (this.currentMessage()?.decide?.choices ?? []).find((c) => c.id === choiceId);
    if (!choice) return null;

    this.#attempts += 1;
    const correct = choice.correct === true;
    let scored = false;

    if (correct) {
      this.#msgSolved = true;
      if (this.#attempts === 1) {
        this.#stars += 1;
        scored = true;
      }
    } else {
      this.#slips += 1;
      this.#slippedIdx.add(this.#msgIndex);
    }

    return { choice, correct, scored };
  }

  /* ---------------- Between messages / missions ---------------- */

  /** Advance to the next message (fresh at SPOT). False when the mission is done. */
  nextMessage() {
    if (this.isLastMessage) return false;
    this.#msgIndex += 1;
    this.#startMessage();
    return true;
  }

  /** Advance to the next mission. False when the topic is done. */
  next() {
    if (this.isFinished) return false;
    this.#index += 1;
    if (this.isFinished) return false;
    this.#startMission();
    return true;
  }

  /** Back to the first mission with a fresh slate. */
  reset() {
    this.#index = 0;
    this.#startMission();
  }
}
