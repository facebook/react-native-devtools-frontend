// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export const enum TokenType {
  LITERAL = 0,
  URL = 1
}

export interface Token {
  type: TokenType;
  value: string;
}

/**
 * Parsing of
 * https://html.spec.whatwg.org/multipage/images.html#srcset-attribute and href
 * attributes to identify URLs vs other text in the srcset.
 *
 * Note: this is probably not spec compliant.
 */
export function parseSrcset(value: string): Token[] {
  const result: Token[] = [];
  let i = 0;
  while (value.length) {
    if (i++ > 0) {
      result.push({value: ' ', type: TokenType.LITERAL});
    }
    value = value.trim();
    let url = '';
    let descriptor = '';
    const indexOfSpace = value.search(/\s/);
    if (indexOfSpace === -1) {
      url = value;
    } else if (indexOfSpace > 0 && value[indexOfSpace - 1] === ',') {
      url = value.substring(0, indexOfSpace);
    } else {
      url = value.substring(0, indexOfSpace);
      const indexOfComma = value.indexOf(',', indexOfSpace);
      if (indexOfComma !== -1) {
        descriptor = value.substring(indexOfSpace, indexOfComma + 1);
      } else {
        descriptor = value.substring(indexOfSpace);
      }
    }

    if (url) {
      if (url.endsWith(',')) {
        result.push({value: url.substring(0, url.length - 1), type: TokenType.URL});
        result.push({type: TokenType.LITERAL, value: ','});
      } else {
        result.push({value: url, type: TokenType.URL});
      }
    }
    if (descriptor) {
      result.push({type: TokenType.LITERAL, value: descriptor});
    }
    value = value.substring(url.length + descriptor.length);
  }
  return result;
}
