# MDITA LSP for VS Code: design

Date: 2026-09-10

## Purpose

Integrate the [mdita-lsp](https://github.com/aireilly/mdita-lsp) language server
into VS Code, giving Markdown DITA, MDITA, and MDITA map authors the same
capabilities that `LSP-mdita` provides in Sublime Text.

The extension is modelled on
[mdita-marksman-vscode](https://github.com/aireilly/mdita-marksman-vscode),
which wraps a different server. Build tooling, repository layout, and the
`.vscode/` launch configuration carry over. Everything that touches the
protocol is rewritten against what `mdita-lsp` actually implements.

## What the server provides

Facts established by reading the server source, all of which constrain the
client:

- The binary is `mdita-lsp`. It speaks LSP over stdio and takes no subcommand.
  `--stdio` is accepted and ignored.
- Release assets are named `mdita-lsp-<goos>-<goarch>`, with `.exe` appended on
  Windows. Five platform pairs are published.
- `initializationOptions` is never read.
- `workspace/didChangeConfiguration` ignores its payload. It re-reads
  `.mdita-lsp.yaml` from disk and refreshes diagnostics.
- `executeCommandProvider` advertises `mdita-lsp.createFile`,
  `mdita-lsp.addToMap`, and `mdita-lsp.ditaOtBuild`.
- `mdita-lsp.ditaOtBuild` takes `[mapUri, format]` and reports progress through
  `window/showMessage` and `window/logMessage`.
- `mdita-lsp.createFile` writes the file server-side and does not open it.
- No custom status notification is sent, and no document count is exposed.
- No `experimental` client capability is read.
- Code lenses carry reference counts, including counts of zero.

## Approach

Source is split into small modules rather than following marksman's
single-file structure. Marksman's `extension.ts` is 450 lines; the feature set
here is larger, and the pure logic is worth testing without an extension host.

The build setup stays as it is in `mdita-marksman-vscode`: webpack with
`ts-loader`, `.eslintrc.json`, and the same `tsconfig` compiler options.

## Dependencies

Runtime dependencies reduce to `vscode-languageclient@^9`.

| Marksman dependency | Disposition |
|---|---|
| `node-fetch@2` | Dropped for the global `fetch` in Node 18 and later |
| `which@2` | Dropped; the search covers directories outside `PATH` |
| `npm@^7` | Dropped; it was never imported |

## Module layout

| Module | Responsibility | Imports `vscode` |
|---|---|---|
| `src/extension.ts` | `activate` and `deactivate`; wiring | yes |
| `src/config.ts` | Reads the `mdita-lsp.*` settings | yes |
| `src/locate.ts` | Binary resolution order; release asset naming | no |
| `src/download.ts` | Fetches a release asset into global storage | yes |
| `src/client.ts` | Language client construction, selector, middleware | yes |
| `src/commands.ts` | Contributed command implementations | yes |
| `src/status.ts` | Status bar item bound to client state | yes |
| `src/mapfile.ts` | Map detection and map selection | no |

`locate.ts` and `mapfile.ts` are pure, so their tests run under plain mocha.

## Binary resolution

First hit wins:

1. `mdita-lsp.customCommand`, split on spaces, run from
   `mdita-lsp.customCommandDir` when that is set. A command that cannot be run
   is an error, with no fallback to the later steps.
2. `mdita-lsp` on `PATH`, with `.exe` on Windows.
3. `~/.local/bin`, `~/go/bin`, `/usr/local/bin`. These mirror the directories
   that `LSP-mdita/plugin.py` searches, and `make install` targets the first.
4. A previously downloaded copy under `globalStorage/<pinned tag>/`.
5. Download of the platform's release asset.

The pinned server release is `v1.0.1`.

| `os.platform()` | `os.arch()` | Asset |
|---|---|---|
| `linux` | `x64` | `mdita-lsp-linux-amd64` |
| `linux` | `arm64` | `mdita-lsp-linux-arm64` |
| `darwin` | `x64` | `mdita-lsp-darwin-amd64` |
| `darwin` | `arm64` | `mdita-lsp-darwin-arm64` |
| `win32` | `x64` | `mdita-lsp-windows-amd64.exe` |

Any other pair throws, naming the platform and architecture.

Server arguments are empty.

## Client wiring

The document selector covers `markdown` and `mditamap` on the `file` scheme.

Middleware has two responsibilities.

`executeCommand` intercepts `mdita-lsp.createFile`. The server writes the file,
so the interception forwards through `next` first and then opens the result in
an editor. `LSP-mdita/plugin.py` performs the same interception through
`on_pre_server_command`.

`provideCodeLenses` drops lenses whose title begins with `0 ` while
`mdita-lsp.codeLens.hideZeroReferences` is true, matching
`on_server_response_async` in `plugin.py`.

Marksman's `ExperimentalFeatures` static feature is not carried over, because
the server reads no experimental capabilities. Marksman's error handler, which
shuts the client down on the first protocol error and declines to restart, is
also dropped. The library default suits a server that gets rebuilt and
reinstalled while a workspace is open.

The language client registers the three server commands itself from
`executeCommandProvider`. Contributed command identifiers avoid those three, so
marksman's register-inside-a-try-catch workaround is unnecessary.

## Contributed commands

| Identifier | Title |
|---|---|
| `mdita-lsp.restartServer` | MDITA LSP: Restart Server |
| `mdita-lsp.showOutputChannel` | MDITA LSP: Show Output |
| `mdita-lsp.reloadConfiguration` | MDITA LSP: Reload Configuration |
| `mdita-lsp.build.xhtml` | MDITA LSP: Build with DITA-OT (XHTML) |
| `mdita-lsp.build.dita` | MDITA LSP: Build with DITA-OT (DITA) |

A build command resolves its map from the active editor when that editor holds
a `.mditamap` file or a `.md` file declaring `$schema` with a value ending in
`map.rng` or `map.xsd`. Otherwise it offers a quick pick over `**/*.mditamap`
in the workspace. It then sends `workspace/executeCommand` with
`mdita-lsp.ditaOtBuild` and `[mapUri, format]`. No client-side progress UI is
built, because the server already reports through `window/showMessage`.

## Settings

| Setting | Type | Default |
|---|---|---|
| `mdita-lsp.customCommand` | string | unset |
| `mdita-lsp.customCommandDir` | string | unset |
| `mdita-lsp.codeLens.hideZeroReferences` | boolean | `true` |
| `mdita-lsp.trace.server` | `off`, `messages`, `verbose` | `off` |

Server behaviour is configured only through `.mdita-lsp.yaml` in the workspace
root or `~/.config/mdita-lsp/config.yaml`. No VS Code setting reaches the
server, since `initializationOptions` is unread and the configuration
notification carries no payload the server inspects. The README states this and
points at the server's configuration reference.

## Activation

```json
"activationEvents": [
  "workspaceContains:.mdita-lsp.yaml",
  "workspaceContains:**/*.mditamap",
  "onLanguage:mditamap"
]
```

Gating on a workspace marker keeps the server away from Markdown projects that
have nothing to do with DITA. Contributed commands activate the extension
implicitly on VS Code 1.74 and later, so `onCommand` entries are not listed.

A file system watcher on `**/.mdita-lsp.yaml` sends
`workspace/didChangeConfiguration` on create, change, and delete.
`mdita-lsp.reloadConfiguration` sends the same notification on demand, which
covers `~/.config/mdita-lsp/config.yaml`; that file sits outside the workspace
and cannot be watched.

## Status bar

Bound to `client.onDidChangeState`, since no status notification exists.

| Client state | Text |
|---|---|
| Starting | `$(sync~spin) MDITA` |
| Running | `$(check) MDITA` |
| Stopped | `$(error) MDITA` |

The item's command opens the output channel. Its tooltip names the resolved
binary path and the version string reported by `mdita-lsp --version`.

## Static contributions

- `syntaxes/mditamap.tmLanguage.json` registers the `mditamap` language with a
  grammar that includes `text.html.markdown`.
- `snippets/mdita.code-snippets` ports the twelve tab triggers from
  `LSP-mdita/snippets`, contributed for `markdown` and `mditamap`.
- Front matter key completions are not ported. The server completes YAML keys
  and documents them on hover; `MDITA.sublime-completions` exists only because
  Sublime's LSP package cannot.

## Error handling

| Situation | Behaviour |
|---|---|
| Unsupported platform | Error notification naming platform and architecture; no client starts |
| Download fails | Error notification with a button opening the releases page; a later restart retries |
| Binary starts and exits | The library restart handler retries, then the status bar shows the error state and the output channel holds the transcript |
| `customCommand` resolves to nothing | Error notification naming the setting; the remaining resolution steps are skipped |

## Testing

Mocha runs against the two pure modules with no extension host:

- `releaseAssetName` across all five supported platform pairs
- The throw on an unsupported pair
- Resolution precedence, against an injected filesystem and environment
- Map detection for `.mditamap`, for `.md` declaring a map schema, and for
  ordinary `.md`

`@vscode/test-electron` replaces the deprecated `vscode-test@1.5` for the
activation smoke test.
