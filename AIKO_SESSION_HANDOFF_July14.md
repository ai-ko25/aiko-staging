# Aiko — Session Handoff (July 14, 2026)

This file lets a new session continue exactly where we left off, with no re-explaining needed. Read it fully before starting.

**This file serves TWO destinations:**
1. **A new chat (thinking-partner mode):** for planning, deciding, reviewing, copy, and strategy. Attach this file there. (Soha needs a new chat because the old one hit the image/PDF limit.)
2. **Claude Code (in the ~/Desktop/aiko folder):** for the actual multi-file code editing tonight. Keep this file inside ~/Desktop/aiko so Claude Code can read it.

---

## FOR CLAUDE CODE: HOW TO WORK TONIGHT (read this section first if you are Claude Code)

You are editing Soha's local Aiko game in ~/Desktop/aiko. The game is now MULTI-FILE (refactored from the old single-file version). Do NOT touch the old single-file demos in reference/ (aiko_game_demo-2.html, aiko-concept-runner-4.html), they are large and outdated.

**Files that matter for tonight's task (items 1 to 7 below):**
- `css/game.css` (~31 KB) — nearly all mobile-layout work lives here: bubble positioning, thumb-reach, tap-target styling, call-to-action appearance. Primary file for items 1 to 4.
- `js/ui.js` (~17 KB) — renders bubbles, handles taps, controls mission interaction. Critical for affordance, CTA, and the throw-to-trash mechanic.
- `data/missions/strangers-online.en.json` (~5 KB) — the stranger mission dialogue and flow. Primary file for item 5 (discreet stranger rework).
- `js/content.js` (~11 KB), `js/main.js` (~11 KB) — wire mission logic and content together. Read for understanding.
- `index.html` (~12 KB) — overall structure and load order. Read for orientation.
- Skip: audio/, images/, aiko/*.png (binary assets), and the *.ar.json Arabic files (Arabic polish is item 8, NOT tonight).

**How to behave (this matters):**
- A UI change once BROKE this build (Aiko and the bubbles vanished). Work in small, tightly scoped steps. Do NOT make sweeping changes across all files at once.
- After EACH change, tell Soha exactly what to test in the browser (`cd ~/Desktop/aiko && python3 -m http.server`, then refresh) before continuing.
- Read all the files listed above FIRST, then present a plan as an ordered list, and do NOT edit anything until Soha approves.
- Use MCQ-style options (2 to 4 choices) when there is a real decision.
- NEVER use the em-dash character anywhere (see standing rules).

---

## WHO I AM

- **Soha Mousa**, founder and CEO of **Aiko by Atannur**.
- Aiko is a **gamified online-safety companion for kids aged 8 to 12**. Positioning: "Duolingo meets Tamagotchi, for online safety." Framing: "from monitoring to mentoring," never surveillance.
- Incubated at **DIC / MCIT Qatar**. School pilot confirmed: **AIA Lusail, Grade 6, September 2026**.
- I work in **thinking-partner mode**: give me full first passes to react to, use **MCQ-style prompts (2 to 4 options)** before committing to directions, one priority at a time, plain concrete language.

## STANDING OUTPUT RULES (apply to everything: code, copy, docs)

- **NEVER use the em-dash character** anywhere. Use commas, colons, parentheses, or periods instead. This applies to all generated code, prompts for Claude Code, copy, and docs.
- One priority at a time, sequentially.
- Plain language, no jargon.
- I own all naming and final decisions.
- **Internal design rules must NEVER appear in public-facing copy** (see below).

## THE TEAM

- **Aysha Jiffry** (CDO): brand, character design, social, growth, landing pages. Currently owns the **workshop landing page** entirely.
- **Hanaa Abbas** (tech lead): part-time, WEEKENDS ONLY (full-time AI engineer at Ooredoo). Building a **separate backend repo ("IQ World")**: React Native, FastAPI, SQL database, authentication, deployed on GCP. Protected main branch, pull-request workflow.
- **Manar Oqbi**: research, outreach, school operations.
- **Nagi Salloum**: weekly coach (Saturdays + a Wednesday July 15 in-person session). His feedback is treated as binding for revisions.

## INTERNAL-ONLY DESIGN RULES (never in public copy)

- Aiko is **genderless, shape-shifting** ("anything a kid wants it to be").
- **Material rule:** Aiko can morph into any shape, but its material, colours, and glowing golden core never change. A dino-Aiko is "Aiko-jelly shaped like a dino," still jelly, still Aiko.
- "Safety is the doorway to companion."
- The anti-surveillance comparison and the copilot boundary are internal framing.
- Public-facing external language: "anything a kid wants it to be," companion for kids, copilot for parents. Never blend the two audiences.

## BRAND TOKENS

- Colors: purple #7F77DD, purple-dark #3C3489, navy #26215C, gold #EF9F27, green #1D9E75.
- Fonts: Baloo 2 (display), Nunito (body).
- CSS variables in use: `--aiko-glow`, `--aiko-glow-soft`.
- Roblox is BANNED in Qatar (Aug 2025), use **Fortnite** in examples.

---

## WHAT IS ALREADY LIVE (deployed and working)

- **Aiko game/mission:** `aiko.atannur.org` (repo: github.com/ai-ko25/aiko, GitHub Pages). Playable, bilingual (English + Arabic with RTL flip), single-file HTML + Python assembly script. Audio via Web Audio API + browser SpeechSynthesis. In-game Aiko AI responses use `claude-sonnet-4-6` (API key commented out for safe public deploy).
- **Product landing page:** `atannur.org` (repo: github.com/ai-ko25/atannur-landing, GitHub Pages). Waitlist form works end-to-end via **Formspree** (endpoint https://formspree.io/f/xzdnpbzl). Captures name, email, phone (optional), and repeatable child rows (name + age, optional for all roles, sent as indexed keys child_1_name, child_1_age, etc.). Role dropdown with "Other" reveal. Honeypot renamed `_gotcha`.
- DNS at Squarespace: four A records on @ (185.199.108.153 / .109 / .110 / .111), CNAME www and CNAME aiko both to ai-ko25.github.io, coexisting with Google Workspace email records (TXT DKIM + SPF).
- **Domain branding decision (PARKED, not urgent):** buy a standalone Aiko .com later and point it at the existing Pages sites. For now keep aiko.atannur.org (game) and atannur.org (landing). The domain auto-renews and is permanently safe.

## GITHUB / WORKFLOW SETUP

- GitHub username: **ai-ko25**. Logged into GitHub via terminal already.
- Mac, VS Code + Claude Code (Opus 4.8, 1M context, logged in as aiko@atannur.org).
- Two projects: `~/Desktop/aiko` (game) and `~/Desktop/atannur-landing` (landing).
- Local dev: `cd folder && python3 -m http.server`.
- Nagi's directive: everyone works off the shared repo, each on their own branch, deploy to staging so work is visible without waiting on Hanaa's weekend availability.

---

## THE JULY 15 DEADLINE (one day out as of this handoff)

Nagi set a hard external deadline of **Wednesday July 15** with TWO independent deliverables:

1. **A real V1** (private beta): one FINISHED mission (UI/UX complete) with signup + parent-child account link + PERSISTENT tracking (kid logs back in, sees mission complete/incomplete; parent sees progress). This lives ONLY in Hanaa's backend repo. Requires resolving the repo-transition question with Hanaa. NOT something Soha builds alone.
2. **A parent workshop/webinar** with its own landing page (Aysha owns this entirely now) + slide deck. Nagi suggested the first one be a free webinar as a forcing function; announce publicly before ready.

## THE REPO FORK (highest structural risk, still open)

Two parallel Aiko builds exist: Soha's shipped GitHub Pages version, and Hanaa's separate "IQ World" repo (backend, DB, auth). In the July 11 team meeting Hanaa asked directly "when/how do we transition from yours to the other repo?" and it was deferred. Soha's plan: study first, then meet Hanaa later today (July 14) to resolve it. Decision made: Soha will do tonight's mission UX work UNCONSTRAINED on her own version, and reconcile with Hanaa later (Soha is confident the two codebases are already very different, so there is no point constraining the work now). In the Hanaa meeting, ask her directly: does she want Soha's improved mission layout as code she pulls in, or as a visual reference she rebuilds in React Native?

---

## TONIGHT'S TASK: MISSION PROTOTYPE PUNCH-LIST (full scope approved)

Working unconstrained on Soha's local `~/Desktop/aiko` version. Scope for tonight = ALL of the following (items 1 to 7). Items 8 to 9 are noted for later, not tonight.

**PRIORITY 1 — Mobile UX (Nagi's repeated feedback, what he tests tomorrow):**
1. Bubbles sit too high/far from the thumb. Move interactive elements down toward bottom-center thumb-reach zone.
2. No tap affordance on mobile (no hover exists on mobile). Add clear visual cues that elements are tappable: button-like styling, subtle pulse/animation on the target, obvious affordance.
3. Call-to-action not obvious. Nagi had to tap randomly to figure out what to do. Make the primary action on each step unmistakable.
4. Bubbles too far from the speaker. Move speech bubbles closer to Aiko / the person speaking so the visual link is clear.

**PRIORITY 2 — Mission content/interaction:**
5. Make the stranger encounter realistic and DISCREET. Nagi's note: a real predator doesn't announce himself, he arrives non-obviously while the kid is doing something else (e.g. playing a game), dropping compliments ("you're shooting great!") then escalating. Currently the stranger just appears. Rework: kid is mid-activity, stranger slips in casually with praise, then escalates.
6. More interactive than hover/tap-to-reveal. Soha's idea: kid physically THROWS the bad message in the trash (or throws something at the suspicious part). More game-feel, more memorable. Also fixes the affordance problem.
7. The "detective / spot the red flag" intent didn't land before. Decide: lean into it properly (clear hunt with clear tap target) or drop it.

**PRIORITY 3 — Later, NOT tonight:**
8. Arabic phrasing too literal (e.g. "Alama Hamra" for red flag reads stiff). Needs native-speaker pass.
9. General visuals/friendliness pass. Improves over time once core is set.

## KNOWN RISK

The UI/design skill once **broke the build** when applied to the mission (Aiko and bubbles vanished, needed re-iteration). The cause was likely an unscoped "redesign this" invite that let it tear up structure. Mitigation: scope changes tightly, work on a copy/branch, test locally after each change, keep before/after screenshots. Do NOT blindly invoke a skill and deploy, test first.

## WHAT THE NEW CHAT NEEDS FROM SOHA

- **The mission HTML file** from `~/Desktop/aiko` (the actual file being edited). Most important item, without it we are guessing at structure.
- **A mobile screenshot** of the mission (ideally the screen Nagi struggled with, bubbles too far from thumb).
To find the file: `ls ~/Desktop/aiko` then attach the mission HTML.

---

## SOHA'S PLANNED SEQUENCE (July 14)

1. Mission mobile UX + interaction fixes (tonight, this task, full scope 1 to 7).
2. Message Hanaa, meet later today to resolve repo transition + V1 scope + who owns the layout going forward.
3. Prep for the Wednesday July 15 in-person Nagi session.
4. Build the critical-path schedule / team calendar (Nagi pushed for CPS: pick the end date, work backwards, assign dates to each prerequisite task).

## WHAT I AM WORKING ON NEXT (forward roadmap, keep in back of mind)

Immediate (this week, around July 15):
1. Mission mobile UX + interaction fixes (tonight's task, items 1 to 7 above).
2. Meet Hanaa to resolve the repo transition + V1 scope + who owns front-end layout going forward.
3. Prep for the Wednesday July 15 in-person Nagi session.
4. Build the critical-path schedule / team calendar (work backwards from a chosen date, assign dates to each prerequisite task). Nagi pushed for this hard.

Soon after:
5. Support Aysha on the workshop landing page deployment when she is ready (reuse the Formspree + GitHub Pages playbook; note the workshop forms need their OWN Formspree endpoint, separate from the product waitlist xzdnpbzl). Open question she is deciding: is the workshop free (keep "free" + add a date) or price-open (strip "free")? Also: verify sourcing on the "70%" and "1 in 3" stats before the page goes public.
6. Public workshop/webinar announcement as a forcing function (Nagi's recommendation: announce before ready).
7. Resolve the two-repo architectural fork properly (merge or clean handoff to Hanaa's backend).
8. Bucket 3 follow-through: team operating system (DRI model, one stable owner for the tracker, weekly sync cadence post-Nagi).
9. Standalone Aiko domain purchase (parked, low priority; ~$12/yr, ~15-min DNS swap).
10. Mission polish noted-for-later: Arabic phrasing native pass; general visuals/friendliness pass.

## THE 8-BUCKET FOUNDER ROADMAP (the big-picture structure, do not lose this)

An earlier planning structure I never fully finished. Status per bucket:

1. **Positioning and vision** — LOCKED.
2. **Product and game design** — LOCKED.
3. **Team and accountability** — PARTIALLY WORKED. DRI ownership model, weekly sync cadence, Google Sheets tracker. Root cause of team slippage identified as blurry ownership + no follow-through mechanism, NOT capacity. One stable owner for the tracker record is needed (rotating ownership recreates the problem).
4. **Tech and deployment** — IN PROGRESS. GitHub, Formspree, DNS all done; the repo fork with Hanaa is the open item.
5. **Landing page and launch** — IN PROGRESS. Product landing page live; workshop page with Aysha.
6. **Marketing and outreach** — PENDING. Manar's expert interviews, Aysha's social carousels, workshop partnerships (someone with access to mothers).
7. **Three-month timeline** — PENDING. Ties directly to Nagi's critical-path scheduling.
8. **Legals and founder structure** — PENDING. Not started.

Buckets 6, 7, 8 are the least-touched and will need dedicated sessions.

## BACKGROUND: WHAT NAGI EMPHASIZED (July 11 session)

- Speed of VISIBLE output is make-or-break. Team does too much invisible work, not enough shipping.
- Don't let Hanaa become the bottleneck (burnout risk); shared repo + branches + staging deploy is the fix.
- Deadlines are too loose; treat them as real. Use critical-path scheduling. Announce publicly to force them.
- Workshop is the fast income path (investors too slow, day-job steals focus). Parents pay, not kids.
- Message real game designers on LinkedIn for short feedback sessions.
- Once the shell (page, signup, auth, tracking) is done, focus all energy on game dynamics (done once, then improve).
- Financial context: rent pressure is real; the workshop track is survival infrastructure, not a side quest.
