// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {ParsedURL} from '../common/ParsedURL.js';

import type {DeveloperResourceLoaded} from './UserMetrics.js';

export type RNReliabilityEventListener = (event: DecoratedReactNativeChromeDevToolsEvent) => void;

let instance: RNPerfMetrics|null = null;

export function getInstance(): RNPerfMetrics {
  if (instance === null) {
    instance = new RNPerfMetrics();
  }
  return instance;
}

type PanelLocation = 'main'|'drawer';
type UnsubscribeFn = () => void;
class RNPerfMetrics {
  readonly #consoleErrorMethod = 'error';
  #listeners = new Set<RNReliabilityEventListener>();
  #launchId: string|null = null;
  #appId: string|null = null;
  #entryPoint: EntryPoint = 'rn_inspector';
  #telemetryInfo: Object = {};
  // map of panel location to panel name
  #currentPanels = new Map<PanelLocation, string>();

  isEnabled(): boolean {
    return globalThis.enableReactNativePerfMetrics === true;
  }

  addEventListener(listener: RNReliabilityEventListener): UnsubscribeFn {
    this.#listeners.add(listener);

    const unsubscribe = (): void => {
      this.#listeners.delete(listener);
    };

    return unsubscribe;
  }

  removeAllEventListeners(): void {
    this.#listeners.clear();
  }

  sendEvent(event: ReactNativeChromeDevToolsEvent): void {
    if (globalThis.enableReactNativePerfMetrics !== true) {
      return;
    }

    const decoratedEvent = this.#decorateEvent(event);
    const errors = [];
    for (const listener of this.#listeners) {
      try {
        listener(decoratedEvent);
      } catch (e) {
        errors.push(e);
      }
    }

    if (errors.length > 0) {
      const error = new AggregateError(errors);
      console.error('Error occurred when calling event listeners', error);
    }
  }

  registerPerfMetricsGlobalPostMessageHandler(): void {
    if (globalThis.enableReactNativePerfMetrics !== true ||
        globalThis.enableReactNativePerfMetricsGlobalPostMessage !== true) {
      return;
    }

    this.addEventListener(event => {
      window.postMessage({event, tag: 'react-native-chrome-devtools-perf-metrics'}, window.location.origin);
    });
  }

