// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export {};

declare global {
  namespace globalThis {
    // eslint-disable-next-line no-var
    var enableReactNativePerfMetrics: boolean|undefined;
    // eslint-disable-next-line no-var
    var enableReactNativePerfMetricsGlobalPostMessage: boolean|undefined;
    // eslint-disable-next-line no-var
    var enableReactNativeOpenInExternalEditor: boolean|undefined;
    // eslint-disable-next-line no-var
    var enableDisplayingFullDisconnectedReason: boolean|undefined;
    // eslint-disable-next-line no-var
    var reactNativeOpenInEditorButtonImage: string|undefined;
    // eslint-disable-next-line no-var,@typescript-eslint/naming-convention
    var FB_ONLY__reactNativeFeedbackLink: string|undefined;
  }
}
