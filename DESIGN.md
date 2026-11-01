# Fish Out of Water: design

## The pitch

**You're a fish on dry land: flop back to the sea before you dry out.**

**The goal in one look:** your glossy fish on a sunny market floor, a water gauge draining under it, and the sea glittering at the
end of the street. Flop there.

One button. Hold to curl up, let go to fling yourself where the camera looks. A dotted arc of water drops shows exactly where you
will land before you let go. You bounce, slide and splat through a harbour town while your scales dry; puddles fill you back up.
First fish into the sea wins.

## The first 60 seconds

| Time | What the screen shows | Hint (2-5 words, once, then gone) |
|---|---|---|
| 0 s | **Title.** The Quay at noon: whitewashed houses, red-striped awnings, the harbour glittering behind. Four bot fish flop about a fishmonger's stall in the foreground; one sails across the frame and splats into a puddle. Gulls wheel. Big "FISH OUT OF WATER", one big lemon-pinned price tag: **PLAY** (`Space`). Soft accordion. | none |
| 2 s | Tap Play: a wet slap, the music opens up, the camera swoops down behind *your* fish on the Quay (your name on the price tag pinned to its fin). This is the lobby, and it's playable. Touch: the Flop button appears bottom right. | "Hold to curl" (with the key: Space / Click / Flop) |
| 4 s | You hold: the fish curls into a C, a squelch rises in pitch, a dotted arc of water drops stretches out to a landing ring. | "Let go to flop!" |
| 5 s | Release: SLAP, the fish flings itself, spins, lands with a splat, bounces, leaves a wet mark that dries. | "Drag to turn" / "Mouse to turn" / "A D to turn" |
| 8 s | You flop around the Quay (a puddle, a crate, an awning that bounces). Right side: seat tags (you, plus "+7 fish" that will fill). The platform's Ready strip is at the bottom. | "Ready to race" (after 3 flops, first visit only) |
| 12 s | Ready (alone: the race starts at once). **Intro, 4.5 s:** the camera flies from the sea back along the Fish Market to the start (the goal first), the course tag swings in ("THE FISH MARKET · Race 1 of 3"), eight fish on a crate of ice, ship's bell 3-2-1, foghorn GO. | "Flop to the sea!" with an arrow at GO |
| 17-35 s | Fish spill off the ice onto wet tiles. The gauge under your fish drains; the arc's landing ring turns cyan with a drop symbol over a puddle. | "Drying out!" (first time under 50%), then "Puddles = water" (first time a refill is in reach) |
| 35 s | First refill: a burst of droplets, the fish shines again, the gauge sloshes full. A bot gets batted across the aisle by the cat (the laugh). | "Watch the red!" (first telegraph near you) |
| 55 s | Ice crates: a long slide, a whoosh. The street opens; the harbour fills the screen. | none |
| ~95 s | Last leap off the quay edge: SPLASH, crowd cheer, place tag "3rd!" swings in. The 60 s "Last call" clock runs for everyone still flopping. | none |

The first race a player ever plays (no `firstRace` flag in their save) is gentler: no hazard fires within 30 m of the start, bots
play at 75% of their skill, and the hints above show. "Flop as you land!" (the slap, below) is taught once, after 10 landings in
the player's second race, never in the first.

## Controls

| | Keyboard and mouse | Phone and tablet |
|---|---|---|
| Aim (turn the camera) | Mouse (pointer lock, during races and trials), or A/D, ←/→ | Drag anywhere on the screen (not on the button) |
| Flop | Hold Left click or Space, let go | Hold the platform's **Flop** button (`ow.controls`, key Space), let go |
| Back to last puddle | Hold R (0.5 s) | Pause card |
| Pause / free the mouse | Esc | Platform menu |

- No stick: `ow.controls.set({ buttons: [{ id: 'flop', label: 'Flop', key: ' ' }] })` during play and in the lobby (the Quay is
  playable); `set(null)` on title, trial menu, results.
- The launch angle is fixed by the charge (no pitch control): direction = camera yaw, distance = how long you held. Turning the
  camera mid-air is allowed (to line up the next flop); the body has no air control.
- Lobby and menus: the mouse stays free (tags are clicked); aim with A/D or by dragging with the mouse. Pointer lock only in races
  and trials, from a click in the world, with an `Esc` key hint while locked; a lost lock opens the pause card (solo) or frees
  the mouse with a `Click` hint (race).
- Gamepad if present (guarded, stops after a throw): left stick X turns, A flops.

## The core loop and where mastery comes from

**Loop (every 1-2 s):** look → hold → watch the arc → let go → land → read where you are (water? ice? the cat?) → next flop.
**Every 20-30 s:** a moisture decision: detour to a puddle now, or push on.

