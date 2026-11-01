# Fish Out of Water: teardown and rebuild plan

Played the `build` version headless (autoplay through the Fish Market, 16 s at 1280×720, plus the old takes of the Kitchen,
the Beach and the Park) and read the frames at full size. What's wrong, honestly, then what replaces it.

## Teardown

### Looks cheap
- **The fish, the star, is a sliver.** The chase camera sits 2.6 m back and 1.45 m up, so a 0.6 m fish is ~6% of the frame;
  you can't see its face, its curl or its fins. It lies on the floor like it's already on a plate.
- **The fish model** is a lathe tube with a canvas stripe texture and flat extruded fins: no scales, no fin membranes, no
  iridescence, eyes stuck on like stickers. Bots of the same species are indistinguishable.
- **Every surface is one flat colour or a tiny canvas pattern.** Whitewash walls are blank planes with blue rectangles for
  windows (no depth, no frames, no roofs, no grime); the market floor is one red tile repeated for 190 m; the beach is a flat
  beige plane; the park is a flat green plane; the kitchen is an endless checkerboard with an open sky for a ceiling.
- **Props are boxes:** crates, counters, kiosks, stalls; ice is scattered cubes; bougainvillea are pink blobs; shoppers are
  stilts under a box; the chef is stacked boxes with a checker texture; the gull is two spheres and two flat wings.
- **Light is flat noon:** a hemisphere light washes everything, no ambient occlusion, no contact shadows, no bounce, no bloom
  on the glittering sea, no colour grading; fog only far away. Nothing feels wet, hot or sunny.
- **The world is empty and far too big for a fish.** 15 m wide streets, a 230 m beach and a park lawn with nothing on them.
  No set dressing at fish height (where the camera is).
- **The goal isn't in one look:** the sea is a thin strip at the end of a 190 m street.

### Moves stiffly
- Fish curl a little when charging and otherwise slide around flat; no anticipation, no stretch on launch, no squash and
  wobble on landing, no fin flutter, no tail whip in the air, no emotes. Bots look like sticks being dragged.
- Shoppers glide; the cat, chef and gulls swap between two poses. Nothing eases in or out.
- No render interpolation: the body is drawn at the last 120 Hz step, so motion judders on uneven frames.
- The camera floats at one distance: no look-ahead, no punch-in on a big leap, no FOV kick, no slow-mo at the splash.

### Feels floaty, laggy or unclear
- Most flops land on flat safe floor, so the flop has no stakes: hold, release, repeat 60 times.
- The slap (release on touchdown) is the best idea in the game but it's invisible: one sparkle and a chime.
- The HUD's water gauge is a small flat fish icon; you can't read where you'll dry out faster.
- Name tags crowd the frame; "Click to aim with the mouse" sits in the middle of the screen for a whole race.

### Gets boring after one round
- Courses are 155-245 m of the same street, beach or lawn: 90-130 s of near-identical flops, and almost nothing to decide
  between puddles.
- No short-term rewards (no pickups, no combos you can see, no near misses), no mid-term goals beyond a medal per course.

### No reason to come back
- Four medals tables and five fish. No levels, no cosmetics to collect, no daily goals or streaks, no collectibles, no new
  thing unlocked per session. The daily exists but nothing tells you about it.

### What the best games of its kind do that this doesn't
- **Trackmania:** short tracks (30-60 s), instant retry, medal times and ghosts, splits at checkpoints, track of the day.
- **Super Monkey Ball / Mario:** collectibles on the risky line, so the expert route is visible and tempting.
- **Sonic:** pickup trails that teach the line and reward flow; speed that builds when you chain moves.
- **Fall Guys:** obstacles with personality and readable timing, comedy, a season track of cosmetics everyone wants.
- **Jump King / Only Up:** charge jumps with height and real risk; every jump is a decision.
- **I Am Fish:** a fish with a face and character, the world at fish scale, rich real-feeling environments.

## The rebuild

### Look: a sunlit harbour at fish height
- Camera at fish level (0.7-1.0 m up, 1.7 m back, wider lens), looking a little ahead of the fish; the fish ~15% of the frame.
- Real materials from CC0 texture sets (Poly Haven, ambientCG): terracotta and cobbles that look wet in the shade, plaster
  walls with grime, painted shutters, wood with grain, steel, sand, grass; normal and roughness maps, not flat colour.
- An HDRI sky for reflections, a warm low-ish sun with tight soft shadows, contact AO, bloom on the sea's glitter and on water,
  warm colour grading and haze, so it reads hot in the sun and cool in the shade.
- Streets narrowed and filled at fish height: crates, nets, baskets, ropes, buckets, ice, lemons, pots, drains, chalk prices,
  awnings with real fabric, houses with depth (recessed windows, shutters, balconies, roofs, pipes, laundry, plants).
- The sea is in view from the start of every course and grows as you get closer.

### The fish
- New bodies per species, sculpted profiles, scale normal maps, iridescent sheen, translucent fin membranes with rays, real
  eyes (wet cornea, pupils that track the aim, blinks, squeezes), a mouth that gasps.
- Animation: anticipation curl that quivers as the charge builds, a whip and stretch on release, tail beats and a tumble in
  the air, squash and wobble on landing, a dry flop and gasp, a win spin; remote fish get the same.
- Cosmetics on the fish: hats, trails and splashes (earned, never bought).

### Feel
- Render interpolation; camera look-ahead, FOV kick on release, punch-in on big leaps; hit-stop on knocks and perfect slaps;
  slow-mo on the finish splash; landing particles per surface; screen shake scaled to the impact.
- **The slap made visible:** a landing ring shrinks to the moment of touchdown; release on it for a SLAP, dead on for PERFECT.
  Chained slaps build **Flow** (each link +4% power, up to ×4), with a growing wet trail, a rising chord and a stamp.

### Depth
- **Sun and shade:** the sun dries you fast, the shade under awnings, parasols and walls slowly. You see it (the real shadows)
  and route through it. Every flop becomes a choice.
- **Drops:** trails of water drops (+water, a counter) along good lines; shortcuts have the long trails.
- **Golden scales:** three per course on the risky lines; a per-course collection.
- **Near misses** pay ("Close shave!"); the cat, chef, gulls and boules get clear telegraphs.
- **Courses rebuilt short and dense** (40-60 s expert, 70-100 s first time) with height, shortcuts, moving parts (a fish
  conveyor, a swinging fish scale, an extractor updraft, a cart), drains that send you back, and more than one route.

### Reasons to come back
- **Catch level:** XP from every run (finish, place, medals, scales, drops, best flow, near misses), levels with a reward each:
  hats, trails, splashes, colourways, fish.
- **Three daily goals** (seeded by date, same for everyone) and a day streak; the **Daily Catch** stays with its board.
- Results that count up: time, medal, scales, drops, flow, XP bar filling, unlock reveal.
- Collection screen (the fish locker) with everything earned and what unlocks the rest.

### Order of work
1. Renderer, lighting, post, interpolation, camera. 2. The fish. 3. Materials and the world kit. 4. Sun/shade, drops,
scales, flow, near misses. 5. The four courses rebuilt. 6. Hazard characters (cat, chef, shoppers, gulls, boules). 7. XP,
cosmetics, daily goals, streak, locker. 8. HUD and screens. 9. Sound. 10. Tests, check, posters, trailer, docs.
