# MDITA LSP for VS Code

[![CI](https://github.com/aireilly/lsp-mdita-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/aireilly/lsp-mdita-vscode/actions/workflows/ci.yml)

Integrates the [mdita-lsp][server] language server into VS Code for authoring
the Markdown source formats of the [org.lwdita][lwdita] DITA-OT plug-in:
Markdown DITA (`md`, `markdown`), MDITA (`mdita`), and MDITA maps
(`mditamap`).

Every feature comes from a markdown construct that the plug-in converts to DITA
XML. The server validates, completes, and navigates that syntax so problems
surface while you write instead of during a DITA-OT build.

This is the VS Code counterpart to [LSP-mdita][sublime], which wires the same
server into Sublime Text.

## Features

Everything the [mdita-lsp][server] language server supports:

- Document and workspace symbols from headings.
- Completion for inline links, heading anchors, keyrefs, conrefs, task section
  headings, and YAML front matter keys.
- Hover for links, headings, YAML keys, keyrefs, conrefs, task sections, and
  the task structure the plug-in derives implicitly.
- Go to definition and find references for headings, links, keyrefs, and
  conrefs.
- Diagnostics covering broken and ambiguous links, missing front matter,
  missing short descriptions, heading hierarchy, `$schema` values, MDITA
  profile violations, footnotes, keyref resolution, conref resolution, and map
  validation.
- Code lenses carrying reference counts on headings.
- Rename refactoring across files.
- Code actions to create a missing file, add front matter, add to a map, add
  task sections, fix non-breaking whitespace, repair footnotes and heading
  levels, and run a DITA-OT build.
- DITA-OT build integration for the `xhtml` and `dita` output formats.
- Formatting: table alignment, trailing whitespace cleanup, heading spacing,
  and a trailing newline. Tables realign on save.
- Inlay hints resolving link, keyref, and conref targets.
- Semantic token highlighting for `{.class}` block attributes.
- Linked editing of heading text.
- Document highlight for a heading and the references to it in the same file.
- Folding ranges for headings and YAML front matter.
- Selection range expansion by line, element, and section.
- File rename refactoring, updating markdown links and map references.
- Map support for `.mditamap` files and `.md` files declaring the DITA map
  schema.
- DITA fragment addressing, as in `file.md#topic-id/element-id`.
- MDITA core and extended profile awareness.

On top of the server, the extension contributes an `mditamap` language with
Markdown highlighting, twelve MDITA snippets, and palette commands for the
DITA-OT build.

## Installation

The extension is not on the Marketplace. Install the packaged `.vsix` from a
[GitHub release][gh-releases].

```bash
gh release download v0.1.1 --repo aireilly/lsp-mdita-vscode --pattern '*.vsix'
code --install-extension mdita-lsp-v0.1.1.vsix
```

Through the UI instead: press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>,
run **Extensions: Install from VSIX**, and pick the downloaded file.

VS Code enables an extension as soon as it is installed. There is no separate
enable step.

### From source

```bash
git clone https://github.com/aireilly/lsp-mdita-vscode
cd lsp-mdita-vscode
npm install
npm run package
code --install-extension mdita-lsp-0.1.1.vsix
```

## First run

### When the extension activates

Installing it is not enough to make anything happen. The extension stays
dormant until a folder you open holds one of these:

- a `.mdita-lsp.yaml` file at its root
- any `.mditamap` file

Running one of the extension's commands also starts it. Opening a single
Markdown file with no folder around it does nothing, which keeps the server
away from projects that have nothing to do with DITA.

Reload the window after installing, with **Developer: Reload Window**. Windows
that were already open do not pick up a newly installed extension.

### Checking it works

The repository ships a fixture workspace with both markers in it. Clone it if
you installed from a release and do not have a copy:

```bash
git clone https://github.com/aireilly/lsp-mdita-vscode
code lsp-mdita-vscode/testdata/workspace
```

Open `intro.md`. You should see:

| Where | What |
|---|---|
| Status bar, right side | `✓ MDITA`, with a tooltip naming the resolved binary and its version |
| Above `# Introduction` | A `2 references` code lens |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> | An outline listing Introduction and Setup |
| <kbd>Ctrl</kbd>+<kbd>Space</kbd> after typing `](` | Completions for file paths |

### When something is wrong

Run **MDITA LSP: Show Output**. The first line names the binary that was
resolved and the step of the search it came from.

| Symptom | Cause |
|---|---|
| No status bar entry at all | The extension never activated. Check the folder for a marker, then reload the window |
| `$(sync~spin) MDITA` that never settles | A download is in progress, or the server started and never answered `initialize` |
| `$(error) MDITA` | The server was found and then exited. The output channel holds its transcript |
| An error about an unsupported platform | No binary is published for your platform. Build the server from source, below |

### Disabling or removing it

Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>, find MDITA LSP, and use
**Disable** or **Disable (Workspace)**. From a shell:

```bash
code --uninstall-extension vscode-aidanreilly.mdita-lsp
```

## The language server

The extension needs the `mdita-lsp` binary and finds it on its own in the usual
case, downloading the release it was built against when nothing is installed.

Resolution order:

1. `mdita-lsp.customCommand`, when set. Nothing below runs when this is set and
   cannot be resolved.
2. `mdita-lsp` on your `PATH`.
3. `~/.local/bin`, `~/go/bin`, and `/usr/local/bin`, which is where
   `make install` and `go install` put it.
4. A copy previously downloaded into the extension's global storage.
5. A fresh download of the pinned release from [GitHub][releases].

Downloads cover Linux, macOS, and Windows on x64, plus Linux and macOS on
arm64. On any other platform, build the server yourself and put it on your
`PATH`:

```bash
go install github.com/aireilly/mdita-lsp/cmd/mdita-lsp@latest
```

To point the extension at a build tree rather than an installed binary, set
`mdita-lsp.customCommand`:

```json
{
  "mdita-lsp.customCommand": "go run ./cmd/mdita-lsp",
  "mdita-lsp.customCommandDir": "/path/to/mdita-lsp"
}
```

## Commands

| Command | What it does |
|---|---|
| MDITA LSP: Restart Server | Stops the language server and starts a fresh one |
| MDITA LSP: Show Output | Opens the server's output channel |
| MDITA LSP: Reload Configuration | Makes the server re-read its YAML configuration |
| MDITA LSP: Build with DITA-OT (XHTML) | Builds the current map to XHTML |
| MDITA LSP: Build with DITA-OT (DITA) | Builds the current map to DITA |

A build command uses the active editor when it holds a `.mditamap` file or a
Markdown file declaring the DITA map schema. Otherwise it offers a pick over
the `.mditamap` files in the workspace. Build progress and results arrive as
notifications, with the full log in the output channel.

## Extension settings

| Setting | Default | Purpose |
|---|---|---|
| `mdita-lsp.customCommand` | unset | Command to run instead of searching for the binary. Split on spaces, so `go run ./cmd/mdita-lsp` works |
| `mdita-lsp.customCommandDir` | workspace root | Working directory for the custom command |
| `mdita-lsp.codeLens.hideZeroReferences` | `true` | Hides `0 references` lenses on headings nothing links to |
| `mdita-lsp.trace.server` | `off` | Verbosity of the LSP message trace in the output channel |

## Server configuration

No VS Code setting configures the server itself. It reads `.mdita-lsp.yaml`
from the workspace root, falling back to `~/.config/mdita-lsp/config.yaml`:

```yaml
core:
  mdita:
    enable: true
    profile: extended          # "core" or "extended"
    map_extensions: [mditamap]
    formatTablesOnSave: true
```

A document declaring an MDITA `$schema` selects its own profile, overriding
`profile`. The [server README][config] documents the rest, including
`implicit_task_sections`, per-diagnostic toggles, and DITA-OT build options.

Saving `.mdita-lsp.yaml` reloads it automatically. After editing the user-wide
file at `~/.config/mdita-lsp/config.yaml`, run **MDITA LSP: Reload
Configuration**, since that path sits outside the workspace and cannot be
watched.

## Snippets

Available in Markdown and `.mditamap` files.

| Prefix | Output |
|---|---|
| `mdita-topic` | Front matter with `$schema`, a title, a short description, and a body |
| `frontmatter` | YAML front matter block |
| `task` | Task topic with prerequisite, procedure, and verification sections |
| `xref` | `[link text](filename.md)` |
| `fragref` | `[link text](filename.md#topic-id/element-id)` |
| `mapentry` | `- [Topic Title](path/to/topic.md)` |
| `keyref` | `[key-name]` |
| `keydef` | `[key-name]: topic.md "Title"` |
| `datakeyref` | `<span data-keyref="key-name">` |
| `conref` | `<p data-conref="shared.md#topic-id/element-id">` |
| `conkeyref` | `<span data-conkeyref="key-name/element-id">` |
| `admonition` | `!!! note` with indented content |

`admonition` applies to Markdown DITA files that declare no `$schema`. The
plug-in enables admonitions nowhere else.

Front matter key completion comes from the server, with hover documentation on
each key, so there are no snippets for it.

## Status bar

An entry on the right reports the server:

| Text | Meaning |
|---|---|
| `$(sync~spin) MDITA` | Starting |
| `$(check) MDITA` | Running |
| `$(error) MDITA` | Stopped or failed to start |

Its tooltip names the resolved binary and the version it reports. Clicking it
opens the output channel.

## Development

```bash
npm install
npm run webpack-dev     # or press F5 to launch an extension host
npm run lint
npm test                # unit tests, no extension host needed
npm run test:integration
```

`src/locate.ts` and `src/mapfile.ts` import nothing from `vscode`, so their
tests run under plain mocha. `npm test` covers those, and needs no display.

`npm run test:integration` boots a real extension host through
`@vscode/test-electron`, opening the fixture workspace in `testdata/workspace`.
That workspace holds a `.mdita-lsp.yaml` file, so the extension activates
through its real activation event and the suite asserts against a live server.
It needs `mdita-lsp` on your `PATH` and a display, so run it under `xvfb-run -a`
on a headless machine.

CI runs both suites on every push and pull request, installing the pinned
server release first, and uploads the packaged `.vsix` as a build artifact.

### Releasing

Tag a commit `vX.Y.Z` and push the tag. The release workflow checks the tag
against the `version` field in `package.json`, runs both suites, packages the
extension, and attaches the `.vsix` to a GitHub release.

### Packaging

```bash
npm run package
```

`vsce` is a dev dependency, so nothing has to be installed globally. The
`.vsix` lands in the repository root. Publishing to the Marketplace needs a
personal access token scoped to Marketplace > Manage for the publisher account.

### Bumping the pinned server release

`serverRelease` in `src/locate.ts` names the [mdita-lsp][releases] release that
downloads pull from. Change it, then update the expectation in
`src/test/unit/locate.test.ts`.

## Reporting issues

Check first whether the same problem happens when running `mdita-lsp` on its
own. If it does, file it against the [language server][server-issues]. For
problems specific to the VS Code integration:

https://github.com/aireilly/lsp-mdita-vscode/issues

## License

[MIT](LICENSE)

[server]: https://github.com/aireilly/mdita-lsp
[server-issues]: https://github.com/aireilly/mdita-lsp/issues
[releases]: https://github.com/aireilly/mdita-lsp/releases
[gh-releases]: https://github.com/aireilly/lsp-mdita-vscode/releases
[config]: https://github.com/aireilly/mdita-lsp#configuration
[sublime]: https://github.com/aireilly/LSP-mdita
[lwdita]: https://github.com/jelovirt/org.lwdita
