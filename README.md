# GAS

GAS Assists and Shortcuts. An interactive terminal menu for the git and GitHub chores I do twenty times a day, so I stop retyping the same commands and flags.

Built with Deno and [Cliffy](https://cliffy.io), compiled to a single binary.

## Install

```sh
deno task build          # compiles gas.ts -> ./gas
ln -s "$(pwd)/gas" ~/bin/gas   # or anywhere on your PATH
```

The symlink means every rebuild is instantly live; no copy step.

You need `git` and the [GitHub CLI](https://cli.github.com) (`gh`, authenticated) on your PATH.

## Usage

```sh
gas             # opens the main menu
gas -a          # preselects "All time" in PR stats (--all-time works too)
```

Everything is arrow keys and enter from there.

### Pull Requests

- **Stats**: merged-PR counts, share, and average time to merge, per author. Pick a range first: all time, latest 200, last X days, or last X PRs.
- **My reviews**: open PRs waiting on your review; open one in the browser or check it out.
- **Checkout open PR**: pick from the open PR list, `gh pr checkout` does the rest.

### Git

- **Switch branch** (searchable), **Pull**, **Push**.
- **Commit**: checkbox file staging (tracked files pre-checked), then a message prompt.
- **Amend last commit**: stage extra files into the previous commit with `--no-edit`, so the message stays untouched. Warns when the commit is already pushed (you'll need `--force-with-lease`). Optionally appends `[skip ci]` to the message.

### Custom Commands

Save any shell command under a name and run it from the menu later. Stored in `~/.config/gas/commands.json`, so they follow you across repos. Add and remove from the menu itself.

### Local prune

Batch-delete local branches matching a pattern (substring or regex). Deliberately paranoid: the current branch and `main`/`master`/`develop` are always excluded, matches go through a checkbox review, then a yes/no confirm, then you type `DELETE`. Deletion is `git branch -d` only; unmerged branches are kept and reported, never force-deleted.

## Config

`gas.config.json` in the current directory, falling back to `~/.config/gas/config.json`:

```json
{
  "ignoreAuthors": ["github-copilot", "dependabot*", "*[bot]"]
}
```

`ignoreAuthors` filters PR stats. Matching is case-insensitive and `*` wildcards work.

## Architecture

Everything is a plugin. The main menu is just a list of `Plugin` objects, and a plugin is just a `MenuItem`: a label and a `run()`.

```text
gas.ts                  entry point (6 lines)
src/
  core/
    types.ts            MenuItem / Plugin interfaces
    ui.ts               header, prompts, and the generic menu() loop
    shell.ts            run, runInherited, gh
    config.ts           flags + config loading
  plugins/
    index.ts            the registry
    pr.ts, git.ts, custom.ts, prune.ts
```

`menu(title, items)` renders any list of items as a looping select with a Back option, and nests freely; it also accepts a function for lists that change between passes (that's how Custom Commands refreshes after an add).

To add a feature: create `src/plugins/whatever.ts` exporting a `Plugin` (a single action, or a whole submenu via `menu()`), add one line to `src/plugins/index.ts`, rebuild. Done.

## Development

```sh
deno run --allow-run --allow-env --allow-read --allow-write gas.ts   # run from source
deno check gas.ts                                                    # type-check
deno task build                                                      # compile
```
