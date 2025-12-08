// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as UI from '../../ui/legacy/legacy.js';
import livematePanelStyles from './livematePanel.css.js';
import * as SDK from '../../core/sdk/sdk.js';
import { ReactDevToolsViewBase } from '../react_devtools/ReactDevToolsViewBase.js';
import * as i18n from '../../core/i18n/i18n.js';

let livematePanelInstance: LivematePanel;

const UIStrings = {
  /**
   *@description Title of the React DevTools view
   */
  title: '⚛️ Livemate',
} as const;
const str_ = i18n.i18n.registerUIStrings('panels/livemate/LivematePanel.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class LivematePanel extends ReactDevToolsViewBase {
  static instance(): LivematePanel {
    if (!livematePanelInstance) {
      livematePanelInstance = new LivematePanel();
    }
    return livematePanelInstance;
  }

    constructor() {
    super('components', i18nString(UIStrings.title));
  }

  override renderDevToolsView(): void {
    this.clearView();

    const model = this.model;
    if (model === null) {
      throw new Error('Attempted to render React DevTools panel, but the model was null');
    }

    const bridge = model.getBridgeOrThrow();

    const button = document.createElement('button');
    button.textContent = 'Start Inspecting Host';

    bridge.addListener('selectElement', (element: any) => {console.log(element)});

    let inspecting = false;

    button.onclick = () => {
      if (inspecting) {
        (bridge as any).send('stopInspectingHost');
        button.textContent= 'Start Inspecting Host';
        inspecting = false;
      } else {
        (bridge as any).send('startInspectingHost', false);
        button.textContent= 'Stop Inspecting Host';
        inspecting = true;
      }
    }

    this.contentElement.appendChild(button);



    // bridge.send('stopInspectingHost');
  }

    // this.contentElement.removeChildren();

    // const header = this.contentElement.createChild('div', 'livemate-header');
    // header.textContent = 'Livemate Panel';
}
