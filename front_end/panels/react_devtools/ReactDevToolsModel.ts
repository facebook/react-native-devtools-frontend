// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as Common from '../../core/common/common.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as ReactNativeModels from '../../models/react_native/react_native.js';
import type * as ReactDevToolsTypes from '../../third_party/react-devtools/react-devtools.js';
import * as ReactDevTools from '../../third_party/react-devtools/react-devtools.js';

export const enum Events {
  INITIALIZATION_COMPLETED = 'InitializationCompleted',
  INITIALIZATION_FAILED = 'InitializationFailed',
  DESTROYED = 'Destroyed',
}

export interface EventTypes {
  [Events.INITIALIZATION_COMPLETED]: void;
  [Events.INITIALIZATION_FAILED]: string;
  [Events.DESTROYED]: void;
}

type ReactDevToolsBindingsBackendExecutionContextUnavailableEvent = Common.EventTarget.EventTargetEvent<
    ReactNativeModels.ReactDevToolsBindingsModel
        .EventTypes[ReactNativeModels.ReactDevToolsBindingsModel.Events.BACKEND_EXECUTION_CONTEXT_UNAVAILABLE]>;

export class ReactDevToolsModel extends SDK.SDKModel.SDKModel<EventTypes> {
  private static readonly FUSEBOX_BINDING_NAMESPACE = 'react-devtools';

  readonly #wall: ReactDevToolsTypes.Wall;
  readonly #bindingsModel: ReactNativeModels.ReactDevToolsBindingsModel.ReactDevToolsBindingsModel;
  readonly #listeners = new Set<ReactDevToolsTypes.WallListener>();
  #initializeCalled = false;
  #initialized = false;
  #bridge: ReactDevToolsTypes.Bridge | null = null;
  #store: ReactDevToolsTypes.Store | null = null;

  constructor(target: SDK.Target.Target) {
    super(target);

    this.#wall = {
      listen: (listener): () => void => {
        this.#listeners.add(listener);

        return (): void => {
          this.#listeners.delete(listener);
        };
      },
      send: (event, payload): void => void this.#sendMessage({event, payload}),
    };

    const bindingsModel = target.model(ReactNativeModels.ReactDevToolsBindingsModel.ReactDevToolsBindingsModel);
    if (bindingsModel === null) {
      throw new Error('Failed to construct ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    this.#bindingsModel = bindingsModel;

    bindingsModel.addEventListener(
        ReactNativeModels.ReactDevToolsBindingsModel.Events.BACKEND_EXECUTION_CONTEXT_CREATED,
        this.#handleBackendExecutionContextCreated,
        this,
    );
    bindingsModel.addEventListener(
        ReactNativeModels.ReactDevToolsBindingsModel.Events.BACKEND_EXECUTION_CONTEXT_UNAVAILABLE,
        this.#handleBackendExecutionContextUnavailable,
        this,
    );
    bindingsModel.addEventListener(
        ReactNativeModels.ReactDevToolsBindingsModel.Events.BACKEND_EXECUTION_CONTEXT_DESTROYED,
        this.#handleBackendExecutionContextDestroyed,
        this,
    );

    // Notify backend if Chrome DevTools was closed, marking frontend as disconnected
    window.addEventListener('beforeunload', this.#handleBeforeUnload);
  }

  override dispose(): void {
    this.#bridge?.removeListener('reloadAppForProfiling', this.#handleReloadAppForProfiling);
    this.#bridge?.shutdown();

    this.#bindingsModel.removeEventListener(
        ReactNativeModels.ReactDevToolsBindingsModel.Events.BACKEND_EXECUTION_CONTEXT_CREATED,
        this.#handleBackendExecutionContextCreated,
        this,
    );
    this.#bindingsModel.removeEventListener(
        ReactNativeModels.ReactDevToolsBindingsModel.Events.BACKEND_EXECUTION_CONTEXT_UNAVAILABLE,
        this.#handleBackendExecutionContextUnavailable,
        this,
    );
    this.#bindingsModel.removeEventListener(
        ReactNativeModels.ReactDevToolsBindingsModel.Events.BACKEND_EXECUTION_CONTEXT_DESTROYED,
        this.#handleBackendExecutionContextDestroyed,
        this,
    );

