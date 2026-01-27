// Copyright 2026 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as Common from '../../core/common/common.js';
import * as i18n from '../../core/i18n/i18n.js';
import type * as Platform from '../../core/platform/platform.js';
import * as UI from '../../ui/legacy/legacy.js';

import {
  LivemateModel,
  Events as LivemateModelEvents,
  type EventTypes as LivemateModelEventTypes,
} from './LivemateModel.js';
import livematePanelStyles from './livematePanel.css.js';
import type {ComponentInfo} from './LivemateSpec.js';

let livematePanelInstance: LivematePanel;

const UIStrings = {
  /**
   * @description Title of the Livemate panel
   */
  title: 'Livemate',
  /**
   * @description Button text for picking a component
   */
  pickComponent: 'Pick component',
  /**
   * @description Placeholder text for the query input
   */
  queryPlaceholder: 'Query to modify component...',
  /**
   * @description Button text for sending to devmate
   */
  sendToDevmate: 'Send to Devmate',
} as const;

const str_ = i18n.i18n.registerUIStrings(
  'panels/livemate/LivematePanel.ts',
  UIStrings
);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

type ElementSelectedEvent =
    Common.EventTarget.EventTargetEvent<LivemateModelEventTypes[LivemateModelEvents.ELEMENT_SELECTED]>;
type InspectionStateChangedEvent =
    Common.EventTarget.EventTargetEvent<LivemateModelEventTypes[LivemateModelEvents.INSPECTION_STATE_CHANGED]>;

/**
 * LivematePanel provides an AI-assisted interface for inspecting and modifying
 * React Native components.
 *
 * It uses CDP communication via LivemateModel to:
 * 1. Enable/disable the Livemate subsystem on the React Native side
 * 2. Toggle inspection mode for element selection
 * 3. Receive selected element data via Runtime.bindingCalled
 */
export class LivematePanel extends UI.View.SimpleView {
  readonly #model: LivemateModel;
  #currentHierarchy: ComponentInfo[] = [];
  #pickButton?: HTMLButtonElement;
  #breadcrumb?: HTMLDivElement;
  #queryInput?: HTMLTextAreaElement;

  static instance(): LivematePanel {
    if (!livematePanelInstance) {
      livematePanelInstance = new LivematePanel();
    }
    return livematePanelInstance;
  }

  private constructor() {
    super(i18nString(UIStrings.title) as Platform.UIString.LocalizedString, true);
    this.registerRequiredCSS(livematePanelStyles);
    this.element.style.userSelect = 'text';

    this.#model = LivemateModel.instance();
    this.#setupModelListeners();
    this.#renderPanel();
  }

