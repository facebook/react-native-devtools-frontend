// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as RNPerfMetricsImpl from './Impl.js';

export function registerGlobalPerfMetricsListener(): void {
  if (globalThis.enableReactNativePerfMetrics !== true) {
    return;
  }

  RNPerfMetricsImpl.getInstance().addEventListener(event => {
    window.postMessage({event, tag: 'react-native-chrome-devtools-perf-metrics'}, window.location.origin);
  });
}
