// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as UI from '../../ui/legacy/legacy.js';

import type * as GreenDev from './greendev.js';

let loadedGreenDevModule: (typeof GreenDev|undefined);

async function loadGreenDevModule(): Promise<typeof GreenDev> {
  if (!loadedGreenDevModule) {
    loadedGreenDevModule = await import('./greendev.js');
  }
  return loadedGreenDevModule;
}

UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: 'greendev',
  title: i18n.i18n.lockedLazyString('GreenDev'),
  commandPrompt: i18n.i18n.lockedLazyString('Show GreenDev'),
  persistence: UI.ViewManager.ViewPersistence.CLOSEABLE,
  order: 100,
  async loadView() {
    const GreenDev = await loadGreenDevModule();
    return GreenDev.GreenDevPanel.GreenDevPanel.instance();
  },
  condition: config => {
    return Boolean(config?.devToolsGreenDevUi?.enabled);
  },
});

const syncChannel = new BroadcastChannel('green-dev-sync');

syncChannel.postMessage({type: 'main-window-alive'});

syncChannel.onmessage = event => {
  if (event.data.type === 'activate-panel') {
    console.error('[GreenDev] Meta: Received activate-panel broadcast');

    void UI.ViewManager.ViewManager.instance().showView('greendev').then(() => {
      console.error('[GreenDev] Meta: View shown, broadcasting select-tab');

      const replyChannel = new BroadcastChannel('green-dev-sync');
      replyChannel.postMessage({type: 'select-tab', sessionId: event.data.sessionId});

      replyChannel.close();
    });
  }
};
