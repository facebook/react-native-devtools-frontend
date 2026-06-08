// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
/* eslint-disable @devtools/no-imperative-dom-api */

import type * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import type * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import type * as Protocol from '../../generated/protocol.js';
import * as Marked from '../../third_party/marked/marked.js';
import * as MarkdownView from '../../ui/components/markdown_view/markdown_view.js';
import * as UI from '../../ui/legacy/legacy.js';

import greenDevPanelStyles from './GreenDevPanel.css.js';
import type {SyncMessage} from './GreenDevShared.js';

let greenDevPanelInstance: GreenDevPanel;

export class GreenDevPanel extends UI.Panel.Panel {
  #tabbedPane: UI.TabbedPane.TabbedPane;
  #sessions = new Map<
      string,
      {view: UI.Widget.Widget, container: HTMLDivElement, description: HTMLDivElement, node?: SDK.DOMModel.DOMNode}>();
  #syncChannel: BroadcastChannel;

  private constructor() {
    super('greendev');
    this.contentElement.style.display = 'flex';
    this.contentElement.style.flexDirection = 'column';
    this.contentElement.style.height = '100%';
    this.contentElement.style.overflow = 'hidden';

    this.#tabbedPane = new UI.TabbedPane.TabbedPane();
    this.#tabbedPane.element.style.flex = '1';
    this.#tabbedPane.show(this.contentElement);

    // Welcome Tab
    this.#createWelcomeTab();

    this.#tabbedPane.addEventListener(UI.TabbedPane.Events.TabClosed, this.#onTabClosed, this);

    this.#syncChannel = new BroadcastChannel('green-dev-sync');
    this.#syncChannel.onmessage = event => {
      void this.#handlePanelMessage(event.data as SyncMessage);
    };

