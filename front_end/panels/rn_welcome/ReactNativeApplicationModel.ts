// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../core/sdk/sdk.js';

import type * as ProtocolProxyApi from '../../generated/protocol-proxy-api.js';
import type * as Protocol from '../../generated/protocol.js';

export class ReactNativeApplicationModel extends SDK.SDKModel.SDKModel<EventTypes> implements ProtocolProxyApi.ReactNativeApplicationDispatcher {
  private enabled: boolean;
  private readonly agent: ProtocolProxyApi.ReactNativeApplicationApi;

  constructor(target: SDK.Target.Target) {
    super(target);

    this.enabled = false;
    this.agent = target.reactNativeApplicationAgent();
    target.registerReactNativeApplicationDispatcher(this);
  }

  ensureEnabled(): void {
    if (this.enabled) {
      return;
    }

    void this.agent.invoke_enable();
    this.enabled = true;
  }

  metadataUpdated(metadata: Protocol.ReactNativeApplication.MetadataUpdatedEvent): void {
    this.dispatchEventToListeners(Events.MetadataUpdated, metadata);
  }
}

export const enum Events {
  MetadataUpdated = 'MetadataUpdated',
}

export type EventTypes = {
  [Events.MetadataUpdated]: Protocol.ReactNativeApplication.MetadataUpdatedEvent,
};

SDK.SDKModel.SDKModel.register(
  ReactNativeApplicationModel,
  {
    capabilities: SDK.Target.Capability.None,
    autostart: true,
  },
);
