// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as ProtocolClient from '../../core/protocol_client/protocol_client.js';

import {
  LivemateEventType,
  parseLivemateEvent,
  type ElementData,
} from './LivemateSpec.js';

export type {ElementData} from './LivemateSpec.js';

let livemateModelInstance: LivemateModel | undefined;

/**
 * CDP domain constants for Livemate.
 * These match the domain implemented on the C++ side.
 */
const LivemateDomain = {
  ENABLE: 'Livemate.enable',
  DISABLE: 'Livemate.disable',
  ENABLE_INSPECTION: 'Livemate.enableInspection',
  DISABLE_INSPECTION: 'Livemate.disableInspection',
  INSPECTION_DATA_RECEIVED: 'Livemate.inspectionDataReceived',
} as const;

/**
 * LivemateModel handles CDP communication between React Native DevTools
 * and the React Native runtime for the Livemate panel.
 *
 * Communication uses the Livemate CDP domain:
 * - Commands: enable, disable, enableInspection, disableInspection
 * - Events: inspectionDataReceived
 */
export class LivemateModel extends Common.ObjectWrapper.ObjectWrapper<EventTypes> implements SDK.TargetManager.Observer {
  #enabled = false;
  #target?: SDK.Target.Target;
  #inspectionEnabled = false;
  #selectedElement?: ElementData;
  #originalOnMessageReceived: ((message: object, target: ProtocolClient.InspectorBackend.TargetBase | null) => void) | null = null;

  private constructor() {
    super();
    SDK.TargetManager.TargetManager.instance().observeTargets(this);
  }

  static instance(opts: {forceNew?: boolean} = {forceNew: false}): LivemateModel {
    const {forceNew} = opts;
    if (!livemateModelInstance || forceNew) {
      livemateModelInstance = new LivemateModel();
    }
    return livemateModelInstance;
  }

  get isEnabled(): boolean {
    return this.#enabled;
  }

  get isInspectionEnabled(): boolean {
    return this.#inspectionEnabled;
  }

  get selectedElement(): ElementData | undefined {
    return this.#selectedElement;
  }

  async targetAdded(target: SDK.Target.Target): Promise<void> {
    if (target !== SDK.TargetManager.TargetManager.instance().primaryPageTarget()) {
      return;
    }
    this.#target = target;
  }

  async targetRemoved(target: SDK.Target.Target): Promise<void> {
    if (target !== this.#target) {
      return;
    }
    await this.disable();
    this.#target = undefined;

    const primaryPageTarget = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (primaryPageTarget) {
      this.#target = primaryPageTarget;
    }
  }

  /**
   * Enables Livemate by sending Livemate.enable CDP command.
   */
  async enable(): Promise<void> {
    if (!this.#target || this.#enabled) {
      return;
    }

    this.#registerEventListener();

    try {
      await this.#sendCdpCommand(LivemateDomain.ENABLE);
      this.#enabled = true;
      this.dispatchEventToListeners(Events.STATUS_CHANGED, {enabled: true});
    } catch (e) {
      console.warn('[Livemate] Failed to enable:', e);
      this.#unregisterEventListener();
    }
  }

  /**
   * Disables Livemate by sending Livemate.disable CDP command.
   */
  async disable(): Promise<void> {
    if (!this.#target || !this.#enabled) {
      return;
    }

    try {
      await this.#sendCdpCommand(LivemateDomain.DISABLE);
    } catch (e) {
      console.warn('[Livemate] Failed to disable:', e);
    }

    this.#unregisterEventListener();
    this.#enabled = false;
    this.#inspectionEnabled = false;
    this.#selectedElement = undefined;
    this.dispatchEventToListeners(Events.STATUS_CHANGED, {enabled: false});
  }

  /**
   * Enables inspection mode by sending Livemate.enableInspection CDP command.
   */
  async enableInspection(): Promise<void> {
    if (!this.#target || !this.#enabled) {
      return;
    }

    try {
      await this.#sendCdpCommand(LivemateDomain.ENABLE_INSPECTION);
      this.#inspectionEnabled = true;
      this.dispatchEventToListeners(Events.INSPECTION_STATE_CHANGED, {inspecting: true});
    } catch (e) {
      console.warn('[Livemate] Failed to enable inspection:', e);
    }
  }

