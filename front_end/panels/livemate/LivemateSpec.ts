// Copyright 2026 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Binding name used for JS->DevTools communication.
 * This binding is installed on the React Native side and called when
 * Inspector selects an element to propagate view data to DevTools.
 */
export const LIVEMATE_BINDING_NAME = '__livemate_devtools_binding';

/**
 * Event types that can be received from the React Native side.
 */
export const enum LivemateEventType {
  ELEMENT_SELECTED = 'elementSelected',
  INSPECTION_STARTED = 'inspectionStarted',
  INSPECTION_STOPPED = 'inspectionStopped',
}

/**
 * Data structure for selected element information.
 */
export interface ElementData {
  /**
   * Component hierarchy from root to selected element.
   */
  hierarchy: ComponentInfo[];
  /**
   * Props of the selected component.
   */
  props?: Record<string, unknown>;
  /**
   * Additional metadata about the selected element.
   */
  metadata?: Record<string, unknown>;
}

export interface ComponentInfo {
  name: string;
  displayName?: string;
}

/**
 * Event payload received from the binding call.
 */
export interface LivemateEvent {
  type: LivemateEventType;
  data?: ElementData;
}

/**
 * Parses a binding payload into a LivemateEvent.
 */
export function parseLivemateEvent(payload: string): LivemateEvent | null {
  try {
    const event = JSON.parse(payload) as LivemateEvent;
    const validTypes: string[] = [
      LivemateEventType.ELEMENT_SELECTED,
      LivemateEventType.INSPECTION_STARTED,
      LivemateEventType.INSPECTION_STOPPED,
    ];
    if (!event.type || !validTypes.includes(event.type)) {
      return null;
    }
    return event;
  } catch {
    return null;
  }
}
