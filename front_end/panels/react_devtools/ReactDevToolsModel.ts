// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../core/sdk/sdk.js';
import * as ReactNativeModels from '../../models/react_native/react_native.js';

import type * as ReactDevToolsTypes from '../../third_party/react-devtools/react-devtools.js';
import type * as Common from '../../core/common/common.js';

export const enum Events {
  InitializationCompleted = 'InitializationCompleted',
  InitializationFailed = 'InitializationFailed',
  Destroyed = 'Destroyed',
  MessageReceived = 'MessageReceived',
}

export type EventTypes = {
  [Events.InitializationCompleted]: void,
  [Events.InitializationFailed]: string,
  [Events.Destroyed]: void,
  [Events.MessageReceived]: ReactDevToolsTypes.Message,
};

type ReactDevToolsBindingsBackendExecutionContextUnavailableEvent = Common.EventTarget.EventTargetEvent<
  ReactNativeModels.ReactDevToolsBindingsModel.EventTypes[
    ReactNativeModels.ReactDevToolsBindingsModel.Events.BackendExecutionContextUnavailable
  ]
>;

export class ReactDevToolsModel extends SDK.SDKModel.SDKModel<EventTypes> {
  private static readonly FUSEBOX_BINDING_NAMESPACE = 'react-devtools';
  private readonly rdtBindingsModel: ReactNativeModels.ReactDevToolsBindingsModel.ReactDevToolsBindingsModel | null;

  constructor(target: SDK.Target.Target) {
    super(target);

    const rdtBindingsModel = target.model(ReactNativeModels.ReactDevToolsBindingsModel.ReactDevToolsBindingsModel);
    if (!rdtBindingsModel) {
      throw new Error('Failed to construct ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    this.rdtBindingsModel = rdtBindingsModel;

    rdtBindingsModel.addEventListener(ReactNativeModels.ReactDevToolsBindingsModel.Events.BackendExecutionContextCreated, this.onBackendExecutionContextCreated, this);
    rdtBindingsModel.addEventListener(ReactNativeModels.ReactDevToolsBindingsModel.Events.BackendExecutionContextUnavailable, this.onBackendExecutionContextUnavailable, this);
    rdtBindingsModel.addEventListener(ReactNativeModels.ReactDevToolsBindingsModel.Events.BackendExecutionContextDestroyed, this.onBackendExecutionContextDestroyed, this);

    void this.initialize(rdtBindingsModel);
  }

  private async initialize(rdtBindingsModel: ReactNativeModels.ReactDevToolsBindingsModel.ReactDevToolsBindingsModel): Promise<void> {
    return rdtBindingsModel.enable()
      .then(() => this.onBindingsModelInitializationCompleted())
      .catch((error: Error) => this.onBindingsModelInitializationFailed(error));
  }

  private onBindingsModelInitializationCompleted(): void {
    const rdtBindingsModel = this.rdtBindingsModel;
    if (!rdtBindingsModel) {
      throw new Error('Failed to initialize ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    rdtBindingsModel.subscribeToDomainMessages(
      ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE,
        message => this.onMessage(message as ReactDevToolsTypes.Message),
    );

    void rdtBindingsModel.initializeDomain(ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE)
      .then(() => this.onDomainInitializationCompleted())
      .catch((error: Error) => this.onDomainInitializationFailed(error));
  }

  private onBindingsModelInitializationFailed(error: Error): void {
    this.dispatchEventToListeners(Events.InitializationFailed, error.message);
  }

  private onDomainInitializationCompleted(): void {
    this.dispatchEventToListeners(Events.InitializationCompleted);
  }

  private onDomainInitializationFailed(error: Error): void {
    this.dispatchEventToListeners(Events.InitializationFailed, error.message);
  }

  private onMessage(message: ReactDevToolsTypes.Message): void {
    this.dispatchEventToListeners(Events.MessageReceived, message);
  }

  async sendMessage(message: ReactDevToolsTypes.Message): Promise<void> {
    const rdtBindingsModel = this.rdtBindingsModel;
    if (!rdtBindingsModel) {
      throw new Error('Failed to send message from ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    return rdtBindingsModel.sendMessage(ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE, message);
  }

  private onBackendExecutionContextCreated(): void {
    const rdtBindingsModel = this.rdtBindingsModel;
    if (!rdtBindingsModel) {
      throw new Error('ReactDevToolsModel failed to handle BackendExecutionContextCreated event: ReactDevToolsBindingsModel was null');
    }

    // This could happen if the app was reloaded while ReactDevToolsBindingsModel was initialing
    if (!rdtBindingsModel.isEnabled()) {
      void this.initialize(rdtBindingsModel);
    } else {
      this.dispatchEventToListeners(Events.InitializationCompleted);
    }
  }

  private onBackendExecutionContextUnavailable({data: errorMessage}: ReactDevToolsBindingsBackendExecutionContextUnavailableEvent): void {
    this.dispatchEventToListeners(Events.InitializationFailed, errorMessage);
  }

  private onBackendExecutionContextDestroyed(): void {
    this.dispatchEventToListeners(Events.Destroyed);
  }
}

SDK.SDKModel.SDKModel.register(ReactDevToolsModel, {capabilities: SDK.Target.Capability.JS, autostart: false});
