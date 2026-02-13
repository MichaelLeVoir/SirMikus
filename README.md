# PRD Visual Note Board

A lightweight browser app for product managers to:

- Capture PRD-oriented notes in draggable cards.
- Keep visual hierarchy using note type + hierarchy level.
- Group related cards with color-coded group hulls.
- Export structured JSON to a custom ChatGPT / endpoint URL.

## Run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Key workflow

1. Create groups for each workstream or feature area.
2. Add notes with title/description/type/hierarchy.
3. Drag notes around the board for visual organization.
4. Set a custom URL and either send payload directly or copy JSON.

Data persists in `localStorage`.