  /**
   * Disables inspection mode by sending Livemate.disableInspection CDP command.
   */
  async disableInspection(): Promise<void> {
    if (!this.#target || !this.#enabled) {
      return;
    }

    try {
      await this.#sendCdpCommand(LivemateDomain.DISABLE_INSPECTION);
      this.#inspectionEnabled = false;
      this.dispatchEventToListeners(Events.INSPECTION_STATE_CHANGED, {inspecting: false});
    } catch (e) {
      console.warn('[Livemate] Failed to disable inspection:', e);
    }
  }

  async toggleInspection(): Promise<void> {
    if (this.#inspectionEnabled) {
      await this.disableInspection();
    } else {
      await this.enableInspection();
    }
  }

  /**
   * Sends a raw CDP command.
   */
  #sendCdpCommand(method: string, params?: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!ProtocolClient.InspectorBackend.test.sendRawMessage) {
        reject(new Error('sendRawMessage not available'));
        return;
      }

      ProtocolClient.InspectorBackend.test.sendRawMessage(
        method as ProtocolClient.InspectorBackend.QualifiedName,
        params ?? null,
        (result: unknown) => {
          resolve(result);
        }
      );
    });
  }

  /**
   * Registers a listener for Livemate CDP events via the message hook.
   */
  #registerEventListener(): void {
    this.#originalOnMessageReceived = ProtocolClient.InspectorBackend.test.onMessageReceived;
    ProtocolClient.InspectorBackend.test.onMessageReceived = (message: object, target) => {
      this.#handleCdpMessage(message);
      if (this.#originalOnMessageReceived) {
        this.#originalOnMessageReceived(message, target);
      }
    };
  }

  #unregisterEventListener(): void {
    ProtocolClient.InspectorBackend.test.onMessageReceived = this.#originalOnMessageReceived;
    this.#originalOnMessageReceived = null;
  }

  /**
   * Handles incoming CDP messages, filtering for Livemate.inspectionDataReceived events.
   */
  #handleCdpMessage(message: object): void {
    const msg = message as {method?: string; params?: {payload?: string}};

    if (msg.method !== LivemateDomain.INSPECTION_DATA_RECEIVED) {
      return;
    }

    const payload = msg.params?.payload;
    if (!payload) {
      console.warn('[Livemate] Received inspectionDataReceived without payload');
      return;
    }

    const livemateEvent = parseLivemateEvent(payload);
    if (!livemateEvent) {
      console.warn('[Livemate] Failed to parse event payload:', payload);
      return;
    }

    switch (livemateEvent.type) {
      case LivemateEventType.ELEMENT_SELECTED:
        if (livemateEvent.data) {
          this.#selectedElement = livemateEvent.data;
          this.dispatchEventToListeners(Events.ELEMENT_SELECTED, livemateEvent.data);
        }
        break;

      case LivemateEventType.INSPECTION_STARTED:
        this.#inspectionEnabled = true;
        this.dispatchEventToListeners(Events.INSPECTION_STATE_CHANGED, {inspecting: true});
        break;

      case LivemateEventType.INSPECTION_STOPPED:
        this.#inspectionEnabled = false;
        this.dispatchEventToListeners(Events.INSPECTION_STATE_CHANGED, {inspecting: false});
        break;
    }
  }
}

export const enum Events {
  STATUS_CHANGED = 'StatusChanged',
  ELEMENT_SELECTED = 'ElementSelected',
  INSPECTION_STATE_CHANGED = 'InspectionStateChanged',
}

export interface StatusChangedEvent {
  enabled: boolean;
}

export interface InspectionStateChangedEvent {
  inspecting: boolean;
}

export interface EventTypes {
  [Events.STATUS_CHANGED]: StatusChangedEvent;
  [Events.ELEMENT_SELECTED]: ElementData;
  [Events.INSPECTION_STATE_CHANGED]: InspectionStateChangedEvent;
}
