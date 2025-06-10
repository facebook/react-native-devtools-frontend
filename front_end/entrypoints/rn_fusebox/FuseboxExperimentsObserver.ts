// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as Common from '../../core/common/common.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Root from '../../core/root/root.js';
import * as SDK from '../../core/sdk/sdk.js';
import type * as Protocol from '../../generated/protocol.js';
import * as UI from '../../ui/legacy/legacy.js';

import {FuseboxWindowTitleManager} from './FuseboxWindowTitleManager.js';

const UIStrings = {
  /**
   * @description Message for the "settings changed" banner shown when a reload is required for the Performance panel.
   */
  reloadRequiredForPerformancePanelMessage:
      '[Profiling build first run] One or more settings have changed. Please reload to access the Performance panel.',
  /**
   * @description Message for the "settings changed" banner shown when a reload is required for the Network panel.
   */
  reloadRequiredForNetworkPanelMessage: 'Network panel is now available for dogfooding. Please reload to access it.',
} as const;

const str_ = i18n.i18n.registerUIStrings('entrypoints/rn_fusebox/FuseboxExperimentsObserver.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

/**
 * [Experimental] Model observer which configures available DevTools features
 * based on the target's capabilities, e.g. when a profiling build is identified, or when network inspection is supported.
 */
export class FuseboxFeatureObserver implements
    SDK.TargetManager.SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel> {
  constructor(targetManager: SDK.TargetManager.TargetManager) {
    targetManager.observeModels(SDK.ReactNativeApplicationModel.ReactNativeApplicationModel, this);
  }

  modelAdded(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.ensureEnabled();
    model.addEventListener(SDK.ReactNativeApplicationModel.Events.METADATA_UPDATED, this.#handleMetadataUpdated, this);
  }

  modelRemoved(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.removeEventListener(
        SDK.ReactNativeApplicationModel.Events.METADATA_UPDATED, this.#handleMetadataUpdated, this);
  }

  #handleMetadataUpdated(
      event: Common.EventTarget.EventTargetEvent<Protocol.ReactNativeApplication.MetadataUpdatedEvent>): void {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {unstable_isProfilingBuild, unstable_networkInspectionEnabled} = event.data;

    if (unstable_isProfilingBuild) {
      FuseboxWindowTitleManager.instance().setSuffix('[PROFILING]');
      this.#hideUnsupportedFeaturesForProfilingBuilds();
      this.#ensurePerformancePanelEnabled();
    }

    if (unstable_networkInspectionEnabled) {
      this.#ensureNetworkPanelEnabled();
    }
  }

  #hideUnsupportedFeaturesForProfilingBuilds(): void {
    UI.InspectorView.InspectorView.instance().closeDrawer();

    const viewManager = UI.ViewManager.ViewManager.instance();
    const panelLocationPromise = viewManager.resolveLocation(UI.ViewManager.ViewLocationValues.PANEL);
    const drawerLocationPromise = viewManager.resolveLocation(UI.ViewManager.ViewLocationValues.DRAWER_VIEW);
    void Promise.all([panelLocationPromise, drawerLocationPromise])
      .then(([panelLocation, drawerLocation]) => {
        UI.ViewManager.getRegisteredViewExtensions().forEach(view => {
          if (view.location() === UI.ViewManager.ViewLocationValues.DRAWER_VIEW) {
            drawerLocation?.removeView(view);
          } else {
            switch (view.viewId()) {
              case 'console':
              case 'heap-profiler':
              case 'live-heap-profile':
              case 'sources':
              case 'network':
              case 'react-devtools-components':
              case 'react-devtools-profiler':
                panelLocation?.removeView(view);
                break;
            }
          }
        });
      });
  }

  #ensurePerformancePanelEnabled(): void {
    if (
      !Root.Runtime.experiments.isEnabled(
        Root.Runtime.ExperimentName.ENABLE_PERFORMANCE_PANEL,
      )
    ) {
      Root.Runtime.experiments.setEnabled(
        Root.Runtime.ExperimentName.ENABLE_PERFORMANCE_PANEL,
        true,
      );

      const inspectorView = UI.InspectorView?.InspectorView?.instance();
      if (inspectorView) {
        inspectorView.displayReloadRequiredWarning(
            i18nString(UIStrings.reloadRequiredForPerformancePanelMessage),
        );
      }
    }
  }

  #ensureNetworkPanelEnabled(): void {
    if (Root.Runtime.experiments.isEnabled(Root.Runtime.ExperimentName.ENABLE_NETWORK_PANEL)) {
      return;
    }

    Root.Runtime.experiments.setEnabled(
        Root.Runtime.ExperimentName.ENABLE_NETWORK_PANEL,
        true,
    );

    UI.InspectorView?.InspectorView?.instance()?.displayReloadRequiredWarning(
        i18nString(UIStrings.reloadRequiredForNetworkPanelMessage),
    );
  }
}
