// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as UI from '../../ui/legacy/legacy.js';
import livematePanelStyles from './livematePanel.css.js';

let livematePanelInstance: LivematePanel;

export class LivematePanel extends UI.Widget.VBox {
  static instance(): LivematePanel {
    if (!livematePanelInstance) {
      livematePanelInstance = new LivematePanel();
    }
    return livematePanelInstance;
  }

  private constructor() {
    super(true, true);
    this.registerRequiredCSS(livematePanelStyles);
    this.contentElement.classList.add('livemate-panel');
  }

  override wasShown(): void {
    super.wasShown();
    this.renderContent();
  }

  private renderContent(): void {
    this.contentElement.removeChildren();

    const header = this.contentElement.createChild('div', 'livemate-header');
    header.textContent = 'Livemate Panel';
  }
}
