// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '../../../ui/components/buttons/buttons.js';
import '../../../ui/components/icon_button/icon_button.js';
import './SidebarRNPerfIssueItem.js';

import * as i18n from '../../../core/i18n/i18n.js';
import * as Trace from '../../../models/trace/trace.js';
import * as ComponentHelpers from '../../../ui/components/helpers/helpers.js';
import * as Lit from '../../../ui/lit/lit.js';

import type {AggregatedPerfIssue, PerfIssueEvent, PerfIssueSeverity, RNPerfIssueDetail} from './RNPerfIssueTypes.js';
import styles from './sidebarRNPerfIssuesTab.css.js';

const {html} = Lit;

const DEFAULT_ISSUE_SEVERITY = 'info';
const SORT_ORDER: Record<PerfIssueSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

const UIStrings = {
  /** @description Title for empty state */
  emptyStateTitle: 'Performance Signals (Experimental)',
  /** @description Description for empty state */
  emptyStateDetail: 'No issues found',
} as const;

const str_ = i18n.i18n.registerUIStrings('panels/timeline/components/SidebarRNPerfIssuesTab.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class SidebarRNPerfIssuesTab extends HTMLElement {
  readonly #boundRender = this.#render.bind(this);
  readonly #shadow = this.attachShadow({mode: 'open'});

  #parsedTrace: Trace.Handlers.Types.ParsedTrace|null = null;
  #perfIssues: AggregatedPerfIssue[] = [];

  #selectTimelineEvent?: (event: Trace.Types.Events.Event) => void;

  set parsedTrace(data: Trace.Handlers.Types.ParsedTrace|null) {
    if (data === this.#parsedTrace) {
      return;
    }
    this.#parsedTrace = data;
    this.#updatePerfIssues();
    void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
  }

  setSelectTimelineEventCallback(callback: (event: Trace.Types.Events.Event) => void): void {
    this.#selectTimelineEvent = callback;
  }

  hasIssues(): boolean {
    return this.#perfIssues.length > 0;
  }

  #updatePerfIssues(): void {
    this.#perfIssues = [];
    if (!this.#parsedTrace) {
      return;
    }

    const traceStartMs = Trace.Helpers.Timing.microToMilli(this.#parsedTrace.Meta.traceBounds.min);
    const eventsByIssueName = new Map<string, {metadata: RNPerfIssueDetail, events: PerfIssueEvent[]}>();

    // Find extension track entries (rendered in the flame chart) in the parsed
    // trace that contain `detail.devtools.performanceIssue`
    for (const extensionTrack of this.#parsedTrace.ExtensionTraceData.extensionTrackData) {
      for (const entries of Object.values(extensionTrack.entriesByTrack)) {
        for (const extensionEntry of entries) {
          if (!Trace.Types.Extensions.isSyntheticExtensionEntry(extensionEntry)) {
            continue;
          }

          const rawSourceEvent = extensionEntry.rawSourceEvent;
          try {
            const sourceEventWithDetail = Trace.Types.Events.isSyntheticUserTiming(rawSourceEvent) ?
                rawSourceEvent.args.data.beginEvent :
                rawSourceEvent;
            const detailString = 'detail' in sourceEventWithDetail.args ? sourceEventWithDetail.args.detail : undefined;
            if (!detailString) {
              continue;
            }
            const detail = JSON.parse(detailString);
            const perfIssueDetail = detail?.devtools?.performanceIssue as RNPerfIssueDetail;
            if (!perfIssueDetail) {
              continue;
            }

            const issueData = eventsByIssueName.get(perfIssueDetail.name) ?? {
              metadata: perfIssueDetail,
              events: [],
            };
            issueData.events.push({
              event: extensionEntry, // Use the extension entry, not the user timing pair
              timestampMs: Trace.Helpers.Timing.microToMilli(extensionEntry.ts) - traceStartMs,
            });
            eventsByIssueName.set(perfIssueDetail.name, issueData);
          } catch {
            continue;
          }
        }
      }
    }

    for (const [name, {events, metadata}] of eventsByIssueName) {
      this.#perfIssues.push({
        name,
        description: metadata.description,
        severity: metadata.severity ?? DEFAULT_ISSUE_SEVERITY,
        learnMoreUrl: metadata.learnMoreUrl,
        events,
        count: events.length,
      });
    }

    this.#perfIssues.sort((a, b) => {
      const severityDiff = SORT_ORDER[b.severity] - SORT_ORDER[a.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      return a.name.localeCompare(b.name);
    });
  }

  #renderEmptyState(): Lit.TemplateResult {
    return html`
      <div class="empty-state-container">
        <div class="empty-state-title">${i18nString(UIStrings.emptyStateTitle)}</div>
        <div class="empty-state-detail">${i18nString(UIStrings.emptyStateDetail)}</div>
      </div>
    `;
  }

  #render(): void {
    if (!this.#parsedTrace) {
      Lit.render(Lit.nothing, this.#shadow, {host: this});
      return;
    }

    const contents = html`
      <style>${styles.cssText}</style>
      <div class="perf-issues-wrapper">
        ${this.#perfIssues.length ?
          this.#perfIssues.map(issue => html`
            <devtools-performance-sidebar-perf-issue-item .data=${{
              issue,
              onEventSelected: this.#selectTimelineEvent,
            }}></devtools-performance-sidebar-perf-issue-item>
          `) :
          this.#renderEmptyState()
        }
      </div>
    `;
    Lit.render(contents, this.#shadow, {host: this});
  }
}

customElements.define('devtools-performance-sidebar-perf-issues', SidebarRNPerfIssuesTab);

declare global {
  interface HTMLElementTagNameMap {
    'devtools-performance-sidebar-perf-issues': SidebarRNPerfIssuesTab;
  }
}
