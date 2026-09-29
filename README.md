# Collapse Tests

> **One click folds the tests. One click brings them back.**

<img width="1511" height="905" alt="wrap-tests" src="https://github.com/user-attachments/assets/29ae47e4-d406-47bb-b97f-182313d972a1" />

A Chrome extension for GitHub pull requests. It adds a **Tests** item to the "File filter"
menu, right next to `.md` and `.ts`, with the same checkmark.

Uncheck it and every `.test` file in the diff folds away. Check it again and they are back.

## Install, 30 seconds

```bash
git clone https://github.com/AmineAffifSkello/collapse-tests.git
```

Clone it somewhere you will keep. Chrome reads that folder every time it starts, so a
throwaway directory means a broken extension the day you clean it up.

1. Open `chrome://extensions`
2. Turn on **Developer mode**, top right
3. Click **Load unpacked** and pick the `collapse-tests` folder you just cloned
4. Reload your pull request tab

No git? Hit **Code** then **Download ZIP** at the top of this page, unzip it somewhere
permanent, and start from step 1.

Chrome will show a "Disable developer mode extensions" prompt on some launches. That is
Chrome's standard warning for any extension not installed from the Web Store, not a
warning about this one.

## Update it

```bash
git pull
```

Then click the reload icon on the Collapse Tests card in `chrome://extensions`. Chrome
never auto-updates an extension loaded this way, so nothing changes until you do those
two things.

## Use it

Open a pull request, **Files changed**, then the **File filter** menu. The **Tests** item
sits at the bottom, checked by default.

| You do | What happens |
|---|---|
| Uncheck **Tests** | Every file with `.test` in its path folds |
| Check **Tests** | They unfold |
| Scroll further down the PR | Files loading in fold too, as long as **Tests** is unchecked |
| Come back to the PR later | Your choice is remembered, per pull request |
| Look at the file tree on the left | Test files are greyed out and no longer clickable while **Tests** is unchecked |
| Look at a folded test file in the diff list | Its header is greyed out too, and inert. Check **Tests** again to get it back |

The counter next to **Tests** shows how many test files are in the diff.

## Why it exists

GitHub already lets you filter files in a pull request. It just cannot do this one thing.

| What you want | What GitHub offers |
|---|---|
| Fold the test files | Nothing |
| Fold by extension | Unchecking `.ts` takes your source files down with the tests |
| Fold what you already read | Mark each file **Viewed**, one manual click per file, and it changes your review state |
| Fold them for everyone, forever | `linguist-generated` in `.gitattributes`, but that is a repo commit, it applies to the whole team, and it labels your tests as generated code |

Collapse Tests is the missing option: per pull request, reversible, one click, and it
binds you alone.

## What it does not do

- It does not send anything anywhere. There is no network call in the code at all.
- It asks for **zero Chrome permissions**. Check `manifest.json`, the list is empty.
- It does not touch your repository.
- It does not mark anything as viewed, so your review state stays honest.
- It **folds** files, it does not remove them. Everything is one click away.

The only thing it stores is a single `"0"` in your browser, per pull request, to remember
that you unchecked the filter.

## If the Tests item does not show up

GitHub changes its interface regularly. Open the pull request, open the **File filter**
menu, then paste the contents of `probe.js` into the Chrome console and send the output.
It prints exactly which part of the page stopped matching.

---

## For developers

### How it works

| Point | Choice |
|---|---|
| Menu item | cloned from an existing item, so the Primer classes match, then `textContent` only |
| Folding | clicks GitHub's real collapse button, no CSS. The state stays consistent with the native UI |
| Finding files | `div[role="region"][id^="diff-"]` plus `h3 a code`, never the hashed CSS-module classes |
| Finding the button | `button:has(> svg.octicon-chevron-down)`, scoped to the region |
| Filter checked | the script forces nothing, otherwise it would reopen files you folded by hand |
| Filter unchecked | folding is applied continuously, for files that load later |
| File tree rows | matched through their `#diff-<sha>` anchor, which is also the diff region's `id`, so no dependency on tree classes |
| Diff file headers | matched through `[data-diff-header-wrapper]` inside the region. The extension's own collapse clicks bypass the blocker through an internal flag, otherwise re-checking could never unfold anything |
| Greying out | an inline `color` and a `not-allowed` `cursor`, both with `important`, so they win over GitHub's own `!important` rules, plus a `collapse-tests-muted` class and `aria-disabled` |
| Blocking the click | a capture listener on pointer, mouse and Enter/Space events. Not `pointer-events: none`, which makes the row transparent to hit testing and hands the click to the parent folder |
| Storage | `localStorage`, key `collapse-tests:<owner>/<repo>/<pr>` |

The `matches` is `https://github.com/*` and not `.../pull/*` on purpose: Chrome does not
inject content scripts on SPA navigations, so narrowing it would break going from a repo
to a pull request. The script exits immediately when the URL is not a diff page.

### Tests

```bash
./test/run.sh
```

76 assertions, no npm dependency. The bench replays real GitHub markup for a
`/pull/42/changes` page served on the right URL path, then drives headless Chrome over
CDP. It covers injection, folding and unfolding, files loaded after the fact, React
re-rendering the menu, false positives (`test/`, `.spec`, `Contest.ts`), blocked
`localStorage`, the absence of a click loop, scan cost, and that a run leaves no state behind for the next one. Exceptions and console errors
are captured and reported.

| Measure | Value |
|---|---|
| Full scan of a 303 file diff | 0.5 ms, about 3% of a frame at 60 fps |
| DOM mutations at rest, menu open | zero |
| Loop guard | 6 clicks max per file per target state |

### Known limits

- The counter reflects test files present in the DOM. If GitHub really drops off-screen
  files, it undercounts. `probe.js` answers that question.
- Checking the box again only unfolds files present in the DOM at that moment.
- Manually unfolding a `.test` file while the filter is unchecked folds it again. That is
  what the filter means.
- The selectors follow GitHub's current structure. If it changes, the extension does
  nothing at all rather than breaking the page.

### Logo

Test tube on a GitHub dark tile. Vector sources in `src/`:

| File | Used for |
|---|---|
| `src/icon.svg` | 48 and 128, with the `#30363D` border |
| `src/icon-small.svg` | 16 and 32, thicker strokes, border removed |

Palette: background `#0D1117`, border `#30363D`, glass `#E6EDF3`, liquid `#3FB950`.

```bash
rsvg-convert -w 16  -h 16  src/icon-small.svg -o icons/icon16.png
rsvg-convert -w 32  -h 32  src/icon-small.svg -o icons/icon32.png
rsvg-convert -w 48  -h 48  src/icon.svg       -o icons/icon48.png
rsvg-convert -w 128 -h 128 src/icon.svg       -o icons/icon128.png
```
