// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '../../../ui/components/buttons/buttons.js';
import '../../../ui/components/icon_button/icon_button.js';

import type * as Platform from '../../../core/platform/platform.js';
import type * as Trace from '../../../models/trace/trace.js';
import * as Buttons from '../../../ui/components/buttons/buttons.js';
import * as UI from '../../../ui/legacy/legacy.js';
import * as Lit from '../../../ui/lit/lit.js';

import type {AggregatedPerfIssue, PerfIssueEvent, PerfIssueSeverity} from './RNPerfIssueTypes.js';
import styles from './sidebarRNPerfIssueItem.css.js';

const {html} = Lit;

interface SidebarRNPerfIssueItemData {
  issue: AggregatedPerfIssue;
  onEventSelected?: (event: Trace.Types.Events.Event) => void;
}

export class SidebarRNPerfIssueItem extends HTMLElement {
  readonly #shadow = this.attachShadow({mode: 'open'});

  #issue: AggregatedPerfIssue|null = null;
  #onEventSelected?: (event: Trace.Types.Events.Event) => void;
  #isOpen = false;

  set data(data: SidebarRNPerfIssueItemData) {
    this.#issue = data.issue;
    this.#onEventSelected = data.onEventSelected;
    this.#render();
  }

  #toggleOpen(event: Event): void {
    event.preventDefault();
    this.#isOpen = !this.#isOpen;
    this.#render();
  }

  #onEventClick(issueEvent: PerfIssueEvent): void {
    if (this.#onEventSelected) {
      this.#onEventSelected(issueEvent.event);
    }
  }

  #onEventKeyDown(event: KeyboardEvent, issueEvent: PerfIssueEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.#onEventClick(issueEvent);
    }
  }

  #renderDropdownIcon(isOpen: boolean): Lit.TemplateResult {
    return html`
      <devtools-button .data=${{
        variant: Buttons.Button.Variant.ICON,
        iconName: 'chevron-right',
        size: Buttons.Button.Size.SMALL,
      } as Buttons.Button.ButtonData} class="dropdown-icon ${isOpen ? 'open' : ''}"></devtools-button>
    `;
  }

  #renderSeverityIcon(severity: PerfIssueSeverity): Lit.TemplateResult {
    const iconData = {
      error: {iconName: 'issue-cross-filled', color: 'var(--icon-error)'},
      warning: {iconName: 'issue-exclamation-filled', color: 'var(--icon-warning)'},
      info: {iconName: 'issue-text-filled', color: 'var(--icon-info)'},
    } as const;
    const {iconName, color} = iconData[severity];
    return html`
      <devtools-icon .data=${{iconName, color, width: '16px', height: '16px'}}></devtools-icon>
    `;
  }

  #render(): void {
    const issue = this.#issue;
    if (!issue) {
      Lit.render(Lit.nothing, this.#shadow, {host: this});
      return;
    }

    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      style: 'decimal',
    });
    const contents = html`
      <style>${styles.cssText}</style>
      <details ?open=${this.#isOpen}>
        <summary @click=${(e: Event) => this.#toggleOpen(e)} class="issue-summary">
          ${this.#renderDropdownIcon(this.#isOpen)}
          ${this.#renderSeverityIcon(issue.severity)}
          <span class="event-count-pill">${issue.count}</span>
          <div class="issue-info">
            <div class="issue-name">${issue.name}</div>
            ${issue.description ? html`<div class="issue-description">${issue.description}</div>` : ''}
            ${issue.learnMoreUrl ? html`
              <div class="issue-learn-more">
                ${UI.XLink.XLink.create(issue.learnMoreUrl as Platform.DevToolsPath.UrlString, 'Learn more')}
              </div>
            ` : ''}
          </div>
        </summary>
        <div class="issue-content">
          <div class="event-list event-list-${issue.severity}">
            ${issue.events.map((issueEvent, i) => {
              return html`
                <div class="event-item"
                     tabindex="0"
                     role="button"
                     aria-label="Navigate to item ${i + 1} in timeline"
                     @click=${() => this.#onEventClick(issueEvent)}
                     @keydown=${(event: KeyboardEvent) => this.#onEventKeyDown(event, issueEvent)}>
                  <div class="event-name">${issueEvent.event.name}</div>
                  <div class="event-timestamp">${formatter.format(issueEvent.timestampMs)} ms</div>
                </div>`;
            })}
          </div>
        </div>
      </details>
    `;
    Lit.render(contents, this.#shadow, {host: this});
  }
}

customElements.define('devtools-performance-sidebar-perf-issue-item', SidebarRNPerfIssueItem);

declare global {
  interface HTMLElementTagNameMap {
    'devtools-performance-sidebar-perf-issue-item': SidebarRNPerfIssueItem;
  }
}