**A beginner** taps short hops, stops, turns, holds, flops; lands wherever; drifts dry and gets sent back to a puddle once or
twice; finishes in 90-130 s.

**An expert** (40-55 s on the same course):
1. **Exact charge.** The arc is honest (it runs the same physics as the flop), so experts land on crate tops, in puddles and on
   ice on purpose.
2. **The slap.** Hold during the flight and let go within 0.12 s of touchdown: a wet SLAP flop that keeps 35% of your incoming
   speed and adds 12% power. A full leap lasts 1.1 s, exactly a full charge, so chained full slaps make a rhythm
   (hold-fly-release-on-landing). A rising chime counts the chain. While holding in the air, the arc is drawn from the predicted
   landing point. A slap within 0.15 s of GO is a "Great start!".
3. **Slides.** A long, low flop onto wet tiles, steel or ice keeps its speed (ice keeps 90%): free metres.
4. **Wall flops.** Flopping while touching a wall (aiming into it) reflects off it with +15% height: chimney-climb between crates.
5. **Routes.** Every course has shortcuts that need a precise flop (awning bounces, crate stacks, a handrail slide, the "lucky
   gull") and a safe line with more puddles.
6. **Water as a resource.** Skip puddles when you're full, take the hot-sand line when you can afford it, finish under 10%.
7. **Hazard timing.** Every hazard is on a visible clock (telegraphed 0.8-1.1 s ahead), so experts time through instead of round.

## Physics (pure module, own code, no engine)

Fixed step 1/120 s with an accumulator. The **gameplay body** is one sphere (radius 0.16 m) at the fish's middle, so flops are
predictable. The **visual body** is a chain of 5 nodes (6 for the eel) 0.13 m apart: verlet with distance constraints and bending
springs, colliding with the same world, pinned to the core sphere: it curls when charging (bend target 70° × charge per joint),
whips straight on release, flops and twitches on the ground. Other players' fish run the same chain behind their interpolated
core, so they look floppy too.

- **World colliders:** oriented boxes (yaw, plus pitch for ramps), vertical cylinders, spheres; a 4 m spatial hash. Every
  collider has a surface type. Hazards (feet, the cat, the chef, gulls, boules, sprinklers) aren't colliders: each reaches in with
  a knock, a grab or a nudge on the shared clock.
- **Gravity** 16 m/s² (snappy, not floaty).
- **Flop:** charge c = clamp((held − 0.15 s) / 0.95 s, 0, 1) (a tap is a hop, 1.1 s is full; holding longer stays full).
  Vertical speed 3.2 + 5.7c m/s (to 8.9), horizontal 2.0 + 3.4c m/s (to 5.4). On flat ground: hop 0.8 m long / 0.32 m high /
  0.4 s; full 6.0 m long / 2.47 m high / 1.11 s. A flop needs contact (or the last 0.1 s of it; a release up to 0.1 s before
  touchdown is buffered).
- **Contact:** normal.y > 0.55 is ground (slides), 0 to 0.55 is a wall or slope (can flop off it), below 0 is a ceiling.
- **Landing:** vertical speed × restitution bounces; horizontal speed × keep; then friction slows sliding.
- **Knock** (a hazard): velocity set to the hazard's push, 0.3 s stun (no flop), a spin and a bonk.
- **Bumps between fish:** soft spheres (0.3 m), each page pushes only its own fish away (1.5 m/s; 2.5 m/s if the other is
  flying fast). Squash on both visuals.
- **Out of bounds** (below the course or outside its box) or Hold R: back to the last refill point, 1 s.

| Surface | Friction (m/s²) | Keep on landing | Restitution | Drain × | Landing sound |
|---|---|---|---|---|---|
| Wet tile | 2.5 | 60% | 0.25 | 0.8 | wet slap |
| Stone (sun) | 6 | 45% | 0.2 | 1.2 | dry slap |
| Wood (crates, decks) | 7 | 40% | 0.3 | 1.0 | thud |
| Steel (counters) | 3 | 60% | 0.2 | 0.9 | plink |
| Ice | 0.6 | 90% | 0.15 | −2 (refills) | crack-clink |
| Hot sand | 14 | 15% | 0.03 | 2.5 | crunch |
| Handrail (brass) | 0.25 | 92% | 0.05 | 1.0 | plink |
| Wet sand | 9 | 25% | 0.05 | 0.4 | soft crunch |
| Gravel | 10 | 25% | 0.1 | 1.5 | scatter |
| Grass | 9 | 30% | 0.3 | 0.9 | swish |
| Stovetop / frying pan | 5 | 50% | 0.35 | 5.0 | sizzle |
| Plush (gift shop) | 12 | 20% | 0.6 | 1.1 | fwump |
| Awning / rope coil | 4 | 70% | 0.85, at least 6.5 m/s up | 1.0 | boing |
| Net | 30 (stops) | 0% | 0, sticky 0.6 s | 1.0 | creak |

**Moisture** (0-100, the clock): base drain 2.8 per second (36 s from full) × the surface's factor (in the air: the last surface's).
Shade × 0.6. Hot sand dries you in 14 s, a stovetop in 7 s. Refills: puddle, bucket, tide pool, fountain, touch pool: +100/s
(full in 1 s); a sprinkler's jet: +55/s; the beach shower: +45/s; ice: +5.6/s. Under 35% the gauge
turns red with a crack, the fish dulls, gills flare; under 15% it gasps and the music speeds up 12%. **At 0: a 1 s gasp, then a
splash back at the last refill point** (the start counts) with a full tank.

