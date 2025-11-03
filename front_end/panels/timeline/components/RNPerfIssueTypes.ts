// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as Trace from '../../../models/trace/trace.js';

export type PerfIssueSeverity = 'info' | 'warning' | 'error';

export interface RNPerfIssueDetail {
  name: string;
  description?: string;
  severity?: PerfIssueSeverity;
  learnMoreUrl?: string;
}

export interface PerfIssueEvent {
  event: Trace.Types.Events.Event;
  timestampMs: number;
}

export interface AggregatedPerfIssue {
  name: string;
  description?: string;
  severity: PerfIssueSeverity;
  learnMoreUrl?: string;
  events: PerfIssueEvent[];
  count: number;
}
