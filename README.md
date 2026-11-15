# Planner

A simple to-do list that sits in a narrow panel on the right side of your screen
(about one fifth of the width), so it's always there next to whatever you're working on.

- **Sections** for anything you like: Today, Tomorrow, Work, Personal…
- **Type and press Enter** to add a task. That's it.
- **Subtasks** under any task.
- Mark anything as **Important (!)** or **Up next (▶)**. Up-next items also show in a yellow box at the top, so you always see what to do next.
- **Tick it off** when it's done.
- Bright, high-contrast colours. Click a section's rainbow dot to change its colour.
- Everything is saved automatically on your computer. Nothing is sent anywhere.

---

## Install it (the easy way)

1. Go to the **[Latest build](../../releases/tag/latest)** page.
2. Download the file for your computer:
   - **Windows:** `Planner-Setup-Windows.exe`. Double-click it. If Windows shows a blue
     "Windows protected your PC" box, click **More info**, then **Run anyway**.
     (This appears because the app isn't from a big registered publisher. It's safe.)
   - **Mac:** `Planner-Mac.dmg`. Open it and drag **Planner** into **Applications**.
     The first time, **right-click** Planner in Applications and choose **Open**, then **Open** again.
     (Mac does this for apps that aren't from the App Store.)
   - **Linux:** `Planner-Linux.AppImage`. Right-click it, choose Properties, tick
     "Allow executing as program", then double-click it.
3. Open **Planner**. It will appear on the right side of your screen.

> The installer files are made automatically a few minutes after changes are added to the
> main version of the project. If the Latest build page doesn't exist yet, it just hasn't
> been made yet.

## Quick tips

| To do this | Do this |
|---|---|
| Add a task | Type in a section's box and press **Enter** |
| Add an important task | Start with `!`, e.g. `! pay rent` |
| Add an up-next task | Start with `>`, e.g. `> finish report` |
| Add a subtask | Hover a task and click **+** |
| Edit text | Double-click it |
| Mark done | Click the square box |
| New section | Type a name in the dashed box at the bottom and press **Enter** |
| Rename a section | Double-click its name |
| Jump to typing | **Ctrl+N** (Windows/Linux) or **Cmd+N** (Mac) |
| Keep the panel above other windows | Click **Pin on top** |

Tasks are sorted for you: **up next** first, then **important**, then everything else,
and finished tasks drop to the bottom.

## Where are my tasks saved?

In a file called `planner-data.json` on your own computer:

- **Windows:** `%APPDATA%\Planner\`
- **Mac:** `~/Library/Application Support/Planner/`
- **Linux:** `~/.config/Planner/`

---

## For tinkerers: run it from the source code

You only need this if you want to change how the app works.

1. Install **Node.js** (the "LTS" version) from <https://nodejs.org>.
2. Download this project (green **Code** button → **Download ZIP**) and unzip it.
3. Open a terminal in that folder and run:
   ```
   npm install
   npm start
   ```
4. To make your own installer: `npm run dist` (it appears in the `dist` folder).

The app is built with [Electron](https://www.electronjs.org/). The files that matter are in `src/`:
`main.js` (opens the window and saves data), `index.html` + `styles.css` (the look), and
`app.js` (what happens when you click and type).
