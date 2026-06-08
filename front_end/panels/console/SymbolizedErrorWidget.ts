// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Bindings from '../../models/bindings/bindings.js';
import type * as Workspace from '../../models/workspace/workspace.js';
import * as UI from '../../ui/legacy/legacy.js';

export interface ViewInput {
  error: Bindings.SymbolizedError.SymbolizedError;
  ignoreListManager?: Workspace.IgnoreListManager.IgnoreListManager;
}

const DEFAULT_VIEW = (_input: ViewInput, _output: object, _target: HTMLElement): void => {};

export class SymbolizedErrorWidget extends UI.Widget.Widget {
  #error?: Bindings.SymbolizedError.SymbolizedError;
  #view: typeof DEFAULT_VIEW;
  #ignoreListManager?: Workspace.IgnoreListManager.IgnoreListManager;

  constructor(element?: HTMLElement, view: typeof DEFAULT_VIEW = DEFAULT_VIEW) {
    super(element);
    this.#view = view;
  }

  set ignoreListManager(ignoreListManager: Workspace.IgnoreListManager.IgnoreListManager) {
    this.#ignoreListManager = ignoreListManager;
    this.requestUpdate();
  }

  get ignoreListManager(): Workspace.IgnoreListManager.IgnoreListManager|undefined {
    return this.#ignoreListManager;
  }

  set error(error: Bindings.SymbolizedError.SymbolizedError) {
    this.#error?.removeEventListener(Bindings.SymbolizedError.Events.UPDATED, this.requestUpdate, this);
    this.#error = error;
    if (this.isShowing()) {
      this.#error?.addEventListener(Bindings.SymbolizedError.Events.UPDATED, this.requestUpdate, this);
    }
    this.requestUpdate();
  }

  get error(): Bindings.SymbolizedError.SymbolizedError|undefined {
    return this.#error;
  }

  override wasShown(): void {
    super.wasShown();
    this.#error?.addEventListener(Bindings.SymbolizedError.Events.UPDATED, this.requestUpdate, this);
    this.requestUpdate();
  }

  override willHide(): void {
    super.willHide();
    this.#error?.removeEventListener(Bindings.SymbolizedError.Events.UPDATED, this.requestUpdate, this);
  }

  override performUpdate(): void {
    if (!this.#error) {
      return;
    }
    const input: ViewInput = {
      error: this.#error,
      ignoreListManager: this.#ignoreListManager,
    };
    this.#view(input, {}, this.contentElement);
  }
}
