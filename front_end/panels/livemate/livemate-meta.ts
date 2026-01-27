// Copyright 2026 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as Root from '../../core/root/root.js';
import * as UI from '../../ui/legacy/legacy.js';

import type * as Livemate from './livemate.js';

const UIStrings = {
  /**
   *@description Title of the Livemate panel
   */
  livemate: 'Livemate',
  /**
   *@description Command for showing the Livemate panel
   */
  showLivemate: 'Show Livemate',
} as const;

const str_ = i18n.i18n.registerUIStrings('panels/livemate/livemate-meta.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

let loadedLivemateModule: (typeof Livemate | undefined);

async function loadLivemateModule(): Promise<typeof Livemate> {
  if (!loadedLivemateModule) {
    loadedLivemateModule = await import('./livemate.js');
  }
  return loadedLivemateModule;
}

UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: 'livemate',
  title: i18nLazyString(UIStrings.livemate),
  commandPrompt: i18nLazyString(UIStrings.showLivemate),
  order: 100,
  experiment: Root.Runtime.ExperimentName.ENABLE_LIVEMATE_PANEL,
  async loadView() {
    const Livemate = await loadLivemateModule();
    return Livemate.LivematePanel.LivematePanel.instance();
  },
});
