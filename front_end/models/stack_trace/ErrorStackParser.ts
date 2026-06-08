// Copyright 2022 The Chromium Authors
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
    enclosedInBraces: boolean,
    lineNumber?: number,
    columnNumber?: number,
    scriptId?: Protocol.Runtime.ScriptId,
  };
}

export type SpecialHermesStackTraceFrameTypes =
  // e.g "(native)"- Functions implemented on the native side.
  // TODO: Might be enhanced to include the native (C++/Java/etc) loc
  // for the frame so that a debugger could stitch together a
  // hybrid cross-language call stack
  'native' |
  // e.g "(eval:1:2)"- Seem to be reported when there's a
  // ReferenceError or TypeError during the initial bundle code execution.
  // TODO: Understand exactly where these originate from and what further work
  // should be done in regards to them
  'eval' |
  // e.g "(:3:4)"- Frames with empty url
  // TODO: Seems to be happening due to a bug that needs to be investigated
  // and produce an actual script URL instead
  'empty url' |
  // e.g "(address at InternalBytecode.js:5:6)"- Frames pointing to bytecode locations
  // TODO: Could be symbolicated and link to source files with the help of
  // a bytecode source maps once they are available.
  'address at' |
  // e.g " ... skipping 7 frames" - Frames collapsed in the middle of a stack trace
  // for very long stack traces
  'skipping x frames' ;

function getSpecialHermesFrameBasedOnURL(url: string): SpecialHermesStackTraceFrameTypes | null {
  if (url === 'native') {
    return 'native';
  }

  if (url === 'eval') {
    return 'eval';
  }

  if (url === '') {
    return 'empty url';
  }

  if (url.startsWith?.('address at ')) {
    return 'address at';
  }

  return null;
}

function getSpecialHermesFrameBasedOnLine(line: string): SpecialHermesStackTraceFrameTypes | null {
  if (/^\s*... skipping \d+ frames$/.exec(line)) {
    return 'skipping x frames';
  }

  return null;
}

/**
 * Combines the error description (essentially the `Error#stack` property value)
 * with the `issueSummary`.
 *
 * @param description the `description` property of the `Error` remote object.
 * @param issueSummary the optional `issueSummary` of the `exceptionMetaData`.
 * @returns the enriched description.
 * @see https://goo.gle/devtools-reduce-network-noise-design
 */
export function concatErrorDescriptionAndIssueSummary(description: string, issueSummary: string): string {
  // Insert the issue summary right after the error message.
  const pos = description.indexOf('\n');
  const prefix = pos === -1 ? description : description.substring(0, pos);
  const suffix = pos === -1 ? '' : description.substring(pos);
  description = `${prefix}. ${issueSummary}${suffix}`;
  return description;
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
  if (!(/\n\s*at\s/.test(stack) || stack.startsWith('SyntaxError:'))) {
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
        const specialHermesFrameType = getSpecialHermesFrameBasedOnLine(line);
        if (specialHermesFrameType !== null) {
          specialHermesFramesParsed.add(specialHermesFrameType);
          if (!linkInfos[linkInfos.length - 1].link) {
            // Combine builtin frames.
            linkInfos[linkInfos.length - 1].line += `\n${line}`;
          } else {
            linkInfos.push({line, isCallFrame: false});
          }
          continue;
        }

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
    if (line[right - 1] === ')') {
      right--;
      enclosedInBraces = true;
      left = line.lastIndexOf(' (', right);
      if (left < 0) {
        Host.rnPerfMetrics.stackTraceSymbolicationFailed(stack, line, 'left "(" not found');
        return null;
      }
      left += 2;
      // Relevant in the `eval at ...` case.
      const newRight = line.indexOf('), ', left);
      if (newRight > left) {
        right = newRight;
      }
    }

    const linkCandidate = line.substring(left, right);
    const splitResult = Common.ParsedURL.ParsedURL.splitLineAndColumn(linkCandidate);
    const specialHermesFrameType = getSpecialHermesFrameBasedOnURL(splitResult.url);
    if (specialHermesFrameType !== null) {
      specialHermesFramesParsed.add(specialHermesFrameType);
    }

    if (splitResult.url === '<anonymous>' || specialHermesFrameType !== null) {
      if (linkInfos.length && linkInfos[linkInfos.length - 1].isCallFrame && !linkInfos[linkInfos.length - 1].link) {
        // Combine builtin frames.
        linkInfos[linkInfos.length - 1].line += `\n${line}`;
      } else {
        linkInfos.push({line, isCallFrame});
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
