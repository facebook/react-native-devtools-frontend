// Copyright 2018 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import type * as Platform from '../../core/platform/platform.js';
import * as Root from '../../core/root/root.js';
import * as Buttons from '../../ui/components/buttons/buttons.js';
import {html, render} from '../../ui/lit/lit.js';

import {Dialog} from './Dialog.js';
import {SizeBehavior} from './GlassPane.js';
import remoteDebuggingTerminatedScreenStyles from './remoteDebuggingTerminatedScreen.css.js';
import {VBox} from './Widget.js';

const UIStrings = {
  /**
   * @description Title of a dialog box that appears when remote debugging has been terminated.
   */
  title: 'DevTools is disconnected',
  /**
   * @description Text in a dialog box in DevTools stating that remote debugging has been terminated.
   * "Remote debugging" here means that DevTools on a PC is inspecting a website running on an actual mobile device
   * (see https://developer.chrome.com/docs/devtools/remote-debugging/).
   */
  debuggingConnectionWasClosed: 'Debugging connection was closed. Reason: ',
  /**
   * @description Text in a dialog box in DevTools providing extra details on why remote debugging has been terminated.
   * "Remote debugging" here means that DevTools on a PC is inspecting a website running on an actual mobile device
   * (see https://developer.chrome.com/docs/devtools/remote-debugging/).
   */
  debuggingConnectionWasClosedDetails: 'Details: ',
  /**
   * @description Text in a dialog box showing how to reconnect to DevTools when remote debugging has been terminated.
   * "Remote debugging" here means that DevTools on a PC is inspecting a website running on an actual mobile device
   * (see https://developer.chrome.com/docs/devtools/remote-debugging/).
   * "Reconnect when ready", refers to the state of the mobile device. The developer first has to put the mobile
   * device back in a state where it can be inspected, before DevTools can reconnect to it.
   */
  reconnectWhenReadyByReopening: 'Reconnect when ready (will reload DevTools)',
  /**
   * @description Text on a button to reconnect Devtools when remote debugging terminated.
   * "Remote debugging" here means that DevTools on a PC is inspecting a website running on an actual mobile device
   * (see https://developer.chrome.com/docs/devtools/remote-debugging/).
   */
  reconnectDevtools: 'Reconnect `DevTools`',
  /**
   * @description Text on a button to dismiss the dialog.
   */
  closeDialog: 'Dismiss',
  /**
   * @description Text in a dialog box to explain `DevTools` can still be used while disconnected.
   */
  closeDialogDetail: 'Dismiss this dialog and continue using `DevTools` while disconnected',
  /**
   * @description Text in a dialog box to prompt for feedback if the disconnection is unexpected.
   */
  sendFeedbackMessage: '[FB-only] Please send feedback if this disconnection is unexpected.',
  /**
   * @description Text in a dialog box to prompt for feedback if the disconnection is unexpected,
   * telling the user what's their session ID for easier debugging
   */
  sendFeedbackLaunchIdMessage: 'Please include the following session ID:',
  /**
   * @description Label of the FB-only 'send feedback' button.
   */
  sendFeedback: 'Send feedback',
} as const;
const str_ = i18n.i18n.registerUIStrings('ui/legacy/RemoteDebuggingTerminatedScreen.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

interface ViewInput {
  reason: string;
  connectionLostDetails?: {reason?: string, code?: string, errorType?: string};
  feedbackLink: string|null|undefined;
  onReconnect: () => void;
  onClose?: () => void;
  onSendFeedback: (feedbackLink: string) => void;
}

type View = (input: ViewInput, output: object, target: HTMLElement) => void;

// [RN] Renders the FB-only feedback section prompting the user to send feedback
// with their session (launch) ID when an unexpected disconnection occurs.
function renderFeedbackSection(input: ViewInput, feedbackLink: string): unknown {
  const launchId = Root.Runtime.Runtime.queryParam('launchId');

  return html`
    <div class="remote-debugging-terminated-feedback-container">
      <div class="remote-debugging-terminated-feedback-label">${i18nString(UIStrings.sendFeedbackMessage)}</div>
      ${launchId ?
        html`
          <div class="remote-debugging-terminated-feedback-label">
            ${i18nString(UIStrings.sendFeedbackLaunchIdMessage)}
          </div>
          <div class="remote-debugging-terminated-feedback-launch-id">
            ${launchId}
          </div>
        ` : ''
      }
      <br/>
      <devtools-button @click=${() => input.onSendFeedback(feedbackLink)} .jslogContext=${'sendFeedback'}
          .variant=${Buttons.Button.Variant.OUTLINED}>${i18nString(UIStrings.sendFeedback)}</devtools-button>
    </div>
  `;
}

export const DEFAULT_VIEW: View = (input, _output, target) => {
  const feedbackLink = input.feedbackLink;
  // clang-format off
  render(html`
    <style>${remoteDebuggingTerminatedScreenStyles}</style>
    <h1 class="remote-debugging-terminated-title">${i18nString(UIStrings.title)}</h1>
    <div class="remote-debugging-terminated-message">
      <div>${i18nString(UIStrings.debuggingConnectionWasClosed)}</div>
      <div class="remote-debugging-terminated-reason">${input.reason}</div>
      ${globalThis.enableDisplayingFullDisconnectedReason ?
        html`
          <div>
            ${i18nString(UIStrings.debuggingConnectionWasClosedDetails)}
          </div>
          <div class="remote-debugging-terminated-reason">
            <textarea disabled rows="5">${JSON.stringify(input.connectionLostDetails, null, 2)}</textarea>
          </div>
        ` : ''}
    </div>
    ${feedbackLink !== null && feedbackLink !== undefined ? renderFeedbackSection(input, feedbackLink) : null}
    <div class="remote-debugging-terminated-options">
      <div class="remote-debugging-terminated-label">
        ${i18nString(UIStrings.reconnectWhenReadyByReopening)}
      </div>
      <devtools-button @click=${input.onReconnect} .jslogContext=${'reconnect'}
          .variant=${Buttons.Button.Variant.PRIMARY}>${i18nString(UIStrings.reconnectDevtools)}</devtools-button>
      <div class="remote-debugging-terminated-label">
        ${i18nString(UIStrings.closeDialogDetail)}
      </div>
      <devtools-button @click=${input.onClose} .jslogContext=${'dismiss'}
          .variant=${Buttons.Button.Variant.OUTLINED}>${i18nString(UIStrings.closeDialog)}</devtools-button>
    </div>`,
    target);
  // clang-format on
};

export class RemoteDebuggingTerminatedScreen extends VBox {
  constructor(
      reason: string,
      connectionLostDetails?: {reason?: string, code?: string, errorType?: string},
      onClose?: () => void,
      view: View = DEFAULT_VIEW,
  ) {
    super({useShadowDom: true});
    const input: ViewInput = {
      reason,
      connectionLostDetails,
      feedbackLink: globalThis.FB_ONLY__reactNativeFeedbackLink,
      onReconnect: () => {
        window.location.reload();
      },
      onClose,
      onSendFeedback: (feedbackLink: string) => {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(
            feedbackLink as Platform.DevToolsPath.UrlString,
        );
      },
    };
    view(input, {}, this.contentElement);
  }

  static show(
      uiMessage: string,
      connectionLostDetails?: {reason?: string, code?: string, errorType?: string},
      ): void {
    const dialog = new Dialog('remote-debnugging-terminated');
    dialog.setSizeBehavior(SizeBehavior.MEASURE_CONTENT);
    dialog.setDimmed(true);
    new RemoteDebuggingTerminatedScreen(uiMessage, connectionLostDetails, () => dialog.hide())
        .show(dialog.contentElement);
    dialog.show();
    Host.rnPerfMetrics.remoteDebuggingTerminated(connectionLostDetails);
  }
}
