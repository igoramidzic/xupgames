# Mini Game Mix: map replacements

## Current change

The two map-based challenges have been removed from the playable rotation:

- **Guess the distance**
- **Point on the map**

All eight replacements described below are now implemented. Together with Draw a straight line, Find this emoji, Guess the percentage, Click the circle center, and Guess the battery, the live rotation now contains 13 challenges.

The old map identifiers, fields, and submission scoring paths remain only so previously stored or already-running rounds stay valid during rollout. They are not eligible for new rounds, and the map renderer, city catalog, and browser dependency are gone.

## What the research suggests

Mini Game Mix has a 3.2-second reveal, 10 seconds of play, and a 4-second result screen. Good additions therefore need to be understandable from one short command, playable simultaneously, and finish cleanly inside 10 seconds.

- Nintendo describes WarioWare microgames as lasting only a few seconds and requiring players to “think fast and act faster.” That prompt-first structure is the closest reference for the pace of Mini Game Mix. ([WarioWare: Move It!](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/WarioWare-Move-It--2403866.html))
- Nintendo's Online Mariothon uses a rotating series of five minigames. That supports keeping the mix varied instead of letting one mechanic dominate a session. ([Super Mario Party: Online Mariothon](https://media.nintendo.com/supermarioparty/online/))
- Human Benchmark demonstrates that reaction, visual-memory, and sequence-memory challenges can be explained in one sentence and played with a single input surface. ([Reaction Time](https://humanbenchmark.com/tests/reactiontime), [Visual Memory](https://humanbenchmark.com/tests/memory), [Sequence Memory](https://humanbenchmark.com/tests/sequence))
- Mario Party's free-for-all catalog repeatedly uses one clear verb—count, match, trace, drop, stop, or jump—then varies the timing or visual pressure. ([Mario Party Superstars: Free-for-all minigames](https://mariopartysuperstars.nintendo.com/minigames/free-for-all/))

The ideas below borrow those broad interaction patterns, not their names, characters, art, or exact rules.

## Implemented additions

### 1. Flashback Tiles

**Command:** “Remember the lit tiles.”

A 5×5 board lights five to eight tiles for roughly 1.5 seconds. The lights disappear and the player taps every remembered tile in any order.

**Why it fits:** It introduces visual memory, which is absent from the current mix. The entire interaction is one board, works naturally with touch and mouse, and can use numbered keyboard shortcuts or arrow-key navigation.

**Scoring:** Award most points for correct recall, subtract for false tiles, and use completion time only as a small tiebreaker. Everyone receives the same server-generated pattern.

**Design note:** Use shapes or icons in addition to color so the pattern does not depend on color vision.

### 2. Copycat Sequence

**Command:** “Repeat the pattern.”

Four large pads flash a sequence of five or six steps. When the playback ends, the player repeats the sequence in order. A correct answer can add one short bonus step if time remains.

**Why it fits:** It tests ordered memory rather than the spatial recall used by Flashback Tiles. Four large targets are comfortable on phones and easy to map to arrow keys.

**Scoring:** Points for every correct prefix, a completion bonus, and a small speed bonus. One wrong press locks the achieved prefix instead of reducing the whole round to zero.

**Design note:** Give every pad a symbol and position as well as a color.

### 3. Crowd Count

**Command:** “Count the bouncing beans.”

Small characters cross or bounce through the stage for six seconds, sometimes overlapping or briefly reversing direction. Players then choose the total from four nearby answers.

**Why it fits:** It creates a lively spectator moment without a map, physics-heavy controls, or text knowledge. Mario Party uses the same broad counting pattern in Roll Call and Goomba Spotting, which suggests it works well as a short free-for-all challenge.

**Scoring:** Full points for the exact count, partial credit for being one away, and no speed bonus until the animation has ended. The server owns the spawn script and answer.

**Design note:** Keep objects visually distinct from the background and honor reduced-motion settings with a lower-motion presentation of the same count.

### 4. Drop Zone

**Command:** “Drop it in the target.”

A package moves left and right above a landing pad. The player taps once to release it. Run three increasingly fast drops during the round.

**Why it fits:** It is a satisfying one-button timing game with a visible skill curve and almost no onboarding. Mario Party's Trap Ease Artist similarly centers on dropping something at the right moment, while Night-Light Fright rewards stopping close to a target.

**Scoring:** Measure horizontal distance from the pad center for each drop, average the three attempts, and add a perfect-drop bonus. The server generates the motion parameters and validates the submitted release times.

**Design note:** Animate from an authoritative start time so every client sees the same movement phase.

### 5. Shadow Match

**Command:** “Pick the matching shadow.”

A colorful object appears in the center with four silhouettes around it. The object may be rotated, but only one silhouette has the same outline. The player solves as many cards as possible before time expires.

**Why it fits:** It adds shape recognition without requiring reading, geography, trivia knowledge, or precise drawing. Large answer cards work with touch, mouse, and the number keys.

**Scoring:** Fixed points per correct match, a streak bonus, and a penalty that briefly pauses the board after a wrong choice.

**Design note:** Generate a curated set of unmistakable silhouettes; fully random geometry will create ambiguous answers.

### 6. Flag Frenzy

**Command:** “Match the signal.”

A caller displays one of four symbols and the player presses the matching pad. The pace accelerates across six to ten signals. This adapts the quick matching pressure of Mario Party's Shy Guy Says and Mushroom Mix-Up to a private browser board.

**Why it fits:** It is immediately legible, supports repeated actions inside one round, and feels energetic without requiring button mashing.

**Scoring:** Points per correct signal, increasing with the streak; wrong or premature presses reset the multiplier.

**Design note:** Use icon-plus-color pairs and keep the spatial mapping stable for accessibility.

### 7. Brake Check

**Command:** “Stop closest to the line.”

Hold a button to accelerate a vehicle or fill a power meter, then release before crossing a hidden danger threshold. The meter becomes less predictable near the end, creating a simple risk-versus-reward decision.

**Why it fits:** It adds a hold-and-release control that the current mix does not use. Mario Party's Slot-Car Derby and Rockin' Raceway both make excess speed a risk rather than rewarding pure button speed.

**Scoring:** Score closeness to the target, with a steep penalty for crossing it. Use two attempts and keep the better result so one mistake does not ruin the round.

**Design note:** Do not require rapid tapping; holding is more comfortable and produces less hardware-dependent scoring.

### 8. Signal Snap

**Command:** “Tap when it changes.”

The stage waits for a randomly timed visual change. Players tap as soon as it appears, with a false-start penalty. Run three short signals and use the median response.

**Why it fits:** The Human Benchmark reaction test proves the interaction is instantly understandable, and three attempts create good result-screen suspense.

**Scoring:** Use broad timing bands rather than exact millisecond rankings, discard a player's worst valid attempt, and heavily penalize early taps.

**Design note:** Display latency, input hardware, network delivery, and browser scheduling all affect measured reaction time, so scoring uses broad response bands and the median rather than presenting an exact cross-device leaderboard as authoritative.

## Implementation notes

Each challenge ships as a complete Mini Game Mix slice:

- The server generates a bounded, discriminated challenge payload for the shared round.
- One validated, discriminated submission mutation routes the answer to the matching scorer and rejects wrong-game, malformed, duplicate, or late submissions.
- Scores and bounded result details are computed on the server; clients never submit a score.
- The web room renders one large, tactile interaction surface with touch, mouse, and keyboard-operable controls.
- Motion-driven games use the shared round start, and Crowd Count supplies a reduced-motion presentation.
- Focused engine tests cover generation bounds and correct-versus-wrong scoring for every addition. UI tests smoke-test all eight apparatuses and exercise representative submissions.

The existing rollout-compatibility boundary remains intact: retired map IDs and old stored fields still validate, but neither map challenge can be selected for a new round and no map UI or browser mapping dependency is present.
