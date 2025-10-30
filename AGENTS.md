# Project Instructions

This codebase is a fork of https://github.com/ChromeDevTools/devtools-frontend.

## Editing Policy

- Make minimal edits. No speculative refactors.
- Changes should generally be scoped to the `front_end/` directory. Focus code searches here.

## Workflow

- Update `BUILD.gn` files when adding new modules and imports.
- New files should prepend "Copyright (c) Meta Platforms, Inc. and affiliates." as the first line of the license header, above the Chromium Authors license. Keep in sync with `META_CODE_PATHS` in `scripts/eslint_rules/lib/check-license-header.js`.

## Architecture

- For UI code, prefer modern `html` template code and locate styles in one adjacent CSS file. Example: `front_end/ui/components/cards/Cards.ts`.
