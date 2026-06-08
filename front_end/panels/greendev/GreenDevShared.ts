// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export interface SyncMessage {
  type: 'main-window-alive'|'request-session-state'|'user-input'|'restore-floaty'|'full-state'|'activate-panel'|
      'select-tab'|'node-changed'|'new-message'|'update-last-message';
  sessionId?: number;
  text?: string;
  isUser?: boolean;
  nodeDescription?: string|null;
  messages?: Array<{text: string, isUser: boolean}>;
}