  #setupModelListeners(): void {
    this.#model.addEventListener(
      LivemateModelEvents.ELEMENT_SELECTED,
      this.#onElementSelected,
      this
    );
    this.#model.addEventListener(
      LivemateModelEvents.INSPECTION_STATE_CHANGED,
      this.#onInspectionStateChanged,
      this
    );
  }

  #onElementSelected = (event: ElementSelectedEvent): void => {
    const elementData = event.data;
    this.#currentHierarchy = elementData.hierarchy;
    this.#updateBreadcrumb();
  };

  #onInspectionStateChanged = (event: InspectionStateChangedEvent): void => {
    const {inspecting} = event.data;
    if (this.#pickButton) {
      this.#pickButton.style.backgroundColor = inspecting
        ? 'var(--sys-color-primary)'
        : '';
      this.#pickButton.style.color = inspecting
        ? 'var(--sys-color-on-primary)'
        : '';
    }
  };

  override wasShown(): void {
    super.wasShown();
    // Enable Livemate when the panel is shown
    void this.#model.enable();
  }

  override willHide(): void {
    super.willHide();
    // Disable Livemate when the panel is hidden
    void this.#model.disable();
  }

  #renderPanel(): void {
    this.#clearView();
    this.contentElement.classList.add('livemate-panel');

    // Create outer wrapper for centering
    const outerWrapper = document.createElement('div');
    outerWrapper.setAttribute(
      'style',
      'display: flex; justify-content: center; align-items: center; min-height: 100%;'
    );

    // Create toolbar container
    const toolbarContainer = document.createElement('div');
    toolbarContainer.setAttribute(
      'style',
      'display: flex; flex-direction: column; padding: 20px; gap: 12px; max-width: 800px; width: 100%; margin: 0 20px; border: 1px solid var(--sys-color-divider); border-radius: 8px; background: var(--sys-color-surface);'
    );

    // First row: pick component button and breadcrumb
    const topRow = document.createElement('div');
    topRow.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');

    // Pick component button
    this.#pickButton = document.createElement('button');
    this.#pickButton.textContent = i18nString(UIStrings.pickComponent);
    this.#pickButton.setAttribute('style', 'padding: 4px 12px; cursor: pointer;');
    this.#pickButton.addEventListener('click', () => {
      void this.#model.toggleInspection();
    });
    topRow.appendChild(this.#pickButton);

    // Breadcrumb view
    this.#breadcrumb = document.createElement('div');
    this.#breadcrumb.setAttribute(
      'style',
      'flex: 1; font-family: monospace; font-size: 12px; color: var(--sys-color-on-surface); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;'
    );
    topRow.appendChild(this.#breadcrumb);

    // Second row: AI query input and send button
    const bottomRow = document.createElement('div');
    bottomRow.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');

    // AI query text box
    this.#queryInput = document.createElement('textarea');
    this.#queryInput.setAttribute('placeholder', i18nString(UIStrings.queryPlaceholder));
    this.#queryInput.setAttribute(
      'style',
      'flex: 1; padding: 12px 16px; border: 1px solid var(--sys-color-divider); border-radius: 4px; background: var(--sys-color-cdt-base-container); color: var(--sys-color-on-surface); font-size: 14px; min-height: 100px; resize: vertical; font-family: inherit;'
    );

    // Handle Enter key to send prompt (Shift+Enter for newline)
    this.#queryInput.addEventListener('keydown', async (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        await this.#sendCommand();
      }
    });

    // Send to devmate button
    const sendButton = document.createElement('button');
    sendButton.textContent = i18nString(UIStrings.sendToDevmate);
    sendButton.setAttribute('style', 'padding: 4px 12px; cursor: pointer; align-self: flex-end;');
    sendButton.addEventListener('click', async () => {
      await this.#sendCommand();
    });

    bottomRow.appendChild(this.#queryInput);
    bottomRow.appendChild(sendButton);

    toolbarContainer.appendChild(topRow);
    toolbarContainer.appendChild(bottomRow);

    outerWrapper.appendChild(toolbarContainer);
    this.contentElement.appendChild(outerWrapper);
  }

  #updateBreadcrumb(): void {
    if (!this.#breadcrumb) {
      return;
    }

    this.#breadcrumb.innerHTML = '';

    if (this.#currentHierarchy.length === 0) {
      return;
    }

    this.#currentHierarchy.forEach((component, index) => {
      const componentSpan = document.createElement('span');
      componentSpan.textContent = component.displayName || component.name;
      componentSpan.setAttribute(
        'style',
        'cursor: pointer; color: var(--sys-color-primary); text-decoration: underline;'
      );
      componentSpan.addEventListener('mouseenter', () => {
        componentSpan.style.opacity = '0.7';
      });
      componentSpan.addEventListener('mouseleave', () => {
        componentSpan.style.opacity = '1';
      });

      this.#breadcrumb?.appendChild(componentSpan);

      if (index < this.#currentHierarchy.length - 1) {
        const separator = document.createElement('span');
        separator.textContent = '>';
        separator.setAttribute('style', 'opacity: 0.6;');
        this.#breadcrumb?.appendChild(separator);
      }
    });
  }

  async #sendCommand(): Promise<{success: boolean, output?: string, error?: string}> {
    const input = this.#queryInput;
    if (!input) {
      return {success: false, error: 'Input not available'};
    }

    const query = input.value;
    let prompt;
    if (query.trim()) {
      prompt = query;
      if (this.#currentHierarchy.length > 0) {
        const focusedComponent =
          this.#currentHierarchy[this.#currentHierarchy.length - 1].displayName ||
          this.#currentHierarchy[this.#currentHierarchy.length - 1].name;
        const hierarchyStr = this.#currentHierarchy
          .map(c => c.displayName || c.name)
          .join(' > ');
        prompt = `Focused component: ${focusedComponent}\nComponent hierarchy: ${hierarchyStr}\n\nQuery: ${query}`;
      }
    }

    const controller = new AbortController();
    const timeoutMs = 5000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('http://localhost:8081/livemate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({prompt}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        input.value = '';
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      return result;
    } catch (e) {
      clearTimeout(timeoutId);

      if (e instanceof Error && e.name === 'AbortError') {
        input.value = '';
        return {
          success: false,
          error: 'Request timeout',
        };
      }

      input.value = '';
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  #clearView(): void {
    this.contentElement.removeChildren();
  }
}