## Courses

Four courses, each 155-245 m from start to water, built from data (pieces with a surface type, refills, hazards, decor) over one
modular prop kit (bevelled crates, ice trays, stall counters, barrels, tiles, awnings, buckets) plus each course's own landmarks.
Each course has a **spine** (a polyline of the main line, for progress and the safe bot route) and an **expert line**. The sea is
visible from the start or pointed to: the harbour window at the end of the Kitchen, the lighthouse at the end of every street,
blue enamel signs with a wave and an arrow, gulls drifting over the water, the wave at the end of the HUD's fishing line, and a
"This way" chevron for a player facing away from the route for 2 s. Puddles and no hazards early, busier near the end.

| # | Course | Length | The water | Signature hazard | Refills | Shortcuts |
|---|---|---|---|---|---|---|
| 1 | **The Fish Market** | 193 m | the harbour off the quay | **the cat** on a barrel (swipe) and **shoppers' feet** | ice trays, mop bucket, puddles under the stalls, a dripping hose | bounce awning to awning over the cat aisle; crate stacks; the kiosk roof |
| 2 | **The Kitchen** | 157 m | the big pot sink under the harbour window | **the chef** walking the line with his pan (slams) and the hot range | the ice pan (start), a dripping prep sink, the mop bucket, the dish tub, puddles | the shelf over the range (a spill on it); the steel pass (slide); the scullery drain strip |
| 3 | **The Beach** | 231 m | the surf line | **gulls** that grab you and drop you back; **hot sand** | tide pools, kids' buckets, the beach shower, a melting cool box, wet sand near the water | the boardwalk; the lifeguard tower ramp; the **lucky gull** (lemon, slow, rare) that drops you 20 m ahead |
| 4 | **The Park** | 245 m | the harbour wall at the bottom of the hill | **boules** rolling across four lanes; sweeping **sprinklers** (moving refills that nudge you) | sprinkler jets, the fountain, dog bowls, watering cans, puddles | the brass handrails down the grand stairs (a long slide); picnic tables; café parasols (bounce) |

The Kitchen has no knives anywhere: you start in a pan of ice on the prep island and finish in the big pot sink. The Park starts
on a picnic trestle's ice tray at the top of the hill: lawn, the boules pitch, the fountain, the grand stairs, the rose garden and
the harbour front with its café.

**Hazards are pure functions of the course and the race clock** (`raceTime`, plus phase offsets from `match.seed`): every page
computes the same cat, chef, gulls and boules with no messages, and a host change can't desync them. Each is telegraphed:
- Cat: swipes one side then the other every 2.1 s; 0.9 s before, a red arc shows on the floor on the side about to be swiped.
  Knock 4.5 m/s away + 3.5 sideways + 3.5 up.
- Shoppers' feet: 4 shoppers walk back and forth, a footfall every 0.55 s; a foot's shadow darkens 0.35 s before it lands
  (0.42 m). Scuff 4 m/s along their walk + 2.2 up. The shoppers themselves are always in view, so their path is the warning.
- Chef: walks between 5 stations on the line, one slam per 3.6 s; pan raised high + red circle (1.4 m) 0.85 s ahead, then BONG.
  Knock 6 m/s away + 4 up.
- Gulls: 3 on the beach, each dives every 7.4-8.8 s at its stations; the shadow and a red ring grow over 1.1 s (0.8 m). Caught:
  carried 1.6 s and dropped 15-20 m back, then immune for 3 s. The lucky gull (lemon, bigger, every 15 s, off to the side) drops
  you 20 m ahead and is never a danger.
