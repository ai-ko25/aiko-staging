# Aiko's voice

Drop the mp3 files here:

    assets/voice/en/<file>.mp3     English
    assets/voice/ar/<file>.mp3     Arabic

The filenames are listed in `VOICE_LINES.md` (and `data/voice-lines.json`).
Use those names EXACTLY: the game finds each clip by matching the sentence Aiko
is saying against the manifest, and the manifest points at the filename.

No wiring is needed when the files arrive. The game checks once, on load,
whether a voice pack is present. If it is, Aiko speaks. If it is not, the game
plays in silence exactly as it does today.

If a line's wording changes, its recording must be remade: a reworded line no
longer matches the manifest, so it simply falls silent rather than saying the
wrong thing.
