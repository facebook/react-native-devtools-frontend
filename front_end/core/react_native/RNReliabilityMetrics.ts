// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {type ReactNativeChromeDevToolsEvent} from './generated/type_defs/ReactNativeChromeDevToolsEventTypes.js';

type RNReliabilityMetrics = {
  sendEvent: (event: ReactNativeChromeDevToolsEvent) => void,
};

export const RNReliabilityMetrics = ((): RNReliabilityMetrics => {
  function sendEvent(_event: ReactNativeChromeDevToolsEvent): void {
  }

  return {
    sendEvent,
  };
})();
