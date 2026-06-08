// Copyright 2020 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import fs from 'node:fs';
import path from 'node:path';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

import {writeIfChanged} from './ninja/write-if-changed.js';

const {template, outDirectory, entrypoints} = yargs(
                                                  hideBin(process.argv),
                                                  )
                                                  .parseSync();

if (!template) {
  throw new Error(
      'Must specify --template location with the location of the HTML entrypoint template.',
  );
}

if (!outDirectory) {
  throw new Error(
      'Must specify --out-directory location where the outputs must live.',
  );
}

if (!entrypoints) {
  throw new Error('Must specify at least one entrypoint name.');
}

if (!Array.isArray(entrypoints)) {
  throw new Error('Must specify multiple entrypoints as array');
}

const templateContent = fs.readFileSync(template, 'utf-8');

const REACT_NATIVE_ENTRYPOINT_TO_TITLE = new Map([
  ['rn_fusebox', 'React Native DevTools']
]);

for (const entrypoint of entrypoints) {
  let rewrittenTemplateContent = templateContent.replace(new RegExp('%ENTRYPOINT_NAME%', 'g'), entrypoint);
  if (REACT_NATIVE_ENTRYPOINT_TO_TITLE.has(entrypoint)) {
    const rewrittenTitle = REACT_NATIVE_ENTRYPOINT_TO_TITLE.get(entrypoint);
    rewrittenTemplateContent = rewrittenTemplateContent.replace(
      new RegExp('(?<=<title>)(.*)(?=</title>)', 'g'),
      rewrittenTitle
    );
  }

  // React DevTools uses Web Workers API for parsing hook names and uploading large tracing files
  // https://github.com/facebook/react/blob/fd35655fae9f88284e01754cadb0707abaca795b/packages/react-devtools-shared/src/hooks/parseHookNames/loadSourceAndMetadata.js
  // Here we update the CSP header to allow workers from self
  if (entrypoint === 'rn_fusebox') {
    const cspHeaderRegex = /(?<=<meta http-equiv="Content-Security-Policy" content=")(.*)(?=">)/;
    const cspHeaderMatch = rewrittenTemplateContent.match(cspHeaderRegex);
    if (cspHeaderMatch === null) {
      throw new Error('Couldn\'t find CSP header for rn_fusebox entrypoint: this can break React DevTools panel');
    }

    rewrittenTemplateContent = rewrittenTemplateContent.replace(
      cspHeaderRegex,
      '$1; worker-src \'self\' blob:'
    );
  }

  writeIfChanged(path.join(outDirectory, `${entrypoint}.html`), rewrittenTemplateContent);
}
