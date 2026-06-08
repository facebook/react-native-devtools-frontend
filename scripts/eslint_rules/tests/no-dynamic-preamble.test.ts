// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import rule from '../lib/no-dynamic-preamble.ts';

import {RuleTester} from './utils/RuleTester.ts';

new RuleTester().run('no-dynamic-preamble', rule, {
  valid: [
    {
      code: `
        const preamble = 'static preamble';
        class MyAgent extends AiAgent {
          readonly preamble = preamble;
        }
      `,
    },
    {
      code: `
        const preamble = \`static preamble\`;
        class MyAgent extends AiAgent {
          readonly preamble = preamble;
        }
      `,
    },
    {
      code: `
        class MyAgent extends AiAgent {
          readonly preamble = 'static preamble';
        }
      `,
    },
    {
      code: `
        class MyAgent extends AiAgent {
          readonly preamble = \`static preamble\`;
        }
      `,
    },
    {
      code: `
        class NotAnAgent {
          readonly preamble = \`dynamic \${foo}\`;
        }
      `,
    },
  ],
  invalid: [
    {
      code: `
        class MyAgent extends AiAgent {
          readonly preamble = \`dynamic \${foo}\`;
        }
      `,
      errors: [{messageId: 'dynamicPreamble'}],
    },
    {
      code: `
        const preamble = \`dynamic \${foo}\`;
        class MyAgent extends AiAgent {
          readonly preamble = preamble;
        }
      `,
      errors: [{messageId: 'dynamicPreamble'}],
    },
    {
      code: `
        let preamble = 'static';
        class MyAgent extends AiAgent {
          readonly preamble = preamble;
        }
      `,
      errors: [{messageId: 'dynamicPreamble'}],
    },
    {
      code: `
        const preamble = someFunction();
        class MyAgent extends AiAgent {
          readonly preamble = preamble;
        }
      `,
      errors: [{messageId: 'dynamicPreamble'}],
    },
  ],
});
