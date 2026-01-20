// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import { ReactDevToolsViewBase } from '../react_devtools/ReactDevToolsViewBase.js';

import livematePanelStyles from './livematePanel.css.js';

let livematePanelInstance: LivematePanel;

const UIStrings = {
  /**
   *@description Title of the React DevTools view
   */
  title: '⚛️ Livemate',
} as const;
const str_ = i18n.i18n.registerUIStrings(
  'panels/livemate/LivematePanel.ts',
  UIStrings
);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class LivematePanel extends ReactDevToolsViewBase {
  static instance(): LivematePanel {
    if (!livematePanelInstance) {
      livematePanelInstance = new LivematePanel();
    }
    return livematePanelInstance;
  }

  constructor() {
    super('components', i18nString(UIStrings.title));
    this.registerRequiredCSS(livematePanelStyles);
  }

  override renderDevToolsView(): void {
    this.clearView();

    this.contentElement.classList.add('livemate-panel');

    const model = this.model;
    if (model === null) {
      throw new Error('Attempted to render React DevTools panel, but the model was null');
    }

    const bridge = model.getBridgeOrThrow();

    // Create outer wrapper for centering
    const outerWrapper = document.createElement('div');
    outerWrapper.setAttribute('style', 'display: flex; justify-content: center; align-items: center; min-height: 100%;');

    // Create toolbar container
    const toolbarContainer = document.createElement('div');
    toolbarContainer.setAttribute('style', 'display: flex; flex-direction: column; padding: 20px; gap: 12px; max-width: 800px; width: 100%; margin: 0 20px; border: 1px solid var(--sys-color-divider); border-radius: 8px; background: var(--sys-color-surface);');

    // First row: pick component button and breadcrumb
    const topRow = document.createElement('div');
    topRow.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');

    // Pick component button
    const pickComponentButton = document.createElement('button');
    pickComponentButton.textContent = 'Pick component';
    pickComponentButton.setAttribute('style', 'padding: 4px 12px; cursor: pointer;');
    pickComponentButton.addEventListener('click', () => {
      (bridge as unknown as {send: (event: string) => void}).send('startInspectingHost');
    });
    topRow.appendChild(pickComponentButton);

    // Breadcrumb view
    const breadcrumb = document.createElement('div');
    breadcrumb.setAttribute('style', 'flex: 1; font-family: monospace; font-size: 12px; color: var(--sys-color-on-surface); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;');

    // Selected component box
    // const selectedComponentBox = document.createElement('div');
    // selectedComponentBox.setAttribute('style', 'padding: 4px 8px; border: 1px solid var(--sys-color-divider); border-radius: 4px; background: var(--sys-color-surface-variant); font-family: monospace; font-size: 12px; color: var(--sys-color-on-surface);');
    // selectedComponentBox.textContent = '';

    // Track the current hierarchy for prompt context
    let currentHierarchy: Array<{name: string}> = [];

    // Function to update breadcrumb with component data
    const updateBreadcrumb = (components: Array<{name: string}>): void => {
      breadcrumb.innerHTML = '';

      if (components.length === 0) {
        return;
      }

      // Set the selected component to the first one (most specific)
      // selectedComponentBox.textContent = components[0].name;

      // Show remaining components as breadcrumb (skip the first since it's in the selected box)
      const breadcrumbComponents = components.slice(-5);

      breadcrumbComponents.forEach((component, index) => {
        const componentSpan = document.createElement('span');
        componentSpan.textContent = component.name;
        componentSpan.setAttribute('style', 'cursor: pointer; color: var(--sys-color-primary); text-decoration: underline;');
        componentSpan.addEventListener('mouseenter', () => {
          componentSpan.style.opacity = '0.7';
        });
        componentSpan.addEventListener('mouseleave', () => {
          componentSpan.style.opacity = '1';
        });

        breadcrumb.appendChild(componentSpan);

        if (index < breadcrumbComponents.length - 1) {
          const separator = document.createElement('span');
          separator.textContent = '>';
          separator.setAttribute('style', 'color: var(--sys-color-on-surface); opacity: 0.6;');
          breadcrumb.appendChild(separator);
        }
      });
    };

    // Listen for component data from React DevTools
    bridge.addListener('viewDataAtPoint', (data: unknown) => {
      currentHierarchy = data as Array<{name: string}>;
      updateBreadcrumb(currentHierarchy);
    });

    topRow.appendChild(breadcrumb);

    // Second row: AI query input and send button
    const bottomRow = document.createElement('div');
    bottomRow.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');

    // AI query text box
    const queryInput: HTMLTextAreaElement = document.createElement('textarea');
    queryInput.setAttribute('placeholder', 'Query to modify component...');
    queryInput.setAttribute('style', 'flex: 1; padding: 12px 16px; border: 1px solid var(--sys-color-divider); border-radius: 4px; background: var(--sys-color-cdt-base-container); color: var(--sys-color-on-surface); font-size: 14px; min-height: 100px; resize: vertical; font-family: inherit;');

    // Handle Enter key to send prompt (Shift+Enter for newline)
    queryInput.addEventListener('keydown', async (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        await sendCommandToMetro(queryInput, currentHierarchy);
      }
    });

    // Send to devmate button
    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send to Devmate';
    sendButton.setAttribute('style', 'padding: 4px 12px; cursor: pointer; align-self: flex-end;');
    sendButton.addEventListener('click', async () => {
      await sendCommandToMetro(queryInput, currentHierarchy);
    });

    bottomRow.appendChild(queryInput);
    bottomRow.appendChild(sendButton);

    toolbarContainer.appendChild(topRow);
    toolbarContainer.appendChild(bottomRow);

    outerWrapper.appendChild(toolbarContainer);
    this.contentElement.appendChild(outerWrapper);
  }
}

async function sendCommandToMetro(
  input: HTMLTextAreaElement,
  currentHierarchy: Array<{name: string}> = [],
  timeoutMs = 5000
): Promise<{success: boolean; output?: string; error?: string}> {
  const query = input.value;
  let prompt;
  if (query.trim()) {
    prompt = query;
    if (currentHierarchy.length > 0) {
      const focusedComponent = currentHierarchy[currentHierarchy.length - 1].name;
      const hierarchyStr = currentHierarchy.map(c => c.name).join(' > ');
      prompt = `Focused component: ${focusedComponent}\nComponent hierarchy: ${hierarchyStr}\n\nQuery: ${query}`;
    }
  }

  const controller = new AbortController();
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
