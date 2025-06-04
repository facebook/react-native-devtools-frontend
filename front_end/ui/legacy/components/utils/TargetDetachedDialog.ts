// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../../../core/i18n/i18n.js';
import * as SDK from '../../../../core/sdk/sdk.js';
import type * as ProtocolProxyApi from '../../../../generated/protocol-proxy-api.js';
import type * as Protocol from '../../../../generated/protocol.js';
import * as UI from '../../legacy.js';

const UIStrings = {
  /**
   *@description Text on the remote debugging window to indicate the connection is lost
   */
  websocketDisconnected: 'WebSocket disconnected',
  /**
   *@description Text on the remote debugging window to indicate the connection cannot be made because the device is not connected
   */
  websocketDisconnectedUnregisteredDevice:
      'The corresponding app for this DevTools session cannot be found. Please relaunch DevTools from the terminal.',
  /**
   *@description Text on the remote debugging window to indicate the connection to corresponding device was lost
   */
  websocketDisconnectedConnectionLost: 'Connection lost to corresponding device.',
  /**
   *@description Text on the remote debugging window to indicate a disconnection happened because a second dev tools instance was opened
   */
  websocketDisconnectedNewDebuggerOpened: 'Disconnected due to opening a second DevTools window for the same app.'
} as const;

const str_ = i18n.i18n.registerUIStrings('ui/legacy/components/utils/TargetDetachedDialog.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
export class TargetDetachedDialog extends SDK.SDKModel.SDKModel<void> implements ProtocolProxyApi.InspectorDispatcher {
  private static hideCrashedDialog: (() => void)|null;
  constructor(target: SDK.Target.Target) {
    super(target);
    target.registerInspectorDispatcher(this);
    void target.inspectorAgent().invoke_enable();
    // Hide all dialogs if a new top-level target is created.
    if (target.parentTarget()?.type() === SDK.Target.Type.BROWSER && TargetDetachedDialog.hideCrashedDialog) {
      TargetDetachedDialog.hideCrashedDialog.call(null);
      TargetDetachedDialog.hideCrashedDialog = null;
    }
  }

  detached({reason}: Protocol.Inspector.DetachedEvent): void {
    UI.RemoteDebuggingTerminatedScreen.RemoteDebuggingTerminatedScreen.show(reason);
  }

  static getCustomUiReason(connectionLostDetails?: {reason?: string, code?: string, errorType?: string}): string | null {
    if (!connectionLostDetails) {
      return null;
    }

    if (connectionLostDetails.code === '1011' && connectionLostDetails.reason?.includes('[UNREGISTERED_DEVICE]')) {
      return i18nString(UIStrings.websocketDisconnectedUnregisteredDevice);
    }

    if (connectionLostDetails.code === '1000' && connectionLostDetails.reason?.includes('[CONNECTION_LOST]')) {
      return i18nString(UIStrings.websocketDisconnectedConnectionLost);
    }

    if (connectionLostDetails.code === '1000' && connectionLostDetails.reason?.includes('[NEW_DEBUGGER_OPENED]')) {
      return i18nString(UIStrings.websocketDisconnectedNewDebuggerOpened);
    }

    return null;
  }

  static connectionLost(connectionLostDetails?: {reason?: string, code?: string, errorType?: string}): void {
    const uiReason = TargetDetachedDialog.getCustomUiReason(connectionLostDetails) || i18nString(UIStrings.websocketDisconnected);
    UI.RemoteDebuggingTerminatedScreen.RemoteDebuggingTerminatedScreen.show(uiReason, connectionLostDetails);
  }

  targetCrashed(): void {
    // In case of service workers targetCrashed usually signals that the worker is stopped
    // and in any case it is restarted automatically (in which case front-end will receive
    // targetReloadedAfterCrash event).
    if (TargetDetachedDialog.hideCrashedDialog) {
      return;
    }
    // Ignore child targets altogether.
    const parentTarget = this.target().parentTarget();
    if (parentTarget && parentTarget.type() !== SDK.Target.Type.BROWSER) {
      return;
    }
    const dialog = new UI.Dialog.Dialog('target-crashed');
    dialog.setSizeBehavior(UI.GlassPane.SizeBehavior.MEASURE_CONTENT);
    dialog.addCloseButton();
    dialog.setDimmed(true);
    TargetDetachedDialog.hideCrashedDialog = dialog.hide.bind(dialog);
    new UI.TargetCrashedScreen
        .TargetCrashedScreen(() => {
          TargetDetachedDialog.hideCrashedDialog = null;
        })
        .show(dialog.contentElement);

    dialog.show();
  }

  /** ;
   */
  targetReloadedAfterCrash(): void {
    void this.target().runtimeAgent().invoke_runIfWaitingForDebugger();
    if (TargetDetachedDialog.hideCrashedDialog) {
      TargetDetachedDialog.hideCrashedDialog.call(null);
      TargetDetachedDialog.hideCrashedDialog = null;
    }
  }
}

SDK.SDKModel.SDKModel.register(TargetDetachedDialog, {capabilities: SDK.Target.Capability.INSPECTOR, autostart: true});
