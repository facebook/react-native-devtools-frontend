# Project Instructions

This is the React Native DevTools frontend, a fork of [Chrome DevTools](https://github.com/ChromeDevTools/devtools-frontend).

Changes should generally be scoped to the `front_end/` directory. Do not edit `front_end/generated/`.

## Guidelines

- Make minimal edits. No speculative refactors.
- Run `npm test` (unit tests) and `npm run lint` (ESLint, Stylelint, lit-analyzer) to validate changes.
- Use `.js` extensions in TypeScript imports. Use `type` imports where possible (`import type`).
- New files in Meta-owned paths must prepend `// Copyright (c) Meta Platforms, Inc. and affiliates.` as the first line of the license header, above the Chromium Authors license. Keep in sync with `META_CODE_PATHS` in `scripts/eslint_rules/lib/check-license-header.js`.

## Build system

Each module directory has a `BUILD.gn` file. Update these when adding new files or dependencies.

- `generate_css("css_files")` — lists `.css` source files.
- `devtools_module("name")` — lists `.ts` source files in `sources` and dependencies as `:bundle` refs in `deps`.
- `devtools_entrypoint("bundle")` — declares the barrel file that re-exports the module's public API.
- `devtools_entrypoint("meta")` — declares the `-meta.ts` file that registers panels/views. Use `visibility` to restrict to specific entrypoints.
- `ts_library("unittests")` — lists `.test.ts` files with `testonly = true`.

## Architecture

- **UI components** extend `HTMLElement`, use Lit `html` templates (from `../../ui/lit/lit.js`), and locate styles in one adjacent CSS file. Prefix custom elements with `devtools-`. Example: `front_end/ui/components/cards/Card.ts`.
- **Panels** extend `UI.Widget.VBox` and are registered via a `-meta.ts` file using `UI.ViewManager.registerViewExtension()`, which lazily loads the panel implementation.
- **Entrypoints**: `front_end/entrypoints/rn_fusebox/` is the primary RN entry point.
- **RN-specific code** lives in paths listed in `META_CODE_PATHS` (e.g. `panels/rn_welcome/`, `panels/react_devtools/`, `models/react_native/`, `core/rn_experiments/`).
