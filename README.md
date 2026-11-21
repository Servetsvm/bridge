# Bridge Table — the robots' tables and lesson book

Written every two hours by `.github/workflows/robots.yml` (`.github/robots/robots.js`, `.github/robots/learn.js` on the
`main` branch). Cards are numbers 0–51: suit = ⌊c / 13⌋ (0 ♣, 1 ♦, 2 ♥, 3 ♠), rank = c mod 13 (0 = 2 … 12 = A).
Seats 0–3 = N E S W. Calls: a number = (level − 1) · 5 + strain (strain 0 ♣ … 3 ♠, 4 NT), or `P`, `X`, `XX`.

## live-&lt;system&gt;.json (sayc, twoone, acol, sef, precision, polish)

One system table: `boards` (the last ones played and the next hours), each with its start and end time (`t0`, `t1`,
ms), the deal `d` (four hands), the auction `a` (`[seat, call, meaning, convention]`), the play `p` (52 cards in order,
every hand open), the contract `c` (`[level, strain, doubled, declarer]`), declarer's tricks `tr`, North-South's score
`sc`, the double-dummy best contract `pc` and score `par`, North-South's IMPs against it `imp`, the double-dummy table
`dd` (tricks for each declarer in each strain), the pairs' ratings after it `rt`. `league`: the pairs, the systems and
conventions (boards, IMPs from the best, best reached), `ab` (the lesson trial: boards and tricks lost with and
without the candidate lessons).

## errors-&lt;system&gt;.json

The robots' mistakes with the hands closed (as in Bridge Table's games), the last 300 boards of each table: the deal,
auction, contract, the play `p` (tricks of `[seat, card]`), `arm` (`L` with the candidate lessons, `B` without) and
`er`: `[trick, seat, card played, better card, tricks lost, context, kind played, kind better]`, double dummy.

## lessons.json

STOPPED on 2026-11-08 (four books, each lost more tricks than no book): the file is kept but no longer changes.

The lesson book. `raw`: every mistake ever counted, by context and `played kind>better kind` (weighted by the tricks
lost). `cand`: the lessons on trial; `acc`: the accepted ones (the app's robots use them), with how many fewer tricks
they lost (`gain`, %) and a Turkish summary; `hist`: the trials.

Context: `D` declarer's side / `F` defence, `N` notrump / `S` a suit contract, the card's place in the trick 0–3.
Kinds — leading: `T` trumps, `L`/`M`/`S` a long (4+) / three-card / short suit with `h` an honour or `x` a low card;
following: `W` winning the trick, `l` the lowest card, `m` one in between; void: `R` a ruff, `dh`/`dx` a discard.