  registerGlobalErrorReporting(): void {
    window.addEventListener('error', event => {
      const [message, error] = maybeWrapError(`[RNPerfMetrics] uncaught error: ${event.message}`, event.error);
      this.sendEvent({
        eventName: 'Browser.Error',
        params: {
          type: 'error',
          message,
          error,
        },
      });
    }, {passive: true});

    window.addEventListener('unhandledrejection', event => {
      const [message, error] = maybeWrapError('[RNPerfMetrics] unhandled promise rejection', event.reason);
      this.sendEvent({
        eventName: 'Browser.Error',
        params: {
          type: 'rejectedPromise',
          message,
          error,
        },
      });
    }, {passive: true});

    // Indirection for `console` ensures minifier won't strip this out.
    const cons = globalThis.console;
    const originalConsoleError = cons[this.#consoleErrorMethod];
    cons[this.#consoleErrorMethod] = (...args: unknown[]) => {
      try {
        const maybeError = args[0];
        const [message, error] = maybeWrapError('[RNPerfMetrics] console.error', maybeError);
        this.sendEvent({eventName: 'Browser.Error', params: {message, error, type: 'consoleError'}});
      } catch (e) {
        const [message, error] = maybeWrapError('[RNPerfMetrics] Error handling console.error', e);
        this.sendEvent({eventName: 'Browser.Error', params: {message, error, type: 'consoleError'}});
      } finally {
        originalConsoleError.apply(cons, args);
      }
    };
  }

  setLaunchId(launchId: string|null): void {
    this.#launchId = launchId;
  }

  setAppId(appId: string|null): void {
    this.#appId = appId;
  }

  setTelemetryInfo(telemetryInfo: Object): void {
    this.#telemetryInfo = telemetryInfo;
  }

  entryPointLoadingStarted(entryPoint: EntryPoint): void {
    this.#entryPoint = entryPoint;

    this.sendEvent({
      eventName: 'Entrypoint.LoadingStarted',
      entryPoint,
    });
  }

  entryPointLoadingFinished(entryPoint: EntryPoint): void {
    this.sendEvent({
      eventName: 'Entrypoint.LoadingFinished',
      entryPoint,
    });
  }

  browserVisibilityChanged(visibilityState: BrowserVisibilityChangeEvent['params']['visibilityState']): void {
    this.sendEvent({
      eventName: 'Browser.VisibilityChange',
      params: {
        visibilityState,
      },
    });
  }

  remoteDebuggingTerminated(params: {reason?: string, code?: string, errorType?: string} = {}): void {
    this.sendEvent({eventName: 'Connection.DebuggingTerminated', params});
  }

  developerResourceLoadingStarted(parsedURL: ParsedURL, loadingMethod: DeveloperResourceLoaded): void {
    const url = maybeTruncateDeveloperResourceUrl(parsedURL);
    this.sendEvent({eventName: 'DeveloperResource.LoadingStarted', params: {url, loadingMethod}});
  }

  developerResourceLoadingFinished(parsedURL: ParsedURL, loadingMethod: DeveloperResourceLoaded, result: {
    success: boolean,
    errorDescription?: {
      message?: string|null|undefined,
    },
  }): void {
    const url = maybeTruncateDeveloperResourceUrl(parsedURL);
    this.sendEvent({
      eventName: 'DeveloperResource.LoadingFinished',
      params: {
        url,
        loadingMethod,
        success: result.success,
        errorMessage: result.errorDescription?.message,
      },
    });
  }

  fuseboxSetClientMetadataStarted(): void {
    this.sendEvent({eventName: 'FuseboxSetClientMetadataStarted'});
  }

  fuseboxSetClientMetadataFinished(success: boolean, maybeError?: unknown): void {
    if (success) {
      this.sendEvent({eventName: 'FuseboxSetClientMetadataFinished', params: {success: true}});
    } else {
      const [errorMessage, error] = maybeWrapError('[RNPerfMetrics] Fusebox setClientMetadata failed', maybeError);
      this.sendEvent({
        eventName: 'FuseboxSetClientMetadataFinished',
        params: {
          success: false,
          error,
          errorMessage,
        },
      });
    }
  }

  heapSnapshotStarted(): void {
    this.sendEvent({
      eventName: 'MemoryPanelActionStarted',
      params: {
        action: 'snapshot',
      },
    });
  }

  heapSnapshotFinished(success: boolean): void {
    this.sendEvent({
      eventName: 'MemoryPanelActionFinished',
      params: {
        action: 'snapshot',
        success,
      },
    });
  }

  heapProfilingStarted(): void {
    this.sendEvent({
      eventName: 'MemoryPanelActionStarted',
      params: {
        action: 'profiling',
      },
    });
  }

  heapProfilingFinished(success: boolean): void {
    this.sendEvent({
      eventName: 'MemoryPanelActionFinished',
      params: {
        action: 'profiling',
        success,
      },
    });
  }

  heapSamplingStarted(): void {
    this.sendEvent({
      eventName: 'MemoryPanelActionStarted',
      params: {
        action: 'sampling',
      },
    });
  }

  heapSamplingFinished(success: boolean): void {
    this.sendEvent({
      eventName: 'MemoryPanelActionFinished',
      params: {
        action: 'sampling',
        success,
      },
    });
  }

  stackTraceSymbolicationSucceeded(specialHermesFrameTypes: string[]): void {
    this.sendEvent({
      eventName: 'StackTraceSymbolicationSucceeded',
      params: {
        specialHermesFrameTypes,
      },
    });
  }

  stackTraceSymbolicationFailed(stackTrace: string, line: string, reason: string): void {
    this.sendEvent({
      eventName: 'StackTraceSymbolicationFailed',
      params: {
        stackTrace,
        line,
        reason,
      },
    });
  }

  stackTraceFrameUrlResolutionSucceeded(): void {
    this.sendEvent({
      eventName: 'StackTraceFrameUrlResolutionSucceeded',
    });
  }

  stackTraceFrameUrlResolutionFailed(uniqueUrls: string[]): void {
    this.sendEvent({
      eventName: 'StackTraceFrameUrlResolutionFailed',
      params: {
        uniqueUrls,
      },
    });
  }

  panelShown(_panelName: string, _isLaunching?: boolean): void {
    // no-op
    // We only care about the "main" and "drawer" panels for now via panelShownInLocation(…)
    // (This function is called for other "sub"-panels)
  }

  panelShownInLocation(panelName: string, location: PanelLocation): void {
    // The current panel name will be sent along via #decorateEvent(…)
    this.sendEvent({eventName: 'PanelShown', params: {location, newPanelName: panelName}});
    // So we should only update the current panel name to the new one after sending the event
    this.#currentPanels.set(location, panelName);
  }

  #decorateEvent(event: ReactNativeChromeDevToolsEvent): Readonly<DecoratedReactNativeChromeDevToolsEvent> {
    const commonFields: CommonEventFields = {
      timestamp: getPerfTimestamp(),
      launchId: this.#launchId,
      appId: this.#appId,
      entryPoint: this.#entryPoint,
      telemetryInfo: this.#telemetryInfo,
      currentPanels: this.#currentPanels,
    };

    return {
      ...event,
      ...commonFields,
    };
  }
}

function getPerfTimestamp(): DOMHighResTimeStamp {
  return performance.timeOrigin + performance.now();
}

function maybeTruncateDeveloperResourceUrl(parsedURL: ParsedURL): string {
  const {url} = parsedURL;
  return parsedURL.scheme === 'http' || parsedURL.scheme === 'https' ?
      url :
      `${url.slice(0, 100)} …(omitted ${url.length - 100} characters)`;
}

function maybeWrapError(baseMessage: string, error: unknown): [string, Error] {
  if (error instanceof Error) {
    const message = `${baseMessage}: ${error.message}`;
    return [message, error];
  }

  const message = `${baseMessage}: ${String(error)}`;
  return [message, new Error(message, {cause: error})];
}