- Boules: four lanes, a throw every 2.6-3.2 s from alternate ends; red chevrons run along the lane for 0.8 s before (the way the
  ball will come); a steel boule rolls the lane at 5 m/s. Knock 5 m/s along + 2.2 up.
- Sprinklers: four, each sweeping a 80-90° arc of 4-5 m every 4.6-5.4 s, the swept grass darker: inside the jet you refill (+55/s)
  and get nudged along it.

## Solo

Everything solo starts from the Quay (the lobby), alongside the Ready strip. A lone player gets the whole game:

- **Race with bots** (the main thing): Ready, and a cup against 7 bot fish starts at once.
- **Time Trials:** the four courses, unlocked in order (finishing one opens the next), each with **bronze / silver / gold** times,
  your **best ghost** (a clear glassy fish) and, until you have gold there, the **gold ghost** (the expert bot's run, simulated
  live: the quicker of a few clean runs), which shows the shortcuts. Timer with a split against your best (−0.8 / +1.2) and the next medal's
  target. Retry is one tap (or R on the finish tag). Pause on Esc and when the page hides.
- **Daily Catch:** one course + one twist a day from the UTC date: **Windy** (a steady side wind, ±1.5 m/s², in the arc
  preview, flags and leaves show it), **Slippery** (all friction × 0.4, soap suds), **Heatwave** (drain × 1.5, heat shimmer).
  Unlimited tries, best counts; its own leaderboard.
