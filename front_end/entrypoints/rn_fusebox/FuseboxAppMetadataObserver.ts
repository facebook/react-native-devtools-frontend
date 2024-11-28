// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as Protocol from '../../generated/protocol.js';
import * as SDK from '../../core/sdk/sdk.js';
import FuseboxWindowTitleManager from './FuseboxWindowTitleManager.js';

/**
 * Model observer which updates the DevTools window title based on the connected
 * React Native app metadata.
 */
export default class FuseboxAppMetadataObserver implements
    SDK.TargetManager.SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel> {
  constructor(targetManager: SDK.TargetManager.TargetManager) {
    targetManager.observeModels(SDK.ReactNativeApplicationModel.ReactNativeApplicationModel, this);
  }

  modelAdded(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.ensureEnabled();
    model.addEventListener(SDK.ReactNativeApplicationModel.Events.MetadataUpdated, this.#handleMetadataUpdated, this);
  }

  modelRemoved(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.removeEventListener(
        SDK.ReactNativeApplicationModel.Events.MetadataUpdated, this.#handleMetadataUpdated, this);
  }

  #handleMetadataUpdated(
      event: Common.EventTarget.EventTargetEvent<Protocol.ReactNativeApplication.MetadataUpdatedEvent>): void {
    const {appDisplayName, deviceName} = event.data;

    // Update window title
    FuseboxWindowTitleManager.instance().setAppInfo(appDisplayName, deviceName);
  }
}
