// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export default class FuseboxWindowTitleManager {
  static #instance: FuseboxWindowTitleManager;
  #appDisplayName?: string;
  #deviceName?: string;
  #suffix?: string;

  private constructor() {}

  static instance(): FuseboxWindowTitleManager {
    if (!this.#instance) {
      this.#instance = new FuseboxWindowTitleManager();
    }
    return this.#instance;
  }

  setAppInfo(appDisplayName: string | undefined, deviceName: string | undefined): void {
    this.#appDisplayName = appDisplayName;
    this.#deviceName = deviceName;
    this.#updateTitle();
  }

  setSuffix(suffix: string): void {
    this.#suffix = suffix;
    this.#updateTitle();
  }

  #updateTitle(): void {
    const parts: string[] = [];

    if (this.#appDisplayName) {
      parts.push(this.#appDisplayName);
    }
    if (this.#deviceName) {
      parts.push(`(${this.#deviceName})`);
    }
    if (this.#suffix) {
      parts.push(this.#suffix);
    }
    parts.push('- React Native DevTools');

    document.title = parts.join(' ');
  }
}