type EntryPoint = 'rn_fusebox'|'rn_inspector';

type CommonEventFields = Readonly<{
  timestamp: DOMHighResTimeStamp,
  launchId: string | void | null,
  appId: string | void | null,
  entryPoint: EntryPoint,
  telemetryInfo: Object,
  currentPanels: Map<PanelLocation, string>,
}>;

export type EntrypointLoadingStartedEvent = Readonly<{
  eventName: 'Entrypoint.LoadingStarted',
  entryPoint: EntryPoint,
}>;

export type EntrypointLoadingFinishedEvent = Readonly<{
  eventName: 'Entrypoint.LoadingFinished',
  entryPoint: EntryPoint,
}>;

export type DebuggerReadyEvent = Readonly<{
  eventName: 'Debugger.IsReadyToPause',
}>;

export type BrowserVisibilityChangeEvent = Readonly<{
  eventName: 'Browser.VisibilityChange',
  params: Readonly<{
    visibilityState: 'hidden' | 'visible',
  }>,
}>;

export type BrowserErrorEvent = Readonly<{
  eventName: 'Browser.Error',
  params: Readonly<{
    message: string,
    error: Error,
    type: 'error' | 'rejectedPromise' | 'consoleError',
  }>,
}>;

export type RemoteDebuggingTerminatedEvent = Readonly<{
  eventName: 'Connection.DebuggingTerminated',
  params: Readonly<{
    reason?: string,
    code?: string,
    errorType?: string,
  }>,
}>;

export type DeveloperResourceLoadingStartedEvent = Readonly<{
  eventName: 'DeveloperResource.LoadingStarted',
  params: Readonly<{
    url: string,
    loadingMethod: DeveloperResourceLoaded,
  }>,
}>;

export type DeveloperResourceLoadingFinishedEvent = Readonly<{
  eventName: 'DeveloperResource.LoadingFinished',
  params: Readonly<{
    url: string,
    loadingMethod: DeveloperResourceLoaded,
    success: boolean,
    errorMessage: string | null | undefined,
  }>,
}>;

export type FuseboxSetClientMetadataStartedEvent = Readonly<{
  eventName: 'FuseboxSetClientMetadataStarted',
}>;

export type FuseboxSetClientMetadataFinishedEvent = Readonly<{
  eventName: 'FuseboxSetClientMetadataFinished',
  params: Readonly<{
    success: true,
  }|{
    success: false,
    error: Error,
    errorMessage: string,
  }>,
}>;

export type MemoryPanelActionStartedEvent = Readonly<{
  eventName: 'MemoryPanelActionStarted',
  params: Readonly<{
    action: 'profiling' | 'sampling' | 'snapshot',
  }>,
}>;

export type MemoryPanelActionFinishedEvent = Readonly<{
  eventName: 'MemoryPanelActionFinished',
  params: Readonly<{
    action: 'profiling' | 'sampling' | 'snapshot',
    success: boolean,
  }>,
}>;

export type PanelShownEvent = Readonly<{
  eventName: 'PanelShown',
  params: Readonly<{
    location: PanelLocation,
    newPanelName: string,
  }>,
}>;

export type PanelClosedEvent = Readonly<{
  eventName: 'PanelClosed',
  params: Readonly<{
    panelName: string,
  }>,
}>;

export type StackTraceSymbolicationSucceeded = Readonly<{
  eventName: 'StackTraceSymbolicationSucceeded',
  params: Readonly<{
    specialHermesFrameTypes: string[],
  }>,
}>;

export type StackTraceSymbolicationFailed = Readonly<{
  eventName: 'StackTraceSymbolicationFailed',
  params: Readonly<{
    stackTrace: string,
    line: string,
    reason: string,
  }>,
}>;

export type StackTraceFrameUrlResolutionSucceeded = Readonly<{
  eventName: 'StackTraceFrameUrlResolutionSucceeded',
}>;

export type StackTraceFrameUrlResolutionFailed = Readonly<{
  eventName: 'StackTraceFrameUrlResolutionFailed',
  params: Readonly<{
    uniqueUrls: string[],
  }>,
}>;

export type ReactNativeChromeDevToolsEvent =
    EntrypointLoadingStartedEvent|EntrypointLoadingFinishedEvent|DebuggerReadyEvent|BrowserVisibilityChangeEvent|
    BrowserErrorEvent|RemoteDebuggingTerminatedEvent|DeveloperResourceLoadingStartedEvent|
    DeveloperResourceLoadingFinishedEvent|FuseboxSetClientMetadataStartedEvent|FuseboxSetClientMetadataFinishedEvent|
    MemoryPanelActionStartedEvent|MemoryPanelActionFinishedEvent|PanelShownEvent|PanelClosedEvent|
    StackTraceSymbolicationSucceeded|StackTraceSymbolicationFailed|StackTraceFrameUrlResolutionSucceeded|
    StackTraceFrameUrlResolutionFailed;

export type DecoratedReactNativeChromeDevToolsEvent = CommonEventFields&ReactNativeChromeDevToolsEvent;
