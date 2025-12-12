// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '../../../ui/components/icon_button/icon_button.js';

import * as Common from '../../../core/common/common.js';
import * as Buttons from '../../../ui/components/buttons/buttons.js';
import * as Lit from '../../../ui/lit/lit.js';
import * as VisualLogging from '../../../ui/visual_logging/visual_logging.js';

import networkEventCoverageInfobarStylesRaw from './NetworkEventCoverageInfobar.css.js';

const networkEventCoverageInfobarStyles = new CSSStyleSheet();
networkEventCoverageInfobarStyles.replaceSync(networkEventCoverageInfobarStylesRaw.cssText);

const {html} = Lit;

const DISMISSED_SETTING_NAME = 'network-event-coverage-infobar-dismissed';

export class NetworkEventCoverageInfobar extends HTMLElement {
  readonly #shadow = this.attachShadow({mode: 'open'});
  #expanded = false;
  readonly #dismissedSetting = Common.Settings.Settings.instance().createSetting<boolean>(DISMISSED_SETTING_NAME, false);

  connectedCallback(): void {
    this.#shadow.adoptedStyleSheets = [networkEventCoverageInfobarStyles];
    this.#render();
  }

  #onToggleExpand(): void {
    this.#expanded = !this.#expanded;
    this.#render();
  }

  #onClose(event: Event): void {
    event.stopPropagation();
    this.#dismissedSetting.set(true);
    this.#render();
  }

  #render(): void {
    if (this.#dismissedSetting.get()) {
      Lit.render(Lit.nothing, this.#shadow, {host: this});
      return;
    }
    // clang-format off
    Lit.render(
      html`
        <div class="infobar" jslog=${VisualLogging.section('network-event-coverage-infobar')}>
          <div
            class="infobar-header"
            role="button"
            tabindex="0"
            aria-expanded=${this.#expanded ? 'true' : 'false'}
            @click=${this.#onToggleExpand}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.#onToggleExpand();
              }
            }}
            jslog=${VisualLogging.expand().track({click: true})}
          >
            <span class="arrow-icon ${this.#expanded ? 'expanded' : ''}"></span>
            <devtools-icon class="info-icon" .data=${{iconName: 'info', color: 'var(--sys-color-on-surface-yellow)', width: '16px', height: '16px'}}></devtools-icon>
            <span class="infobar-message">[FB-only] Network event coverage</span>
            <devtools-button
              class="close-button"
              title="Dismiss"
              .size=${Buttons.Button.Size.MICRO}
              .iconName=${'cross'}
              .variant=${Buttons.Button.Variant.ICON}
              .jslogContext=${'dismiss'}
              @click=${this.#onClose}
            ></devtools-button>
          </div>
          ${this.#expanded ? html`
            <div class="infobar-details">
              Only fetch() and XMLHttpRequest events are available at Meta. Images fetched via &lt;Image&gt; are not currently supported.
            </div>
          ` : Lit.nothing}
        </div>
      `,
      this.#shadow,
      {host: this},
    );
    // clang-format on
  }
}

customElements.define('devtools-network-event-coverage-infobar', NetworkEventCoverageInfobar);

declare global {
  interface HTMLElementTagNameMap {
    'devtools-network-event-coverage-infobar': NetworkEventCoverageInfobar;
  }
}
