# Jotline

Jotline is an Obsidian plugin for quickly capturing tasks without leaving your keyboard. Run the **Add task** command, type a task in plain text, and Jotline parses it into a formatted checkbox line appended to `tasks.md`.

## Usage

Run **Add task** (via the command palette) to open the quick-capture modal, then type a task and press **Enter**. Press **Escape** to cancel.

Jotline parses your input as you type:

- **Description** — plain text.
- **Tags** — any `#word` is picked up as a tag (e.g. `#biology`, `#project-x`).
- **Priority** — a tag matching `#p1`, `#p2`, `#p3`, etc. is treated as a priority level rather than a regular tag.
- **Due date** — anything after a `>` is parsed as a date. Supports relative keywords (`today`/`tdy`, `tomorrow`/`tmr`/`tmrw`, `yesterday`/`yest`), weekday names (`mon`, `friday`, ...), and explicit dates (`2 aug`, `2 august`, `2023-08-02`).

As you type, chips above the preview light up to show which fields were detected (Description, Course, Priority, Due), and the priority chip is coloured by level. A live preview shows the resulting line before you submit.

### Example

Typing:

```
Finish lab report #biology #p1 > tmr
```

produces:

```
- [ ] Finish lab report #biology #p1 📅 2026-08-19
```

which is appended to `tasks.md` in your vault (created automatically if it doesn't exist).

Jotline only handles quick capture — it appends well-formatted lines to a task list and nothing more. It's meant to be paired with a task-viewing plugin such as [Tasks](https://obsidian-tasks-group.github.io/obsidian-tasks/) for querying, filtering, and managing what gets added (the 📅 due date format is already compatible).

## Future development

- Autocomplete for tags while typing.
- Better natural language recognition for due dates.

## Development

- Node.js 18+ required.
- `npm i` — install dependencies.
- `npm run dev` — compile `src/main.ts` to `main.js` in watch mode.
- `npm run build` — type-check and produce a production build.
- `npm run lint` — run ESLint (including Obsidian-specific rules).

### Manual install

Copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/jotline/`, then enable **Jotline** under **Settings → Community plugins**.

## API Documentation

See https://docs.obsidian.md
