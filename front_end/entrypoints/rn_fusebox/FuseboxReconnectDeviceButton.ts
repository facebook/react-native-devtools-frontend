// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';
import * as UI from '../../ui/legacy/legacy.js';

const UIStrings = {
  /**
   *@description Tooltip of the connection status toolbar button while disconnected
   */
  connectionStatusDisconnectedTooltip: 'Debugging connection was closed',
  /**
   *@description Button label of the connection status toolbar button while disconnected
   */
  connectionStatusDisconnectedLabel: 'Reconnect DevTools',
};
const str_ = i18n.i18n.registerUIStrings('entrypoints/rn_fusebox/ConnectionStatusToolbarItem.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

let connectionStatusIndicatorInstance: FuseboxReconnectDeviceButton;

export default class FuseboxReconnectDeviceButton extends SDK.TargetManager.Observer implements
    UI.Toolbar.Provider {
  #button = new UI.Toolbar.ToolbarButton('');

  private constructor() {
    super();
    this.#button.setVisible(false);
    this.#button.element.classList.add('fusebox-connection-status');
    this.#button.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.#handleClick.bind(this));

    SDK.TargetManager.TargetManager.instance().observeTargets(this, {scoped: true});
  }

  static instance(): FuseboxReconnectDeviceButton {
    if (!connectionStatusIndicatorInstance) {
      connectionStatusIndicatorInstance = new FuseboxReconnectDeviceButton();
    }
    return connectionStatusIndicatorInstance;
  }

  override targetAdded(target: SDK.Target.Target): void {
    this.#onTargetChanged(target);
  }

  override targetRemoved(target: SDK.Target.Target): void {
    this.#onTargetChanged(target);
  }

  #onTargetChanged(target: SDK.Target.Target): void {
    const rootTarget = SDK.TargetManager.TargetManager.instance().rootTarget();
    this.#button.setTitle(i18nLazyString(UIStrings.connectionStatusDisconnectedTooltip)());
    this.#button.setText(i18nLazyString(UIStrings.connectionStatusDisconnectedLabel)());
    this.#button.setVisible(!rootTarget);

    if (!rootTarget) {
      this.#printPreserveLogPrompt(target);
    }
  }

  #printPreserveLogPrompt(target: SDK.Target.Target): void {
    if (Common.Settings.Settings.instance().moduleSetting('preserve-console-log').get()) {
      return;
    }

    target.model(SDK.ConsoleModel.ConsoleModel)
        ?.addMessage(new SDK.ConsoleModel.ConsoleMessage(
            target.model(SDK.RuntimeModel.RuntimeModel), Protocol.Log.LogEntrySource.Recommendation,
            Protocol.Log.LogEntryLevel.Info,
            '[React Native] Console messages are currently cleared upon DevTools disconnection. You can preserve logs in settings: ',
            {
              type: SDK.ConsoleModel.FrontendMessageType.System,
              context: 'fusebox_preserve_log_rec',
            }));
  }

  #handleClick(): void {
    window.location.reload();
  }

  item(): UI.Toolbar.ToolbarItem {
    return this.#button;
  }
}