- **Fish:** five, each a different look and a small physical character, never a stat grind (expert-bot sims keep every fish within
  ±3% of the mackerel's time on every course):
  - **Mackerel** (from the start): the baseline. Sleek, blue-green tiger stripes.
  - **Goldfish** (finish the Fish Market): floatier (gravity × 0.9, range × 0.95), softer landings. Fan tail.
  - **Flatfish** (5 medals): slides more (friction × 0.6), lower arcs (height × 0.92, range × 1.04). Both eyes on top.
  - **Pufferfish** (9 medals): bouncier (restitution + 0.3), range × 0.95; puffs up round on every landing.
  - **Eel** (3 golds): a long 6-node whip, charges to full in 0.85 s, range × 0.92.
  Each has 3 colourways. Medals count 1 per tier earned (bronze, silver, gold on a course = 3), 12 in all.

How long it lasts: four courses × three medals is several hours for a player who chases golds (gold is tuned to the expert bot),
then the daily and the boards.

## Multiplayer

- **A public game.** `ow.rooms.join({ maxPlayers: 8, minPlayers: 1, lobby: 'bar', countdown: 0, settings })`, joined once as the
  page loads. Private servers come from the platform's menu.
- **Settings** (the host picks them on our Cup tag; `room.setSetting`, `clearReady()` after a change):
  `cup`: Harbour Cup (Market, Kitchen, Beach), Seaside Cup (Beach, Park, Market), Grand Tour (all four, shuffled by `match.seed`,
  three of them in a 3-race cup); default Harbour. `races`: 1 or 3, default 3. (The spec's "host picks the course" becomes "host picks the cup".)
- **Lobby:** the Quay, playable for everyone (players see each other's fish flopping). The platform's Ready/Start strip at the
  bottom. Nothing starts until all are ready: a private server waits for the host's Start (`room.canStart`), a public one starts by
  itself once everyone is ready.
- **Match = a cup** run by `createMatch`: `rounds: 'races'`, `introSeconds: 4.5` (our flyover and our 3-2-1, the only countdown:
  `countdown: 0`), `roundSeconds: 240` (a hard cap), `roundEndSeconds: 7`, `resultsSeconds: 15` (the host can skip),
  `admit: 'round'` (latecomers watch, then take a bot's seat at the next race).
- **A race ends** when every present seat has finished, or 60 s after the first finish (the "Last call" tag), or at 240 s.
- **Points** by place: 10, 8, 6, 5, 4, 3, 2, 1. Finishers by time, then the rest by distance along the spine. Cup ties go to the
  better total time of finishes.
- **Bots** fill the empty seats up to 8 (`createBots`, `fill: 8`, skill 0.25-0.85, names below); 0.75 × skill in a host's first
  race when it's the only human. Players always take a bot's seat first.
- **Leavers:** their seat stays in the standings; their fish greys and stops where it was, ranked by its last distance. **Reload
  or drop:** seat hold; the page carries on from `room.me.presence` (its position and water) on the same race clock.
- **Host change:** `createMatch` carries the cup on; the new host continues the bots from the last `host:bots` snapshot (positions,
  velocities, water, brains reset).
- **Watchers** follow the leader (tap or ←/→ to switch fish), with our tag naming who they follow.

**Netcode (kept as simple as the game allows):**

| What | Who simulates or decides | How it travels |
|---|---|---|
| Your own fish | your page (fixed 120 Hz) | presence ≤ 20 Hz: `{ x, y, z, h, c, b, m, s, p, f, k, r }` (cm ints, yaw, curl, 3 bend angles, water, state: race/grab/dry/done, progress dm, fish, colourway, round id); others drawn with `presenceAt(id, { angles: ['h'], snap: 300 })` 100 ms behind, chain re-simulated locally |
| Bot fish | the host's page, same physics + bot brain | `host:bots` (`host.state`, schema-checked) at 10 Hz, compact arrays; others interpolate |
| Hazards | every page, from course + race clock | nothing |
| Hazard hits, drying out, gull grabs | each page for its own fish (the host for bots) | presence state |
| Bumps | each page pushes only its own fish | nothing |
| Finish | your page reports, the host validates and writes | `host.rpc('finish', { rid, t })`: t (race ms) must be ≤ the arrival's `matchTime` and ≥ it − 2 s, ≥ the course's minimum plausible time, and the sender's progress near the water; written to `match.data.fin` |
| Places, points, race end | the host | `match.data` / `createMatch` scores |

The race clock is `room.matchNow() − match.data.start` (`start` is written by the host when the round begins), so pauses and host
changes don't move it. Everything read from the room is validated (types, ranges, round id); names are drawn as text only.

**Bot brain** (pure, also drives the gold ghost and the trailer's autoplay): target the farthest point on its route it can reach
that won't be under an active telegraph when it lands and isn't hot when it's low on water; find the charge by bisection on the
same trajectory predictor the arc uses; then add human error: aim σ 8° → 1.2°, charge σ 14% → 2.5%, reaction 0.65 → 0.18 s after
landing (skill 0 → 1); slaps from skill 0.6 (timing σ 0.12 → 0.03 s); heads for the nearest refill below 45% → 25% water.
Personalities, each with a name, species and colourway of its own (no "BOT" tags): **Sal** (hothead: always full charge, skips
puddles, sometimes dries out), **Pearl** (careful: shorter hops, every puddle), **Kipper** (show-off: shortcuts and slaps),
**Bones** (wobbly: big aim errors, gets batted by everything), **Captain Gill** (steady), **Marisol** (fast and consistent),
**Nico**, **Lulu**, **Bream**, **Dot**.

## Progression and reasons to come back

- Course unlocks in order; medals; fish unlocks (above); personal bests and ghosts per course.
- **Saves** (`ow.save`): `profile` (fish, colourway, per-course best ms + medal, daily best for today's date, tips seen, the
  `firstRace` flag, counters for badges); `ghost-<course>` (your best run at 8 Hz, delta-coded int16, base64, about 10 KB each,
  40 KB for all four: fits a guest's 128 KB).
- **Leaderboards** (16 of the 25 allowed, lower is better, seconds to 0.1): `time-<course>` × 4, and `daily-<course>-<twist>` × 12
  (the daily picks one combo per day, so each board is that combo's all-time best).
- **Badges** (10):

| id | Name | Earned |
|---|---|---|
| `first-flop` | First Flop | Flop for the first time. |
| `splash` | Splash | Reach the sea. |
| `gold-fin` | Gold Fin | Win a gold medal. |
| `bone-dry` | Bone Dry | Reach the sea with under 10% water. |
| `gull-bait` | Gull Bait | Get carried off by a gull. |
| `ice-skater` | Ice Skater | Slide 10 m in one go. |
| `slap-happy` | Slap Happy | Five landing slaps in a row. |
| `whole-catch` | Whole Catch | Finish every course. |
| `golden-catch` | Golden Catch | Gold on every course. |
| `cup-champion` | Fish Market Champion | Win a cup. |

## Balance and timing

| | Number |
|---|---|
| Flop charge | 0.15 s (hop) to 1.1 s (full) |
| Flop reach (flat) | 0.8 m / 0.32 m high to 6.0 m / 2.47 m high |
| Slap window | 0.12 s after touchdown (0.1 s buffered before); +12% power, keeps 35% incoming speed |
| Water | 36 s base, 45 s wet tile, 14 s hot sand, 7 s stove; refill to full in 1 s |
| Refill spacing (main line) | at most 22 s apart at a beginner's 2.0 m/s; hot sand at most 14 m apart (or the boardwalk) |
| Pace | beginner ~2.0 m/s, good ~3.0, expert ~4.2 (slap chains and slides) |
| Race | ~90-130 s first time, 45-55 s expert; 60 s "Last call" after the first finish; cap 240 s |
| Cup | 3 races ≈ 6 min with intros (4.5 s), race results (7 s) and cup results (15 s) |
| Bots in races | skill 0.25-0.85 (two clumsy, three middling, two sharp), × 0.75 in a first race |

Medals (gold / silver / bronze), set from bot simulations (6 seeds per skill): Market 0:50 / 1:04 / 1:32, Kitchen 0:46 / 0:58 /
1:24, Beach 1:12 / 1:45 / 2:40, Park 1:08 / 1:32 / 2:25. Gold sits just above the skill-1 bot's best runs (it takes a clean,
quick line), silver near the skill-0.55 bot, bronze near the skill-0.3 bot.

**Checked in node tests** (`npm test`):
- The arc: 800 flops (every course, every fish, four charges and aims) land within 0.3 m of the preview (wall hits: where the
  fish is when the arc says it touches).
- Water: drain on dry ground, a puddle fills you in about a second, drying out sends you back to the last puddle.
- Courses: every start slot settles on the ice; bots of every skill (1, 0.8, 0.55, 0.3; steady, careful, wobbly) reach the sea;
  the best runs beat gold, gold isn't easy for the skill-0.8 bot, silver and bronze are within reach of the slower bots.
- Hazards: the same states for the same clock and seed; the cat, chef, gulls and boules warn ≥ 0.8 s; nothing reaches a fish in
  the gentle start.
- Cups, medals, ghosts (encode/decode), presence read defensively, and the host refusing forged finishes (too fast, an old race,
  off the clock, twice) through the stand-in room.

## Every screen

The Quay is the stage for the title, the lobby and the podium: one scene, the camera moves between them. Every screen keeps the
top-left 150×70 clear (the platform menu) and lays out around `ow.ui.reserved`.

1. **Title.** The Quay alive (bots flopping, gulls, glittering sea). Centre-top: "FISH OUT OF WATER" (three lines in portrait).
   Centre-low: the **PLAY** tag (lemon pin, `Space`), swinging gently. Under it: your medal tally (three medal discs with counts)
   once you have any. Nothing else.
2. **Lobby (the Quay).** Your fish in the middle, playable. Top centre: the **Cup tag** ("HARBOUR CUP · 3 races"; the host taps it
   to change cup and races). Right edge: the **seat tags** on a fishing line (avatar head, name, a stamped tick when ready, a
   captain's cap for the host, "+5 fish" for the bots that will fill). Left edge under the menu: three tags: **Time Trials**,
   **Daily Catch**, **Fish** (opens the picker: the five fish on the ice, locked ones as silhouettes with their condition). Bottom:
   the platform's Ready strip. Portrait: seats become a row of heads under the Cup tag; the three tags stack on the right side.
   An empty seat area offers `ow.ui.showInvite()`.
3. **Intro (each race).** Flyover from the water to the start, the course tag ("THE BEACH · Race 2 of 3"), then behind your fish:
   3-2-1 as huge numerals on a swinging tag, ship's bell, foghorn GO.
4. **Race HUD.** Top centre: the **timer tag** (0:42.3). Top right: the **place tag** ("3rd", huge), and under it the red
   **Last call** tag (bell + 0:45) once someone finishes. Along the top between them: the **fishing line**, one bobber per fish
   (seat colour + shape) moving toward a wave at the right end. Bottom centre: the **gill gauge** (a glass fish-shaped vial of
   sloshing cyan water; red with a crack below 35%). In the world: the aim arc and landing ring, name tags pinned to fins, your
   fish's lemon halo. Hints float by your fish (white, dark outline, no box).
5. **Race end (7 s).** The camera on the finish; a tag per fish on the line in race order: place, name, time (or distance),
   "+10" flying to the cup total.
6. **Cup results (15 s).** The podium on the Quay: three crates stacked, the top three fish flopping on them, confetti of lemon
   slices and ice chips, the winner's tag swinging big; the full standings as tags on the line; the host's Skip. Then the lobby.
7. **Watching.** The race with the leader followed, our tag "Following Sal" with ‹ ›; the platform's "Watching" note.
8. **Time Trials menu.** The camera on a fishmonger's ice display: four course tags spiked in the ice (name, best, medal stamp, or a
   padlock and "Finish the Kitchen"), a Back tag. A tap starts the course.
9. **Trial HUD.** Timer tag with the split, the next-medal tag (gold icon + 0:50.0), the gauge, ghosts. Finish: "SPLASH!", the time
   tag, the medal stamped onto it, New best, then **Retry** (R) / **Next course** / **Back**. In a busy public server, a
   "Race in 0:12 · Join" tag when the others are all ready.
10. **Pause card (trials).** Resume (first), Retry, Back to puddle, Quit to the Quay. Tags, not a box of buttons.
11. **Daily Catch.** One big tag: today's course and twist, your best today, the board's top 3, Play.
12. **Room closed.** One message, one tag-button: removed → Play; disconnected → Rejoin; another tab → Play here.

## Art direction

**The world:** a Mediterranean harbour town at noon. Whitewashed walls with harbour-blue doors and shutters, terracotta tiles and
roofs, red-striped market awnings, lemons in crates and on trees, wet stone that reflects the sky, crates of crushed ice, nets,
bunting, and the sea, a deep glittering blue, at the end of every street. Clean low-poly with bevelled edges, real light.

| Role | Colour | Hex |
|---|---|---|
| Sea, doors, shutters (the goal) | Harbour blue | `#0B5CAD` |
| Walls, text | Whitewash | `#F4EFE6` |
| Tags, outlines, ink | Slate | `#1A1D22` |
| Awnings, danger, pins | Awning red | `#E4432D` |
| You, Play, gold | Lemon | `#FFC93C` |
| Floors, roofs | Terracotta | `#CB6B3F` |
| Water, refills, the gauge (good) | Spray | `#4CD3EC` |

Good = spray cyan + a drop symbol; bad (dry, hot, telegraphs) = awning red + a crack or "!" shape. Seat colours have shapes on
pins and bobbers: lemon ●, red ■, cyan ▲, green ◆, pink ★, orange ⬢, lilac ✚, white ◯.
`ow.ui.setLook({ accent: '#FFC93C', panel: '#1A1D22', text: '#F4EFE6' })`.

**Fonts** (self-hosted with `@fontsource`, OFL): **Alfa Slab One** for big words (title, places, course names, SPLASH!), a heavy
harbour-sign slab; **Barlow Condensed** 600/800 for numbers and labels (tabular figures on tags).

**The signature element: the fish-market price tag.** A matte slate tag on a red or lemon pin, white condensed numerals, like the
tags spiked into the ice at a fish stall. Every fish wears one pinned to its fin with its name (that's why a fish has a price tag:
it escaped the stall). Every number in the game is on one: timer, place, Last call, medal times, course names, results, the Play
button. Tags swing on a spring when they change.

**Lighting and camera:** a high noon sun ahead of the camera, toward the sea, so the water throws a glitter path and shadows fall
toward the player (`#FFF1D6`); hemisphere sky `#BFE3FF` over terracotta bounce; PMREM sky environment so wet surfaces and fish
reflect; ACES Filmic, sRGB; warm sea haze fog (40-160 m). Soft shadows from a tight shadow camera (±14 m) following your fish: none
on low, 1024 medium, 2048 high. No post-processing: the sea's glints are additive sparkle sprites in its shader, antialiasing by
quality. Camera: third person, 2.6 m behind and 1.45 m up, looking 1 m ahead; yaw is the aim (exact), position springs behind;
it tilts up while charging so the arc shows; it eases in when anything comes between it and the fish (raycast to every solid)
and never ends up inside one. Portrait widens the vertical FOV to keep 55° across. Landing shake from trauma², none with reduced
motion.

**Players and bots:** your fish lies side-on to the camera (broadside) on the ground and through a flop, rolling forward in
the air, so its shape, curl and face always read from the chase camera. Glossy fish (clearcoat, low roughness, a species pattern in a small canvas texture), skinned on the chain;
big eyes that squeeze shut while charging, pop wide on release, look where you aim and blink. Drying shows on the body: colour
fades to chalky, roughness goes up, clearcoat goes away, the mouth gasps; a refill sends a shine down from head to tail. Every
landing leaves a dark wet splat that dries in 5 s (smaller when you're dry). Your fish has a soft lemon halo on the ground; your
tag's pin is lemon. Bots are the same five species in colourways of their own, with their names on their tags.

**HUD in the world's language:** price tags for every number; the fishing line with bobbers for progress; a glass fish-vial for
water; text over the scene in white with a thick slate outline. No boxes around HUD items.

## Sound (all synthesized Web Audio)

- Charge: a wet squelch rising in pitch with the charge. Release: a slap and whoosh. Landing by surface: wet slap, dry slap, wooden
  thud, steel plink, ice crack-clink, sand crunch, gravel scatter, grass swish, sizzle, plush fwump, awning boing, net creak.
- Slap: a bright SPLAT and a chime that rises with each link of the chain. Slide: a squeak that lasts as long as it.
- Refill: splash and rising bubbles. Low water: dry gasps, faster under 15%. Dry out: a deflating wheeze, then a splash back.
- Hazards: the cat's swipe, shoppers' footfalls, the chef's pan BONG, gull squawks (brighter for the lucky gull), the clack of a
  boule thrown. Bump between fish: a rubbery bonk.
- No ambience beds: the music and the hazards carry each course.
- Stingers: ship's bell 3-2-1, foghorn GO, a big SPLASH with crowd cheer at your finish, an accordion fanfare for a win, medal
  stamp thunk.
- **Music:** a little sequencer playing a jaunty tarantella in D minor (6/8, 132 BPM): musette accordion (three detuned voices
  with tremolo), tuba-like bass, tambourine and kick. Softer and filtered in menus, full in races, 12% faster under 15% water.

## Store art and the trailer

All posters are drawn by the game itself (`?poster=<name>`, fixed seed, no HUD).
- **Cover** (`thumb-1`): a mackerel mid-flop high over the market aisle, curled, scales flashing in the sun, other fish below,
  the cat's paw mid-swipe, the harbour glittering through the arch beyond; "FISH OUT OF WATER" once, big.
- **Action** (`thumb-2`): a gull flying straight at us with a mackerel in its feet, the surf and lighthouse behind, a puffer
  mid-flop on the sand.
- **Win** (`thumb-3`): the splash into the harbour, a crown of water, the fish diving, others on the quay edge behind.
- **Multi** (`thumb-4`): eight fish on the kitchen line under the chef, his pan high over the red circle.
- **Icon:** a glossy mackerel curled in a C, mid-flop, with a ring of flying water drops, on a harbour-blue disc. No text.
- **Badges:** a bold symbol on a coloured disc each (a curled fish, a splash crown, a gold medal, a fish skeleton, a gull, an
  ice skid, a slap star, a net of fish, a golden fish, a cup).
- **Trailer** (~30 s, autoplay with the bot brain): 0-3 s eight fish launch off the market's ice, the arc visible, the sea ahead;
  3-8 an ice slide and a slap chain; 8-13 a gull grabs a fish and drops it; 13-19 a near-dry dash (red gauge) into a puddle, the
  refill burst; 19-25 the chef's pan just misses; 25-30 a photo-finish splash into the harbour; last 2 s the title over the Quay.

## Originality check

It resembles **I Am Fish** (a fish escaping to the sea, physics comedy), the charge-jump of **Jump King** and **Only Up**, and the
party-race shape of **Fall Guys**. What a player notices in the first minute that is different: one button with an honest arc
(precision, not wrestling a floppy body), a race of eight fish on the same street, water as a clock you route around (puddles,
hot sand, a beach shower), and a sunny harbour-town look with price tags for every number. No other game makes you choose between
the puddle and the shortcut.

## Risks and how I'll handle them

- **Physics feels floaty or random:** own deterministic physics with honest arc previews, gravity 16, numbers tuned in node; the
  visual chain never affects the gameplay body.
- **Camera in tight spaces** (stalls, the kitchen): raycast boom against every solid, ease in, fade small props near the lens.
- **Too much content:** one modular kit plus data per course; the Fish Market to full polish first, then the rest in order, each
  checked in shots; four courses that are each finished rather than six thin ones; tests prove every course is finishable and
  within its medals.
- **Wayfinding:** the sea visible from every start, street signs, the progress line, the "This way" chevron.
- **Phones:** under 250 draw calls (merged static geometry per material, instanced crates, ice and lemons), shadows by quality,
  courses built only when chosen, fonts and the title first so it paints within 2 s; one big button, drag to turn.
- **Remote fish looking stiff:** they run the same verlet chain locally behind their interpolated core.
- **Hazard hits that look different on two screens:** each page judges only its own fish; hazards are on a shared clock, so the
  difference is at most one presence update.
- **Pointer lock rules:** lock only in races and trials from a click; Esc and a lost lock follow the platform's rules.
- **Bots too good or too bad:** skill curves checked against medal times in simulations.

## Changes from the spec

- **Drying out in a race doesn't knock you out:** you splash back at the last puddle you touched, in races as in solo, so nobody
  sits out a cup. The cost is the ground you lose.
- **Hazards run on the shared race clock** (no host messages): the same everywhere, and a host change can't break them.
- **The host picks a cup** (three courses), not one course, since a match is a cup.
- **The picnic is "The Park"** (picnic, sprinklers and pétanque on the hill above the harbour); the kitchen starts in a pan of ice.
- **Four courses, not six:** The Boat and The Aquarium were cut so the four that ship (Market, Kitchen, Beach, Park) are each
  finished; cups and medals are built around four.
- **Added for mastery:** the landing slap, wall flops, awning bounces and the lucky gull. **Added for the first minute:** the
  lobby is a playable quay.
- **Phone:** drag to turn and one Flop button, no stick.
