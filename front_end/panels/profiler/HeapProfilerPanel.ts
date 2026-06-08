// Copyright 2017 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Root from '../../core/root/root.js';
import type * as SDK from '../../core/sdk/sdk.js';
import * as UI from '../../ui/legacy/legacy.js';

import type {HeapSnapshotView} from './HeapSnapshotView.js';
import type {ProfileType} from './ProfileHeader.js';
import {ProfilesPanel} from './ProfilesPanel.js';

const UIStrings = {
  /**
   * @description A context menu item in the Heap Profiler Panel of a profiler tool
   */
  revealInSummaryView: 'Reveal in Summary view',
} as const;
const str_ = i18n.i18n.registerUIStrings('panels/profiler/HeapProfilerPanel.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

let heapProfilerPanelInstance: HeapProfilerPanel;
export class HeapProfilerPanel extends ProfilesPanel implements UI.ContextMenu.Provider<SDK.RemoteObject.RemoteObject>,
                                                                UI.ActionRegistration.ActionDelegate {
  constructor() {
    super('heap-profiler', 'profiler.heap-toggle-recording');
  }

  override get profileTypes(): ProfileType[] {
    const registry = ProfilesPanel.registry;
    const isReactNative = Root.Runtime.experiments.isEnabled(
        Root.Runtime.ExperimentName.REACT_NATIVE_SPECIFIC_UI,
    );
    // [RN] Allocation sampling and Detached elements memory profiling options are not supported.
    // We are hiding these options from the UI.
    if (isReactNative) {
      return [
        registry.heapSnapshotProfileType,
        registry.trackingHeapSnapshotProfileType,
        registry.samplingHeapProfileType,
      ];
    }
    return [
      registry.heapSnapshotProfileType,
      registry.trackingHeapSnapshotProfileType,
      registry.samplingHeapProfileType,
      registry.detachedElementProfileType,
    ];
  }

  static instance(): HeapProfilerPanel {
    if (!heapProfilerPanelInstance) {
      heapProfilerPanelInstance = new HeapProfilerPanel();
    }
    return heapProfilerPanelInstance;
  }

  appendApplicableItems(_event: Event, contextMenu: UI.ContextMenu.ContextMenu, object: SDK.RemoteObject.RemoteObject):
      void {
    if (!this.isShowing()) {
      return;
    }

    if (!object.objectId) {
      return;
    }
    const objectId = object.objectId;

    const heapProfiles = ProfilesPanel.registry.heapSnapshotProfileType.getProfiles();
    if (!heapProfiles.length) {
      return;
    }

    const heapProfilerModel = object.runtimeModel().heapProfilerModel();
    if (!heapProfilerModel) {
      return;
    }

    function revealInView(this: ProfilesPanel, viewName: string): void {
      void heapProfilerModel.snapshotObjectIdForObjectId(objectId).then(result => {
        if (this.isShowing() && result) {
          this.showObject(result, viewName);
        }
      });
    }

    contextMenu.revealSection().appendItem(
        i18nString(UIStrings.revealInSummaryView), revealInView.bind(this, 'Summary'),
        {jslogContext: 'reveal-in-summary'});
  }

  handleAction(_context: UI.Context.Context, _actionId: string): boolean {
    const panel = UI.Context.Context.instance().flavor(HeapProfilerPanel);
    console.assert(Boolean(panel) && panel instanceof HeapProfilerPanel);
    if (panel) {
      panel.toggleRecord();
    }
    return true;
  }

  override wasShown(): void {
    super.wasShown();
    UI.Context.Context.instance().setFlavor(HeapProfilerPanel, this);
    // Record the memory tool load time.
    Host.userMetrics.panelLoaded('heap-profiler', 'DevTools.Launch.HeapProfiler');
  }

  override willHide(): void {
    UI.Context.Context.instance().setFlavor(HeapProfilerPanel, null);
    super.willHide();
  }

  override showObject(snapshotObjectId: string, perspectiveName: string): void {
    const heapProfiles = ProfilesPanel.registry.heapSnapshotProfileType.getProfiles();
    for (let i = 0; i < heapProfiles.length; i++) {
      const profile = heapProfiles[i];
      // FIXME: allow to choose snapshot if there are several options.
      if (profile.maxJSObjectId >= parseInt(snapshotObjectId, 10)) {
        this.showProfile(profile);
        const view = (this.viewForProfile(profile) as HeapSnapshotView);
        void view.selectLiveObject(perspectiveName, snapshotObjectId);
        break;
      }
    }
  }
}
