# Mini Game Mix ideas

Mini Game Mix is an official Xup Games playlist of 10, 15, 20, or 25 short, score-based challenges. A full game alternates between a shared random-selection spinner, a timed mini-game, and round scores. New mini-games should plug into that lifecycle without adding shared fields to rooms or memberships.

## Shipped first

- **Draw a straight line** — Draw from a generated start point to an end point in one stroke. Score combines server-calculated straightness and completion time.
- **Find this emoji** — Pick a random target, scatter 5–10 copies among repeatable decoys, and find every exact match. Score combines completion time and penalties for wrong clicks.

## Next candidates

- **Guess the percentage** — Show a multi-color pie chart, name one color, and ask players to estimate its percentage.
- **Whack-a-mole** — Hit targets as they briefly appear; score correct hits, misses, and reaction time.
- **Click the circle center** — Show an irregular or partially obscured circle and score the distance from the player’s click to its true center.
- **Guess the distance** — Show two map points and ask for the distance in miles or kilometers.
- **Point on a map** — Name a city or place and score how close the player clicks on the map.

## Parked

- **Battery percentage** — Show a battery fill and ask players to estimate the charge. This overlaps with Guess the percentage, so keep it parked unless a stronger visual twist makes it distinct.

## Extension checklist

For each new mini-game:

1. Add a stable mini-game ID and presentation metadata to the internal mini-game registry.
2. Generate the same authoritative round payload for every player.
3. Validate the submission and calculate a 0–1,000 score on the server.
4. Respect the shared selection, play, round-results, timeout, late-join, and final-score lifecycle.
5. Add focused scoring, wrong-round access, timeout, input, responsive, keyboard, and reduced-motion tests.

Map-based candidates will need an explicit provider, attribution, privacy, and offline/failure-state decision before implementation.
