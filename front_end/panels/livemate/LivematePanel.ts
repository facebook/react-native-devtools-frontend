// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Host from '../../core/host/host.js';
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

    const promptSection = this.contentElement.createChild(
      'div',
      'livemate-prompt-section'
    );

    const promptTextarea = document.createElement('textarea');
    promptTextarea.className = 'livemate-prompt-input';
    promptTextarea.placeholder = 'Ask Devmate anything about this app...';
    promptSection.appendChild(promptTextarea);

    const sendButton = promptSection.createChild(
      'button',
      'livemate-send-button'
    );
    sendButton.textContent = 'Send to Devmate';

    const statusArea = promptSection.createChild('div', 'livemate-status');

    const handleSend = (): void => {
      const prompt = promptTextarea.value.trim();
      if (!prompt) {
        statusArea.textContent = 'Please enter a prompt';
        statusArea.className = 'livemate-status error';
        return;
      }
      statusArea.textContent = 'Sending to Devmate...';
      statusArea.className = 'livemate-status pending';

      (
        Host.InspectorFrontendHost.InspectorFrontendHostInstance as unknown as {
          sendToDevmate: (prompt: string) => void,
        }
      ).sendToDevmate(prompt);
    };

    sendButton.addEventListener('click', handleSend);
    promptTextarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSend();
      }
    });
  }
}
