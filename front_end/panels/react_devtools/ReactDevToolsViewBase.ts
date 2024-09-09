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
import { LocalizedString } from '../../core/platform/UIString.js';

const UIStrings = {
  /**
   * @description Label of the FB-only 'send feedback' button.
   */
  sendFeedback: '[FB-only] Send feedback',
};
const str_ = i18n.i18n.registerUIStrings('panels/react_devtools/ReactDevToolsViewBase.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

type ReactDevToolsInitializationFailedEvent = Common.EventTarget.EventTargetEvent<ReactDevToolsModelEventTypes[ReactDevToolsModelEvents.InitializationFailed]>;

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

export class ReactDevToolsViewBase extends UI.View.SimpleView implements
    SDK.TargetManager.SDKModelObserver<ReactDevToolsModel> {
  readonly #tab: string;
  #model: ReactDevToolsModel | null = null;

  constructor(
    tab: 'components' | 'profiler',
    title: LocalizedString,
  ) {
    super(title);

    this.#tab = tab;
    this.#renderLoader();
  }

  override wasShown(): void {
    super.wasShown();
    this.registerCSSFiles([ReactDevTools.CSS]);

    if (this.#model == null) {
      SDK.TargetManager.TargetManager.instance().observeModels(ReactDevToolsModel, this);
    }
  }

  modelAdded(model: ReactDevToolsModel): void {
    this.#model = model;

    model.addEventListener(
      ReactDevToolsModelEvents.InitializationCompleted,
      this.#handleInitializationCompleted,
      this,
    );
    model.addEventListener(
      ReactDevToolsModelEvents.InitializationFailed,
      this.#handleInitializationFailed,
      this,
    );
    model.addEventListener(
      ReactDevToolsModelEvents.Destroyed,
      this.#handleBackendDestroyed,
      this,
    );

    if (model.isInitialized()) {
      // Already initialized from another rendered React DevTools panel - render
      // from initialized state
      this.#renderDevToolsView();
    } else {
      // Once initialized, it will emit InitializationCompleted event
      model.ensureInitialized();
    }
  }

  modelRemoved(model: ReactDevToolsModel): void {
    model.removeEventListener(
      ReactDevToolsModelEvents.InitializationCompleted,
      this.#handleInitializationCompleted,
      this,
    );
    model.removeEventListener(
      ReactDevToolsModelEvents.InitializationFailed,
      this.#handleInitializationFailed,
      this,
    );
    model.removeEventListener(
      ReactDevToolsModelEvents.Destroyed,
      this.#handleBackendDestroyed,
      this,
    );
  }

  #handleInitializationCompleted(): void {
    this.#renderDevToolsView();
  }

  #handleInitializationFailed({data: errorMessage}: ReactDevToolsInitializationFailedEvent): void {
    this.#renderErrorView(errorMessage);
  }

  #handleBackendDestroyed(): void {
    this.#renderLoader();
  }

  #renderDevToolsView(): void {
    this.#clearView();

    const model = this.#model!;
    const usingDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initializeFn = this.#tab === 'components' ? ReactDevTools.initializeComponents : ReactDevTools.initializeProfiler;

    initializeFn(this.contentElement, {
      bridge: model.getBridgeOrThrow(),
      store: model.getStoreOrThrow(),
      theme: usingDarkTheme ? 'dark' : 'light',
      canViewElementSourceFunction: () => true,
      viewElementSourceFunction,
    });
  }

  #renderLoader(): void {
    this.#clearView();

    const loaderContainer = document.createElement('div');
    loaderContainer.setAttribute('style', 'display: flex; flex: 1; justify-content: center; align-items: center');

    const loader = document.createElement('span');
    loader.classList.add('spinner');

    loaderContainer.appendChild(loader);
    this.contentElement.appendChild(loaderContainer);
  }

  #renderErrorView(errorMessage: string): void {
    this.#clearView();

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

  #clearView(): void {
    this.contentElement.removeChildren();
  }
}
