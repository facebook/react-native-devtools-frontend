// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {type TSESLint, TSESTree} from '@typescript-eslint/utils';

import {createRule} from './utils/ruleCreator.ts';

export default createRule({
  name: 'no-dynamic-preamble',
  meta: {
    type: 'problem',
    messages: {
      dynamicPreamble: 'The preamble should be a static string and not contain any dynamic parts.',
    },
    docs: {
      description: 'Enforce static preamble for AI agents.',
      category: 'Possible Errors',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function isStaticString(node: TSESTree.Expression|null|undefined): boolean {
      if (!node) {
        return false;
      }
      if (node.type === TSESTree.AST_NODE_TYPES.Literal && typeof node.value === 'string') {
        return true;
      }
      if (node.type === TSESTree.AST_NODE_TYPES.TemplateLiteral && node.expressions.length === 0) {
        return true;
      }
      return false;
    }

    function checkPreambleValue(node: TSESTree.Expression) {
      if (isStaticString(node)) {
        return;
      }

      if (node.type === TSESTree.AST_NODE_TYPES.Identifier) {
        let scope: TSESLint.Scope.Scope|null = context.sourceCode.getScope(node);
        let variable: TSESLint.Scope.Variable|undefined;
        while (scope) {
          variable = scope.variables.find(v => v.name === node.name);
          if (variable) {
            break;
          }
          scope = scope.upper;
        }

        if (variable) {
          const definition = variable.defs[0];
          if (definition && definition.type === 'Variable' && definition.parent.kind === 'const') {
            if (definition.node.init && isStaticString(definition.node.init)) {
              return;
            }
          }
        }
      }

      context.report({
        node,
        messageId: 'dynamicPreamble',
      });
    }

    return {
      'ClassDeclaration, ClassExpression'(node: TSESTree.ClassDeclaration|TSESTree.ClassExpression) {
        const isAiAgent =
            node.superClass?.type === TSESTree.AST_NODE_TYPES.Identifier && node.superClass.name === 'AiAgent';
        if (!isAiAgent) {
          return;
        }

        for (const member of node.body.body) {
          if (member.type === TSESTree.AST_NODE_TYPES.PropertyDefinition &&
              member.key.type === TSESTree.AST_NODE_TYPES.Identifier && member.key.name === 'preamble' &&
              member.value) {
            checkPreambleValue(member.value);
          }
        }
      },
    };
  },
});
