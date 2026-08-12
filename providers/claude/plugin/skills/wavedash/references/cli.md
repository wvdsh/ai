# CLI Workflow

Canonical docs:

- Installation: https://docs.wavedash.com/cli/installation
- Authentication: https://docs.wavedash.com/cli/authentication
- Configuration: https://docs.wavedash.com/cli/configuration
- Environment variables: https://docs.wavedash.com/cli/environment-variables
- Commands: https://docs.wavedash.com/cli/commands
- Quickstart: https://docs.wavedash.com/getting-started/quickstart
- CI/CD: https://docs.wavedash.com/tutorials/ci-cd

## Install the CLI

If `wavedash --version` is unavailable, guide the user to install the CLI.

macOS, Linux, WSL:

```bash
curl -fsSL https://wavedash.com/cli/install.sh | sh
```

Homebrew:

```bash
brew install wvdsh/tap/wavedash
```

Windows PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; irm https://wavedash.com/cli/install.ps1 | iex
```

Verify:

```bash
wavedash --version
```

## Authenticate

Local desktop:

```bash
wavedash auth login
wavedash auth status
```

CI, cloud agents, or headless environments:

```bash
export WAVEDASH_TOKEN=wd_...
wavedash auth status --json --no-color --no-update-check
```

Use `WAVEDASH_TOKEN` for automation. Do not ask an agent to complete browser
login in a headless environment. To store a token without exposing it in shell
history, pipe it through stdin when supported:

```bash
printf '%s' "$WAVEDASH_TOKEN" | wavedash auth login --token-stdin --no-color --no-update-check
```

If an installed CLI rejects `--json`, `--no-color`, `--no-update-check`, or
`--token-stdin`, it is older than the agent-friendly CLI. Retry the command
without the unsupported flag and tell the user to update the CLI.

## Initialize the project

Interactive local setup:

```bash
wavedash init
```

Scripted setup with an existing team and game:

```bash
wavedash init --team-id TEAM_ID --game-id GAME_ID --upload-dir dist --engine custom --force --json
```

Scripted setup that creates a team and game:

```bash
wavedash init --team-name "My Studio" --game-title "My Game" --upload-dir dist --engine custom --force --json
```

Verify `wavedash.toml` has the right `game_id` and `upload_dir`. The upload
directory must contain the built `index.html`.

## Override config without editing wavedash.toml

Every `wavedash.toml` field has a `WAVEDASH_*` counterpart that wins for one
run. Prefer these over rewriting a file the user has committed:

| Variable | Overrides |
|----------|-----------|
| `WAVEDASH_GAME_ID` | `game_id` |
| `WAVEDASH_UPLOAD_DIR` | `upload_dir` |
| `WAVEDASH_ENTRYPOINT` | `entrypoint` (engine-less builds only) |
| `WAVEDASH_GODOT_VERSION` | `[godot].version` |
| `WAVEDASH_UNITY_VERSION` | `[unity].version` |

```bash
WAVEDASH_GAME_ID=GAME_ID wavedash build push --json --no-color --no-update-check
```

Precedence is `--game-id`, then the variable, then the file. The CLI prints an
`env override:` line for each override a command actually reads, so the output
says where a value came from.

A blank or whitespace-only value counts as unset and falls back to the file —
don't export an empty variable expecting it to clear a field.

With no `wavedash.toml` present, the CLI still runs as long as the variables
supply what the command reads, which suits a scratch checkout. `WAVEDASH_TOKEN`
alone does not count: it isn't a config field.

Two combinations are refused by `dev` and `build push` rather than guessed:
both engine version variables at once, and a version variable that names a
different engine than the config declares. `WAVEDASH_ENTRYPOINT` is also
refused when an engine is in play, because engine builds would ignore it.

## Test, upload, publish

Build the game with the project’s normal build command, then test locally:

```bash
wavedash dev
```

Upload a build:

```bash
wavedash build push --json --no-color --no-update-check
```

The upload command returns or prints a build ID. Publishing makes that build
live for players, so only do it when the user asks:

```bash
wavedash publish BUILD_ID --json --no-color --no-update-check
```

After publishing, open the public game URL in a fresh browser and verify the
uploaded build works end to end.

## Reset playtest data

Playtesting accumulates achievements, cloud saves, stats, leaderboard entries,
paid-content entitlements, and UGC. Clearing them gives a clean slate for the
next test run. This is destructive, so only run it when the user asks:

```bash
wavedash clear-playtest-data --force
```

Only sandbox data is affected — players of the published game are untouched.

`--force` (alias `--yes`, short `-y`) is **required** here. The command refuses
to run without confirmation when stdin is not a terminal, which is the usual
case for an agent, and there is no prompt to answer.

With no category flags it clears everything for every player. Narrow it before
reaching for the broad form:

```bash
wavedash clear-playtest-data --achievements --stats --force
wavedash clear-playtest-data --username somePlayer --cloud-saves --force
```

Categories: `--achievements`, `--cloud-saves`, `--stats`, `--leaderboards`,
`--paid-content-entitlements`, `--user-generated-content`.

Categories are not reconciled against each other, so a partial clear can leave
a state normal play can't reach. Clearing `--achievements` without the stat that
triggers them leaves the stat above its threshold while the achievement reads as
locked, and it stays that way until the game writes that stat again — triggers
are only re-evaluated on a stat write. Clear a stat-triggered achievement
together with its stat, or use the no-flag form.

Cloud saves are deleted remotely only. The browser keeps its local IndexedDB
copy and can sync it back up, so don't report a save as gone on the strength of
this command alone.

A successful run means deletion was scheduled, not finished. Don't immediately
assert the data is gone — re-read it if the user needs confirmation.
