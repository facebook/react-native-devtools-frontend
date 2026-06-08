// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '../../ui/kit/kit.js';

import * as i18n from '../../core/i18n/i18n.js';
import * as uiI18n from '../../ui/i18n/i18n.js';
import * as UI from '../../ui/legacy/legacy.js';

const UIStrings = {
    /**
     * @description Text for an option to learn more about something
     */
    learnmore: 'Learn more',
    /**
     * @description Text in Timeline Panel of the Performance panel
     */
    wasd: 'WASD',
    /**
     * @description Text in Timeline Panel of the Performance panel
     * @example {record} PH1
     * @example {Ctrl + R} PH2
     */
    clickTheRecordButtonSOrHitSTo: 'Click the record button {PH1} or hit {PH2} to start a new recording.',
    /**
     * @description Text in Timeline Panel of the Performance panel
     * @example {Ctrl + U} PH1
     * @example {Learn more} PH2
     */
    afterRecordingSelectAnAreaOf:
        'After recording, select an area of interest in the overview by dragging. Then, zoom and pan the timeline with the mousewheel or {PH1} keys. {PH2}',
} as const;

const str_ = i18n.i18n.registerUIStrings('panels/timeline/ReactNativeTimelineLandingPage.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class ReactNativeTimelineLandingPage extends UI.Widget.VBox {
    private readonly toggleRecordAction: UI.ActionRegistration.Action;

    constructor(toggleRecordAction: UI.ActionRegistration.Action) {
        super();

        this.toggleRecordAction = toggleRecordAction;

        this.contentElement.classList.add('timeline-landing-page', 'fill');
        this.renderLegacyLandingPage();
    }

    private renderLegacyLandingPage(): void {
        function encloseWithTag(tagName: string, contents: string): HTMLElement {
            const e = document.createElement(tagName);
            e.textContent = contents;
            return e;
        }

        const learnMoreNode = document.createElement('devtools-link');
        learnMoreNode.setAttribute('href', 'https://developer.chrome.com/docs/devtools/evaluate-performance/');
        learnMoreNode.textContent = i18nString(UIStrings.learnmore);

        const recordKey = encloseWithTag(
            'b',
            UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutsForAction('timeline.toggle-recording')[0].title());
        const navigateNode = encloseWithTag('b', i18nString(UIStrings.wasd));

        this.contentElement.classList.add('legacy');
        const centered = this.contentElement.createChild('div');

        // [RN] createInlineButton was removed upstream; inline an equivalent toolbar wrapper.
        // Mirrors the styling the old UI.UIUtils.createInlineButton applied (inlineButton.css)
        // so the button sits inline within the sentence instead of wrapping onto its own line.
        const recordButton = document.createElement('span');
        recordButton.classList.add('inline-button');
        recordButton.style.cssText =
            'display: inline-flex; justify-content: center; vertical-align: sub; position: relative; ' +
            'width: 28px; margin: 2px; border: 1px solid var(--sys-color-neutral-outline); ' +
            'border-radius: 4px; background-color: var(--sys-color-cdt-base-container);';
        const recordButtonToolbar = document.createElement('devtools-toolbar') as UI.Toolbar.Toolbar;
        recordButtonToolbar.appendToolbarItem(UI.Toolbar.Toolbar.createActionButton(this.toggleRecordAction));
        recordButton.appendChild(recordButtonToolbar);

        centered.createChild('p').appendChild(uiI18n.getFormatLocalizedString(
            str_, UIStrings.clickTheRecordButtonSOrHitSTo, {PH1: recordButton, PH2: recordKey}));

        centered.createChild('p').appendChild(uiI18n.getFormatLocalizedString(
            str_, UIStrings.afterRecordingSelectAnAreaOf, {PH1: navigateNode, PH2: learnMoreNode}));
    }
}

