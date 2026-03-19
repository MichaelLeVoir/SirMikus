# Last Light: Ten Minutes

A lightweight, mobile-first browser roguelike designed for iPhone Safari.

## Core loop

- Tap **Start** to begin a run and trigger the fixed ten-minute doom clock.
- Tap enemies to attack; then the surviving enemies take their turn.
- Clear a wave to choose **one** of three power-ups.
- Every 5 levels includes a mini-boss, every 10 levels includes a boss, and when the timer expires the final boss appears immediately.
- Current run state persists in `localStorage`, so you can leave the run and resume it later.

## Stats and modifiers

The run focuses on simple stats:

- **Damage**
- **Defense**
- **Health**

Power-ups add lightweight action-RPG modifiers such as:

- burn chance and burn damage-over-time
- multi-hit chance
- splash damage
- thorn retaliation
- negative timer modifiers that either remove time directly or speed up the countdown

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` in a browser.