    window.removeEventListener('beforeunload', this.#handleBeforeUnload);

    this.#bridge = null;
    this.#store = null;
    this.#listeners.clear();
  }

  ensureInitialized(): void {
    if (this.#initializeCalled) {
      return;
    }

    this.#initializeCalled = true;
    void this.#initialize();
  }

  async #initialize(): Promise<void> {
    try {
      const bindingsModel = this.#bindingsModel;
      await bindingsModel.enable();

      bindingsModel.subscribeToDomainMessages(
        ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE,
          message => this.#handleMessage(message as ReactDevToolsTypes.Message),
      );

      await bindingsModel.initializeDomain(ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE);

      this.#initialized = true;
      this.#finishInitializationAndNotify();
    } catch (e) {
      this.dispatchEventToListeners(Events.INITIALIZATION_FAILED, e.message);
    }
  }

  isInitialized(): boolean {
    return this.#initialized;
  }

  getBridgeOrThrow(): ReactDevToolsTypes.Bridge {
    if (this.#bridge === null) {
      throw new Error('Failed to get bridge from ReactDevToolsModel: bridge was null');
    }

    return this.#bridge;
  }

  getStoreOrThrow(): ReactDevToolsTypes.Store {
    if (this.#store === null) {
      throw new Error('Failed to get store from ReactDevToolsModel: store was null');
    }

    return this.#store;
  }

  #handleMessage(message: ReactDevToolsTypes.Message): void {
    if (!message) {
      return;
    }

    for (const listener of this.#listeners) {
      listener(message);
    }
  }

  async #sendMessage(message: ReactDevToolsTypes.Message): Promise<void> {
    const rdtBindingsModel = this.#bindingsModel;
    if (!rdtBindingsModel) {
      throw new Error('Failed to send message from ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    return await rdtBindingsModel.sendMessage(ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE, message);
  }

  #handleBeforeUnload = (): void => {
    this.#bridge?.shutdown();
  };

  #handleBackendExecutionContextCreated(): void {
    const rdtBindingsModel = this.#bindingsModel;
    if (!rdtBindingsModel) {
      throw new Error('ReactDevToolsModel failed to handle BackendExecutionContextCreated event: ReactDevToolsBindingsModel was null');
    }

    // This could happen if the app was reloaded while ReactDevToolsBindingsModel was initializing
    if (!rdtBindingsModel.isEnabled()) {
      this.ensureInitialized();
    } else {
      this.#finishInitializationAndNotify();
    }
  }

  #finishInitializationAndNotify(): void {
    this.#bridge = ReactDevTools.createBridge(this.#wall);
    this.#store = ReactDevTools.createStore(this.#bridge, {
      supportsReloadAndProfile: true,
    });
    this.#bridge.addListener('reloadAppForProfiling', this.#handleReloadAppForProfiling);
    this.dispatchEventToListeners(Events.INITIALIZATION_COMPLETED);
  }

  #handleReloadAppForProfiling(): void {
    const mainTarget = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    void mainTarget?.pageAgent().invoke_reload({ignoreCache: true});
  }

  #handleBackendExecutionContextUnavailable({data: errorMessage}: ReactDevToolsBindingsBackendExecutionContextUnavailableEvent): void {
    this.dispatchEventToListeners(Events.INITIALIZATION_FAILED, errorMessage);
  }

  #handleBackendExecutionContextDestroyed(): void {
    this.#bridge?.shutdown();
    this.#bridge = null;
    this.#store = null;
    this.#listeners.clear();

    this.dispatchEventToListeners(Events.DESTROYED);
  }
}

SDK.SDKModel.SDKModel.register(ReactDevToolsModel, {capabilities: SDK.Target.Capability.JS, autostart: false});
