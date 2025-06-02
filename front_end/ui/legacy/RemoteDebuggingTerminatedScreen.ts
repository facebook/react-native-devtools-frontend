// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import type * as Platform from '../../core/platform/platform.js';
import * as Root from '../../core/root/root.js';
import * as Lit from '../../ui/lit/lit.js';

import {Dialog} from './Dialog.js';
import {SizeBehavior} from './GlassPane.js';
import remoteDebuggingTerminatedScreenStyles from './remoteDebuggingTerminatedScreen.css.js';
import {createTextButton} from './UIUtils.js';
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

const {render, html} = Lit;

export class RemoteDebuggingTerminatedScreen extends VBox {
  constructor(
    reason: string,
    connectionLostDetails?: {reason?: string, code?: string, errorType?: string},
    onClose?: () => void
  ) {
    super(true);
    this.registerRequiredCSS(remoteDebuggingTerminatedScreenStyles);

    const handleReconnect = (): void => {
      window.location.reload();
    };
    const feedbackLink = globalThis.FB_ONLY__reactNativeFeedbackLink;

    render(
        html`
        <h1 class="remote-debugging-terminated-title">${i18nString(UIStrings.title)}</h1>
        <div class="remote-debugging-terminated-message">
          <div>${i18nString(UIStrings.debuggingConnectionWasClosed)}</div>
          <div class="remote-debugging-terminated-reason">${reason}</div>
          ${globalThis.enableDisplayingFullDisconnectedReason ?
            html`
              <div>
                ${i18nString(UIStrings.debuggingConnectionWasClosedDetails)}
              </div>
              <div class="remote-debugging-terminated-reason">
                <textarea disabled rows="5">${JSON.stringify(connectionLostDetails, null, 2)}</textarea>
              </div>
            ` : ''}
        </div>
        ${feedbackLink !== null && feedbackLink !== undefined ? this.#createFeedbackSection(feedbackLink) : null}
        <div class="remote-debugging-terminated-options">
          <div class="remote-debugging-terminated-label">
            ${i18nString(UIStrings.reconnectWhenReadyByReopening)}
          </div>
          ${createTextButton(
            i18nString(UIStrings.reconnectDevtools),
            handleReconnect,
            {className: 'primary-button', jslogContext: 'reconnect'},
          )}
          <div class="remote-debugging-terminated-label">
            ${i18nString(UIStrings.closeDialogDetail)}
          </div>
          ${createTextButton(i18nString(UIStrings.closeDialog), onClose, {
          jslogContext: 'dismiss',
        })}
        </div>
      `,
        this.contentElement,
        {host: this},
    );
  }

  static show(
    uiMessage: string,
    connectionLostDetails?: {reason?: string, code?: string, errorType?: string}
  ): void {
    const dialog = new Dialog('remote-debnugging-terminated');
    dialog.setSizeBehavior(SizeBehavior.MEASURE_CONTENT);
    dialog.setDimmed(true);
    new RemoteDebuggingTerminatedScreen(uiMessage, connectionLostDetails, () => dialog.hide()).show(dialog.contentElement);
    dialog.show();
    Host.rnPerfMetrics.remoteDebuggingTerminated(connectionLostDetails);
  }

  #createFeedbackSection(feedbackLink: string): Lit.TemplateResult {
    const handleSendFeedback = (): void => {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(
          feedbackLink as Platform.DevToolsPath.UrlString,
      );
    };

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
        ${
        createTextButton(
            i18nString(UIStrings.sendFeedback),
            handleSendFeedback,
            {jslogContext: 'sendFeedback'},
            )}
      </div>
    `;
  }
}
