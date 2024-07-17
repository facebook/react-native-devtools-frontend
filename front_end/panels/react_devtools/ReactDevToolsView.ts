// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as ReactDevTools from '../../third_party/react-devtools/react-devtools.js';
import * as Common from '../../core/common/common.js';
import * as Workspace from '../../models/workspace/workspace.js';
import * as Bindings from '../../models/bindings/bindings.js';
import * as Logs from '../../models/logs/logs.js';
import * as Host from '../../core/host/host.js';

import {Events as ReactDevToolsModelEvents, ReactDevToolsModel, type EventTypes as ReactDevToolsModelEventTypes} from './ReactDevToolsModel.js';

import type * as ReactDevToolsTypes from '../../third_party/react-devtools/react-devtools.js';
import type * as Platform from '../../core/platform/platform.js';

const UIStrings = {
  /**
   *@description Title of the React DevTools view
   */
  title: 'React DevTools',
  /**
   * @description Label of the FB-only 'send feedback' button.
   */
  sendFeedback: '[FB-only] Send feedback',
};
const str_ = i18n.i18n.registerUIStrings('panels/react_devtools/ReactDevToolsView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

type ReactDevToolsInitializationFailedEvent = Common.EventTarget.EventTargetEvent<ReactDevToolsModelEventTypes[ReactDevToolsModelEvents.InitializationFailed]>;
type ReactDevToolsMessageReceivedEvent = Common.EventTarget.EventTargetEvent<ReactDevToolsModelEventTypes[ReactDevToolsModelEvents.MessageReceived]>;

// Based on ExtensionServer.onOpenResource
async function openResource(
  url: Platform.DevToolsPath.UrlString,
  lineNumber: number, // 0-based
  columnNumber: number, // 0-based
): Promise<void> {
  const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(url);
  if (uiSourceCode) {
    // Unlike the Extension API's version of openResource, we want to normalize the location
    // so that source maps (if any) are applied.
    const normalizedUiLocation = await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().normalizeUILocation(uiSourceCode.uiLocation(lineNumber, columnNumber));
    void Common.Revealer.reveal(normalizedUiLocation);
    return;
  }

  const resource = Bindings.ResourceUtils.resourceForURL(url);
  if (resource) {
    void Common.Revealer.reveal(resource);
    return;
  }

  const request = Logs.NetworkLog.NetworkLog.instance().requestForURL(url);
  if (request) {
    void Common.Revealer.reveal(request);
    return;
  }

  throw new Error('Could not find resource for ' + url);
}

function viewElementSourceFunction(source: ReactDevToolsTypes.Source, symbolicatedSource: ReactDevToolsTypes.Source | null): void {
  const {sourceURL, line, column} = symbolicatedSource
    ? symbolicatedSource
    : source;

  // We use 1-based line and column, Chrome expects them 0-based.
  void openResource(sourceURL as Platform.DevToolsPath.UrlString, line - 1, column - 1);
}

export class ReactDevToolsViewImpl extends UI.View.SimpleView {
  private readonly wall: ReactDevToolsTypes.Wall;
  private backendIsConnected: boolean = false;
  private bridge: ReactDevToolsTypes.Bridge | null = null;
  private store: ReactDevToolsTypes.Store | null = null;
  private readonly listeners: Set<ReactDevToolsTypes.WallListener> = new Set();

  constructor() {
    super(i18nString(UIStrings.title));

    this.wall = {
      listen: (listener): Function => {
        this.listeners.add(listener);

        return (): void => {
          this.listeners.delete(listener);
        };
      },
      send: (event, payload): void => this.sendMessage(event, payload),
    };

    // Notify backend if Chrome DevTools was closed, marking frontend as disconnected
    window.addEventListener('beforeunload', () => this.bridge?.shutdown());

    SDK.TargetManager.TargetManager.instance().addModelListener(
      ReactDevToolsModel,
      ReactDevToolsModelEvents.InitializationCompleted,
      this.onInitializationCompleted,
      this,
    );
    SDK.TargetManager.TargetManager.instance().addModelListener(
      ReactDevToolsModel,
      ReactDevToolsModelEvents.InitializationFailed,
      this.onInitializationFailed,
      this,
    );
    SDK.TargetManager.TargetManager.instance().addModelListener(
      ReactDevToolsModel,
      ReactDevToolsModelEvents.Destroyed,
      this.onDestroyed,
      this,
    );
    SDK.TargetManager.TargetManager.instance().addModelListener(
      ReactDevToolsModel,
      ReactDevToolsModelEvents.MessageReceived,
      this.onMessage,
      this,
    );

    this.renderLoader();
  }

  private onInitializationCompleted(): void {
    // Clear loader or error views
    this.clearView();

    this.backendIsConnected = true;
    this.bridge = ReactDevTools.createBridge(this.wall);
    this.store = ReactDevTools.createStore(this.bridge);

    const usingDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    ReactDevTools.initialize(this.contentElement, {
      bridge: this.bridge,
      store: this.store,
      theme: usingDarkTheme ? 'dark' : 'light',
      canViewElementSourceFunction: () => true,
      viewElementSourceFunction,
    });
  }

  private onInitializationFailed({data: errorMessage}: ReactDevToolsInitializationFailedEvent): void {
    this.backendIsConnected = false;
    this.clearView();
    this.renderErrorView(errorMessage);
  }

  private onDestroyed(): void {
    // Unmount React DevTools view
    this.clearView();

    this.backendIsConnected = false;
    this.bridge?.shutdown();
    this.bridge = null;
    this.store = null;
    this.listeners.clear();

    this.renderLoader();
  }

  private renderLoader(): void {
    const loaderContainer = document.createElement('div');
    loaderContainer.setAttribute('style', 'display: flex; flex: 1; justify-content: center; align-items: center');

    const loader = document.createElement('span');
    loader.classList.add('spinner');

    loaderContainer.appendChild(loader);
    this.contentElement.appendChild(loaderContainer);
  }

  private renderErrorView(errorMessage: string): void {
    const errorContainer = document.createElement('div');
    errorContainer.setAttribute('style', 'display: flex; flex: 1; flex-direction: column; justify-content: center; align-items: center');

    const errorIconView = document.createElement('div');
    errorIconView.setAttribute('style', 'font-size: 3rem');
    errorIconView.innerHTML = '❗';

    const errorMessageParagraph = document.createElement('p');
    errorMessageParagraph.setAttribute('style', 'user-select: all');
    errorMessageParagraph.innerHTML = errorMessage;

    errorContainer.appendChild(errorIconView);
    errorContainer.appendChild(errorMessageParagraph);
    this.contentElement.appendChild(errorContainer);

    if (globalThis.FB_ONLY__reactNativeFeedbackLink) {
      const feedbackLink = globalThis.FB_ONLY__reactNativeFeedbackLink as Platform.DevToolsPath.UrlString;
      const feedbackButton = UI.UIUtils.createTextButton(i18nString(UIStrings.sendFeedback), () => {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(feedbackLink);
      }, {className: 'primary-button', jslogContext: 'sendFeedback'});
      errorContainer.appendChild(feedbackButton);
    }
  }

  private clearView(): void {
    this.contentElement.removeChildren();
  }

  override wasShown(): void {
    super.wasShown();

    // This has to be here, because initialize() can be called when user is on the other panel and view is unmounted
    this.registerCSSFiles([ReactDevTools.CSS]);
  }

  private onMessage({data: message}: ReactDevToolsMessageReceivedEvent): void {
    if (!message) {
      return;
    }

    for (const listener of this.listeners) {
      listener(message);
    }
  }

  private sendMessage(event: string, payload?: ReactDevToolsTypes.MessagePayload): void {
    // If the execution context has been destroyed, do not attempt to send a message
    if (!this.backendIsConnected) {
      return;
    }

    for (const model of SDK.TargetManager.TargetManager.instance().models(ReactDevToolsModel, {scoped: true})) {
      void model.sendMessage({event, payload});
    }
  }
}
