// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as ProtocolProxyApi from '../../generated/protocol-proxy-api.js';
import type * as Protocol from '../../generated/protocol.js';

import {Capability, type Target} from './Target.js';
import {SDKModel} from './SDKModel.js';

export class ReactNativeApplicationModel extends SDKModel<EventTypes> implements ProtocolProxyApi.ReactNativeApplicationDispatcher {
  #enabled: boolean;
  readonly #agent: ProtocolProxyApi.ReactNativeApplicationApi;

  metadataCached: Protocol.ReactNativeApplication.MetadataUpdatedEvent | null = null;

  constructor(target: Target) {
    super(target);

    this.#enabled = false;
    this.#agent = target.reactNativeApplicationAgent();
    target.registerReactNativeApplicationDispatcher(this);
  }

  ensureEnabled(): void {
    if (this.#enabled) {
      return;
    }

    void this.#agent.invoke_enable();
    this.#enabled = true;
  }

  metadataUpdated(metadata: Protocol.ReactNativeApplication.MetadataUpdatedEvent): void {
    this.metadataCached = metadata;
    this.dispatchEventToListeners(Events.MetadataUpdated, metadata);
  }
}

export const enum Events {
  MetadataUpdated = 'MetadataUpdated',
}

export type EventTypes = {
  [Events.MetadataUpdated]: Protocol.ReactNativeApplication.MetadataUpdatedEvent,
};

SDKModel.register(
  ReactNativeApplicationModel,
  {
    capabilities: Capability.None,
    autostart: true,
  },
);
