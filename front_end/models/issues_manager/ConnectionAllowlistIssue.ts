// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import type * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';

import {Issue, IssueCategory, IssueKind} from './Issue.js';
import {
  type LazyMarkdownIssueDescription,
  type MarkdownIssueDescription,
  resolveLazyDescription,
} from './MarkdownIssueDescription.js';

const UIStrings = {
  /**
   *@description Title for Connection-Allowlist specification url
   */
  connectionAllowlistHeader: 'Connection-Allowlist specification',
} as const;
const str_ = i18n.i18n.registerUIStrings('models/issues_manager/ConnectionAllowlistIssue.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

export class ConnectionAllowlistIssue extends Issue<Protocol.Audits.ConnectionAllowlistIssueDetails> {
  constructor(
      issueDetails: Protocol.Audits.ConnectionAllowlistIssueDetails, issuesModel: SDK.IssuesModel.IssuesModel|null) {
    super(
        {
          code: `${Protocol.Audits.InspectorIssueCode.ConnectionAllowlistIssue}::${issueDetails.error}`,
          umaCode: `${Protocol.Audits.InspectorIssueCode.ConnectionAllowlistIssue}::${issueDetails.error}`,
        },
        issueDetails, issuesModel);
  }

  override primaryKey(): string {
    return JSON.stringify(this.details());
  }

  override getDescription(): MarkdownIssueDescription|null {
    const description: LazyMarkdownIssueDescription = {
      file: `connectionAllowlist${this.details().error}.md`,
      links: [
        {
          link: 'https://wicg.github.io/private-network-access/#connection-allowlist',
          linkTitle: i18nLazyString(UIStrings.connectionAllowlistHeader),
        },
      ],
    };
    return resolveLazyDescription(description);
  }

  override getCategory(): IssueCategory {
    return IssueCategory.OTHER;
  }

  override getKind(): IssueKind {
    return IssueKind.PAGE_ERROR;
  }

  override requests(): Iterable<Protocol.Audits.AffectedRequest> {
    return this.details().request ? [this.details().request] : [];
  }

  static fromInspectorIssue(
      issuesModel: SDK.IssuesModel.IssuesModel|null,
      inspectorIssue: Protocol.Audits.InspectorIssue): ConnectionAllowlistIssue[] {
    const details = inspectorIssue.details.connectionAllowlistIssueDetails;
    if (!details) {
      console.warn('Connection-Allowlist issue without details received.');
      return [];
    }
    return [new ConnectionAllowlistIssue(details, issuesModel)];
  }
}
