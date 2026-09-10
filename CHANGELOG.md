# Change log

## [0.1.0]

First release.

- Language client for [mdita-lsp](https://github.com/aireilly/mdita-lsp),
  pinned to server release `v1.0.1`.
- Binary resolution through `mdita-lsp.customCommand`, `PATH`, the
  `make install` and `go install` directories, a cached download, and finally a
  download from GitHub releases.
- Activation gated on `.mdita-lsp.yaml`, any `.mditamap` file, or the
  `mditamap` language.
- `mditamap` language with a Markdown grammar and a language configuration.
- Twelve MDITA snippets ported from
  [LSP-mdita](https://github.com/aireilly/LSP-mdita).
- Commands to restart the server, show its output, reload its configuration,
  and run a DITA-OT build to XHTML or DITA.
- A file watcher on `.mdita-lsp.yaml` that reloads server configuration on
  save.
- Status bar entry reporting server state, the resolved binary, and its
  version.
- Code lenses reporting zero references are hidden by default, controlled by
  `mdita-lsp.codeLens.hideZeroReferences`.
- Files created by the server's `createFile` code action open in an editor.
