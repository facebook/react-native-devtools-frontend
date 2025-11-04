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
import * as Lit from '../../ui/lit/lit.js';
import * as VisualLogging from '../../ui/visual_logging/visual_logging.js';

import {FuseboxWindowTitleManager} from './FuseboxWindowTitleManager.js';

const {html, render} = Lit;

const UIStrings = {
  /**
   * @description Message for the "settings changed" banner shown when a reload is required for the Network panel.
   */
  reloadRequiredForNetworkPanelMessage: 'The Network panel is now available for dogfooding. Please reload to access it.',
  /**
   * @description Title shown when Network inspection is disabled due to multiple React Native hosts.
   */
  networkInspectionUnavailable: 'Network inspection is unavailable',
  /**
   * @description Title shown when Performance profiling is disabled due to multiple React Native hosts.
   */
  performanceProfilingUnavailable: 'Performance profiling is unavailable',
  /**
   * @description Title shown when a feature is unavailable due to multiple React Native hosts.
   */
  multiHostFeatureUnavailableTitle: 'Feature is unavailable',
  /**
   * @description Detail message shown when a feature is disabled due to multiple React Native hosts.
   */
  multiHostFeatureDisabledDetail: 'This feature is disabled as the app or framework has registered multiple React Native hosts, which is not currently supported.',
} as const;

const str_ = i18n.i18n.registerUIStrings('entrypoints/rn_fusebox/FuseboxFeatureObserver.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

/**
 * The set of features that are not guaranteed to behave safely with multiple
 * React Native hosts.
 */
const UNSAFE_MULTI_HOST_FEATURES = new Set([
  'network',
  'timeline',
]);

/**
 * [RN] Model observer which configures available DevTools features and
 * experiments based on the target's capabilities.
 */
export class FuseboxFeatureObserver implements
    SDK.TargetManager.SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel> {
  #singleHostFeaturesDisabled = false;

  constructor(targetManager: SDK.TargetManager.TargetManager) {
    targetManager.observeModels(SDK.ReactNativeApplicationModel.ReactNativeApplicationModel, this);
  }

  modelAdded(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.ensureEnabled();
    model.addEventListener(SDK.ReactNativeApplicationModel.Events.METADATA_UPDATED, this.#handleMetadataUpdated, this);
    model.addEventListener(SDK.ReactNativeApplicationModel.Events.SYSTEM_STATE_CHANGED, this.#handleSystemStateChanged, this);
  }

  modelRemoved(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.removeEventListener(
        SDK.ReactNativeApplicationModel.Events.METADATA_UPDATED, this.#handleMetadataUpdated, this);
    model.removeEventListener(
        SDK.ReactNativeApplicationModel.Events.SYSTEM_STATE_CHANGED, this.#handleSystemStateChanged, this);
  }

  #handleMetadataUpdated(
      event: Common.EventTarget.EventTargetEvent<Protocol.ReactNativeApplication.MetadataUpdatedEvent>): void {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {unstable_isProfilingBuild, unstable_networkInspectionEnabled} = event.data;

    if (unstable_isProfilingBuild) {
      FuseboxWindowTitleManager.instance().setSuffix('[PROFILING]');
      this.#hideUnsupportedFeaturesForProfilingBuilds();
    }

    if (unstable_networkInspectionEnabled) {
      this.#ensureNetworkPanelEnabled();
    }
  }

  #handleSystemStateChanged(
      event: Common.EventTarget.EventTargetEvent<Protocol.ReactNativeApplication.SystemStateChangedEvent>): void {
    const {isSingleHost} = event.data;
    if (!isSingleHost) {
      this.#disableSingleHostOnlyFeatures();
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

  #disableSingleHostOnlyFeatures(): void {
    if (this.#singleHostFeaturesDisabled) {
      return;
    }

    // Disable relevant CDP domains
    const targetManager = SDK.TargetManager.TargetManager.instance();
    for (const target of targetManager.targets()) {
      void target.networkAgent().invoke_disable();
    }

    // Stop network recording if active
    void this.#disableNetworkRecording();

    // Show in-panel overlay when disabled panels are selected
    const inspectorView = UI.InspectorView.InspectorView.instance();
    const overlaidPanels = new Set<string>();

    const showPanelOverlay = (panel: UI.Panel.Panel, panelId: string): void => {
      const titleText =
        panelId === 'network'
          ? i18nString(UIStrings.networkInspectionUnavailable)
          : panelId === 'timeline'
          ? i18nString(UIStrings.performanceProfilingUnavailable)
          : i18nString(UIStrings.multiHostFeatureUnavailableTitle);

      // Dim the existing panel content and disable interaction
      for (const child of panel.element.children) {
        const element = child as HTMLElement;
        element.style.opacity = '0.5';
        element.style.pointerEvents = 'none';
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      }

      const alertBar = document.createElement('div');
      render(html`
        <style>
          .alert-bar {
            background: var(--sys-color-tonal-container);
            color: var(--sys-color-on-tonal-container);
            padding: var(--sys-size-6) var(--sys-size-8);
            border-bottom: 1px solid var(--sys-color-tonal-outline);
          }
          .alert-title {
            font: var(--sys-typescale-body2-medium);
            margin-bottom: var(--sys-size-3);
          }
          .alert-detail {
            font: var(--sys-typescale-body4-regular);
          }
        </style>
        <div class="alert-bar">
          <div class="alert-title">${titleText}</div>
          <div class="alert-detail">
            ${i18nString(UIStrings.multiHostFeatureDisabledDetail)}
            See <x-link href="https://github.com/react-native-community/discussions-and-proposals/discussions/954" class="devtools-link" jslog=${VisualLogging.link().track({click: true, keydown:'Enter|Space'}).context('multi-host-learn-more')}>discussions/954</x-link>.
          </div>
        </div>
      `, alertBar, {host: this});

      panel.element.insertBefore(alertBar, panel.element.firstChild);
    };

    inspectorView.tabbedPane.addEventListener(UI.TabbedPane.Events.TabSelected, event => {
      const tabId = event.data.tabId;
      if (UNSAFE_MULTI_HOST_FEATURES.has(tabId) && !overlaidPanels.has(tabId)) {
        overlaidPanels.add(tabId);
        void inspectorView.panel(tabId).then(panel => {
          if (panel) {
            showPanelOverlay(panel, tabId);
          }
        });
      }
    });

    // Show overlay if a disabled panel is currently selected
    const currentTabId = inspectorView.tabbedPane.selectedTabId;
    if (currentTabId && UNSAFE_MULTI_HOST_FEATURES.has(currentTabId)) {
      overlaidPanels.add(currentTabId);
      void inspectorView.panel(currentTabId).then(panel => {
        if (panel) {
          showPanelOverlay(panel, currentTabId);
        }
      });
    }

    this.#singleHostFeaturesDisabled = true;
  }

  async #disableNetworkRecording(): Promise<void> {
    const inspectorView = UI.InspectorView.InspectorView.instance();
    try {
      const networkPanel = await inspectorView.panel('network');
      if (networkPanel && 'toggleRecord' in networkPanel) {
        (networkPanel as UI.Panel.Panel & {toggleRecord: (toggled: boolean) => void}).toggleRecord(false);
      }
    } catch {
    }
  }
}
