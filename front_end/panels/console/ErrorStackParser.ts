// Copyright 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import type * as Platform from '../../core/platform/platform.js';
import type * as SDK from '../../core/sdk/sdk.js';
import type * as Protocol from '../../generated/protocol.js';

export interface ParsedErrorFrame {
  line: string;
  isCallFrame?: boolean;
  link?: {
    url: Platform.DevToolsPath.UrlString,
    prefix: string,
    suffix: string,
    lineNumber?: number,
    columnNumber?: number, enclosedInBraces: boolean,
    scriptId?: Protocol.Runtime.ScriptId,
  };
}

export type SpecialHermesStackTraceFrameTypes = 'native' | 'address at' | 'empty url';

function getSpecialHermesStackTraceFrameType({
    url,
}: {
  url: Platform.DevToolsPath.UrlString,
}): SpecialHermesStackTraceFrameTypes | null {
  // functions implemented in c++.
  // TODO: these might be enhanced to include the C++ loc for the frame
  // so that a debugger could stitch together a hybrid cross-language call stack
  if (url === 'native') {
    return 'native';
  }

  // frames with empty url
  // TODO: these seem to be happening due to a bug that needs to be investigated
  // and produce an actual script URL instead
  if (url === '') {
    return 'empty url';
  }

  // frames pointing to a bytecode locations
  // TODO: these could be symbolicated and link to source files with the help of
  // a bytecode source maps once they are available.
  if (url.startsWith?.('address at ')) {
    return 'address at';
  }

  return null;
}

/**
 * Takes a V8 Error#stack string and extracts source position information.
 *
 * The result includes the url, line and column number, as well as where
 * the url is found in the raw line.
 *
 * @returns Null if the provided string has an unexpected format. A
 *          populated `ParsedErrorFrame[]` otherwise.
 */
export function parseSourcePositionsFromErrorStack(
    runtimeModel: SDK.RuntimeModel.RuntimeModel, stack: string): ParsedErrorFrame[]|null {
  if (!/^[\w.]*Error\b/.test(stack)) {
    return null;
  }
  const debuggerModel = runtimeModel.debuggerModel();
  const baseURL = runtimeModel.target().inspectedURL();

  const lines = stack.split('\n');
  const linkInfos = [];
  const specialHermesFramesParsed = new Set<SpecialHermesStackTraceFrameTypes>();

  for (const line of lines) {
    const match = /^\s*at\s(async\s)?/.exec(line);
    if (!match) {
      if (linkInfos.length && linkInfos[linkInfos.length - 1].isCallFrame) {
        Host.rnPerfMetrics.stackTraceSymbolicationFailed(stack, line, '"at (url)" not found');
        return null;
      }
      linkInfos.push({line});
      continue;
    }

    const isCallFrame = true;
    let left = match[0].length;
    let right = line.length;
    let enclosedInBraces = false;
    while (line[right - 1] === ')') {
      right--;
      enclosedInBraces = true;
      do {
        left = line.indexOf(' (', left);
        if (left < 0) {
          Host.rnPerfMetrics.stackTraceSymbolicationFailed(stack, line, 'left "(" not found');
          return null;
        }
        left += 2;
        if (!line.substring(left).startsWith('eval at ')) {
          break;
        }
        left += 8;
        right = line.lastIndexOf(', ', right) - 1;
        if (right < 0) {
          Host.rnPerfMetrics.stackTraceSymbolicationFailed(stack, line, 'right "(" not found');
          return null;
        }
      } while (true);
    }

    const linkCandidate = line.substring(left, right);
    const splitResult = Common.ParsedURL.ParsedURL.splitLineAndColumn(linkCandidate);
    const specialHermesFrameType = getSpecialHermesStackTraceFrameType(splitResult);
    if (splitResult.url === '<anonymous>' || specialHermesFrameType !== null) {
      if (linkInfos.length && linkInfos[linkInfos.length - 1].isCallFrame && !linkInfos[linkInfos.length - 1].link) {
        // Combine builtin frames.
        linkInfos[linkInfos.length - 1].line += `\n${line}`;
      } else {
        linkInfos.push({line, isCallFrame});
      }
      if (specialHermesFrameType !== null) {
        specialHermesFramesParsed.add(specialHermesFrameType);
      }
      continue;
    }
    let url = parseOrScriptMatch(debuggerModel, splitResult.url);
    if (!url && Common.ParsedURL.ParsedURL.isRelativeURL(splitResult.url)) {
      url = parseOrScriptMatch(debuggerModel, Common.ParsedURL.ParsedURL.completeURL(baseURL, splitResult.url));
    }
    if (!url) {
      Host.rnPerfMetrics.stackTraceSymbolicationFailed(stack, line, 'url parsing failed');
      return null;
    }

    linkInfos.push({
      line,
      isCallFrame,
      link: {
        url,
        prefix: line.substring(0, left),
        suffix: line.substring(right),
        enclosedInBraces,
        lineNumber: splitResult.lineNumber,
        columnNumber: splitResult.columnNumber,
      },
    });
  }

  if (linkInfos?.length) {
    Host.rnPerfMetrics.stackTraceSymbolicationSucceeded(Array.from(specialHermesFramesParsed));
  }

  return linkInfos;
}

function parseOrScriptMatch(debuggerModel: SDK.DebuggerModel.DebuggerModel, url: Platform.DevToolsPath.UrlString|null):
    Platform.DevToolsPath.UrlString|null {
  if (!url) {
    return null;
  }
  if (Common.ParsedURL.ParsedURL.isValidUrlString(url)) {
    return url;
  }
  if (debuggerModel.scriptsForSourceURL(url).length) {
    return url;
  }
  // nodejs stack traces contain (absolute) file paths, but v8 reports them as file: urls.
  const fileUrl = new URL(url, 'file://');
  if (debuggerModel.scriptsForSourceURL(fileUrl.href).length) {
    return fileUrl.href as Platform.DevToolsPath.UrlString;
  }
  return null;
}

/**
 * Error#stack output only contains script URLs. In some cases we are able to
 * retrieve additional exception details from V8 that we can use to augment
 * the parsed Error#stack with script IDs.
 * This function sets the `scriptId` field in `ParsedErrorFrame` when it finds
 * the corresponding info in `Protocol.Runtime.StackTrace`.
 */
export function augmentErrorStackWithScriptIds(
    parsedFrames: ParsedErrorFrame[], protocolStackTrace: Protocol.Runtime.StackTrace): void {
  // Note that the number of frames between the two stack traces can differ. The
  // parsed Error#stack can contain Builtin frames which are not present in the protocol
  // stack. This means its easier to always search the whole protocol stack for a matching
  // frame rather then trying to detect the Builtin frames and skipping them.
  for (const parsedFrame of parsedFrames) {
    const protocolFrame = protocolStackTrace.callFrames.find(frame => framesMatch(parsedFrame, frame));
    if (protocolFrame && parsedFrame.link) {
      parsedFrame.link.scriptId = protocolFrame.scriptId;
    }
  }
}

/** Returns true iff both stack frames have the same url and line/column numbers. The function name is ignored */
function framesMatch(parsedFrame: ParsedErrorFrame, protocolFrame: Protocol.Runtime.CallFrame): boolean {
  if (!parsedFrame.link) {
    return false;
  }

  const {url, lineNumber, columnNumber} = parsedFrame.link;
  return url === protocolFrame.url && lineNumber === protocolFrame.lineNumber &&
      columnNumber === protocolFrame.columnNumber;
}