    // Request state from active floaties
    this.#syncChannel.postMessage({type: 'request-session-state'});
  }

  override wasShown(): void {
    super.wasShown();
    this.registerRequiredCSS(greenDevPanelStyles);
    SDK.OverlayModel.OverlayModel.setInspectNodeHandler(this.#handleInspectNode.bind(this));
  }

  override willHide(): void {
    super.willHide();
    SDK.OverlayModel.OverlayModel.setInspectNodeHandler(async () => {});
  }

  async #handleInspectNode(_node: SDK.DOMModel.DOMNode): Promise<void> {
    // Suppress reveal in Elements panel by doing nothing here.
    // The Floaty will handle its own opening and broadcasting.
  }

  #onTabClosed(event: Common.EventTarget.EventTargetEvent<UI.TabbedPane.EventData>): void {
    const tabId = event.data.tabId;
    if (tabId === 'welcome') {
      return;
    }
    this.#sessions.delete(tabId);
    if (this.#sessions.size === 0) {
      if (!this.#tabbedPane.hasTab('welcome')) {
        this.#createWelcomeTab();
      }
    }
  }

  #createWelcomeTab(): void {
    const welcomeWidget = new UI.Widget.Widget();
    welcomeWidget.element.style.display = 'flex';
    welcomeWidget.element.style.alignItems = 'center';
    welcomeWidget.element.style.justifyContent = 'center';
    welcomeWidget.element.style.height = '100%';
    const welcomeContent = document.createElement('div');
    welcomeContent.textContent = 'Interact with GreenDev Floaty dialogs to see conversations here.';
    welcomeContent.style.padding = '20px';
    welcomeContent.style.fontSize = '14px';
    welcomeContent.style.color = 'var(--sys-color-on-surface-subtle)';
    welcomeWidget.contentElement.appendChild(welcomeContent);
    this.#tabbedPane.appendTab('welcome', 'Welcome', welcomeWidget);
    this.#tabbedPane.selectTab('welcome');
  }

  closeSession(sessionId: string): void {
    this.#tabbedPane.closeTab(sessionId);
  }

  async #handlePanelMessage(data: SyncMessage): Promise<void> {
    const sessionId = String(data.sessionId);
    if (!sessionId || sessionId === '0' || sessionId === 'undefined') {
      return;
    }

    let session = this.#sessions.get(sessionId);
    if (!session) {
      // If we are adding a new tab, check if we need to remove the welcome tab
      if (this.#tabbedPane.hasTab('welcome')) {
        this.#tabbedPane.closeTab('welcome');
      }

      const widget = new UI.Widget.Widget();
      widget.contentElement.className = 'green-dev-floaty-dialog';
      widget.contentElement.style.display = 'flex';
      widget.contentElement.style.flexDirection = 'column';
      widget.contentElement.style.height = '100%';
      widget.contentElement.style.padding = '0';

      const content = document.createElement('div');
      content.className = 'green-dev-floaty-dialog-content';
      content.style.flexGrow = '1';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.overflow = 'hidden';

      // Top row: Context added
      const topRow = document.createElement('div');
      topRow.className = 'green-dev-floaty-dialog-top-row';
      topRow.style.flexShrink = '0';
      const geminiIcon = document.createElement('div');
      geminiIcon.className = 'green-dev-floaty-dialog-gemini-icon';
      const checkmarkIcon = document.createElement('div');
      checkmarkIcon.className = 'green-dev-floaty-dialog-checkmark-icon';
      const contextText = document.createElement('span');
      contextText.className = 'green-dev-floaty-dialog-context-text';
      contextText.textContent = 'Context added';
      topRow.appendChild(geminiIcon);
      topRow.appendChild(checkmarkIcon);
      topRow.appendChild(contextText);
      content.appendChild(topRow);

      const chatContainer = document.createElement('div');
      chatContainer.className = 'green-dev-floaty-dialog-chat-container';
      chatContainer.style.flexGrow = '1';
      chatContainer.style.overflowY = 'auto';
      content.appendChild(chatContainer);

      const blueCard = document.createElement('div');
      blueCard.className = 'green-dev-floaty-dialog-blue-card';
      blueCard.style.flexShrink = '0';

      const desc = document.createElement('div');
      desc.className = 'green-dev-floaty-dialog-node-description';
      desc.style.whiteSpace = 'normal';
      desc.style.overflow = 'auto';
      blueCard.appendChild(desc);

      const inputRow = document.createElement('div');
      inputRow.className = 'input-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'green-dev-floaty-dialog-text-field';
      input.placeholder = 'Ask a question...';

      const button = document.createElement('button');
      button.className = 'green-dev-floaty-dialog-play-button';

      const sendAction = (): void => {
        const text = input.value;
        if (text) {
          input.value = '';
          // Do not append locally; wait for broadcast from floaty
          this.#syncChannel.postMessage({type: 'user-input', sessionId: parseInt(sessionId, 10), text});
        }
      };

      button.addEventListener('click', sendAction);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          sendAction();
        }
      });

      inputRow.appendChild(input);
      inputRow.appendChild(button);
      blueCard.appendChild(inputRow);

      const disclaimer = document.createElement('div');
      disclaimer.className = 'green-dev-floaty-disclaimer';

      const link = document.createElement('span');
      link.className = 'disclaimer-link';
      link.textContent = 'Relevant data';
      disclaimer.appendChild(link);

      disclaimer.appendChild(document.createTextNode(' is sent to Google'));

      const tooltip = document.createElement('div');
      tooltip.className = 'disclaimer-tooltip';

      tooltip.appendChild(document.createTextNode(
          'Chat messages and any data the inspected page can access via Web APIs are sent to Google and may be seen by human reviewers to improve this feature. This is an experimental AI feature and won\'t always get it right.'));
      tooltip.appendChild(document.createElement('br'));
      tooltip.appendChild(document.createElement('br'));

      const learnMore = document.createElement('a');
      const href = 'https://developer.chrome.com/docs/devtools/ai-assistance' as Platform.DevToolsPath.UrlString;
      learnMore.href = href;
      learnMore.className = 'learn-more-link';
      learnMore.textContent = 'Learn about AI in DevTools';
      learnMore.addEventListener('click', event => {
        event.preventDefault();
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(href);
      });
      tooltip.appendChild(learnMore);

      disclaimer.appendChild(tooltip);
      blueCard.appendChild(disclaimer);

      content.appendChild(blueCard);
      widget.contentElement.appendChild(content);

      this.#sessions.set(sessionId, {view: widget, container: chatContainer, description: desc});
      session = {view: widget, container: chatContainer, description: desc};

      const title = data.nodeDescription || `Node ${sessionId}`;
      this.#tabbedPane.appendTab(sessionId, title, widget, undefined, undefined, true);
      this.#tabbedPane.selectTab(sessionId);
    }

    if (!session.node && (data.type === 'full-state' || data.type === 'node-changed' || !session)) {
      const backendNodeId = parseInt(sessionId, 10);
      const targetManager = SDK.TargetManager.TargetManager.instance();
      let mainTarget = targetManager.primaryPageTarget();

      const fetchNode = async(target: SDK.Target.Target): Promise<void> => {
        const domModel = target.model(SDK.DOMModel.DOMModel);
        if (domModel) {
          const nodesMap = await domModel.pushNodesByBackendIdsToFrontend(
              new Set([backendNodeId]) as Set<Protocol.DOM.BackendNodeId>);
          const node = nodesMap?.get(backendNodeId as Protocol.DOM.BackendNodeId) || null;
          if (node && session) {
            session.node = node;
            this.#addHighlightListeners(session.description, node);
          }
        }
      };

      if (mainTarget) {
        await fetchNode(mainTarget);
      } else {
        targetManager.observeTargets({
          targetAdded: async(target: SDK.Target.Target): Promise<void> => {
            if (target === targetManager.primaryPageTarget()) {
              mainTarget = target;
              await fetchNode(mainTarget);
            }
          },
          targetRemoved: (_: SDK.Target.Target): void => {},
        });
      }
    }

    if (data.type === 'new-message' && data.text) {
      this.#appendMessageToContainer(session.container, data.text, data.isUser ?? false);
    } else if (data.type === 'update-last-message') {
      const lastMsg = session.container.lastElementChild?.querySelector('.message-content devtools-markdown-view');
      if (lastMsg) {
        (lastMsg as MarkdownView.MarkdownView.MarkdownView).data = {
          tokens: Marked.Marked.lexer(data.text ?? ''),
        };
      }
    } else if (data.type === 'full-state') {
      session.container.innerHTML = '';
      if (data.messages) {
        for (const msg of data.messages) {
          this.#appendMessageToContainer(session.container, msg.text, msg.isUser);
        }
      }
    } else if (data.type === 'select-tab') {
      this.#tabbedPane.selectTab(sessionId);
    }

    if (data.nodeDescription) {
      session.description.textContent = data.nodeDescription;
      if (data.type === 'node-changed') {
        this.#tabbedPane.changeTabTitle(sessionId, data.nodeDescription);
      }
    }
  }

  #addHighlightListeners(element: HTMLElement, node: SDK.DOMModel.DOMNode): void {
    element.addEventListener('mousemove', () => {
      node.highlight();
    });
    element.addEventListener('mouseleave', () => {
      void node.domModel().overlayModel().clearHighlight();
    });
  }

  #appendMessageToContainer(container: HTMLDivElement, text: string, isUser: boolean): void {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageElement.style.flexShrink = '0';

    const content = document.createElement('div');
    content.className = 'message-content';
    if (isUser) {
      content.textContent = text;
    } else {
      const markdown = new MarkdownView.MarkdownView.MarkdownView();
      markdown.data = {
        tokens: Marked.Marked.lexer(text),
      };
      content.append(markdown);
      const style = document.createElement('style');
      style.textContent = `
        .message { font-size: 1.0rem; }
        .message code { font-size: 1.0rem; font-family: 'Roboto Mono', monospace; color: green; }
        devtools-code-block {
          white-space: pre-wrap;
        }
      `;
      markdown.shadowRoot?.appendChild(style);

      const codeBlocks = markdown.shadowRoot?.querySelectorAll('devtools-code-block');
      for (const block of codeBlocks ?? []) {
        // We need to rerender the component for the styles to be applied.
        block.connectedCallback();
      }
    }
    content.style.flexGrow = '1';
    messageElement.appendChild(content);

    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;
  }

  static instance(opts: {
    forceNew: boolean|null,
  } = {forceNew: null}): GreenDevPanel {
    const {forceNew} = opts;
    if (!greenDevPanelInstance || forceNew) {
      greenDevPanelInstance = new GreenDevPanel();
    }

    return greenDevPanelInstance;
  }
}

// Expose global method for browser process to call
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).GreenDevPanel = {
  closeSession: (sessionId: number): void => {
    if (greenDevPanelInstance) {
      greenDevPanelInstance.closeSession(String(sessionId));
    }
  },
};
