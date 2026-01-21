/**
 * Custom ESLint rules for GNUS-DAO Diamond Proxy patterns
 */

module.exports = {
  rules: {
    "diamond-storage-pattern": {
      meta: {
        type: "problem",
        docs: {
          description: "Enforce proper Diamond storage pattern usage",
          category: "Best Practices",
          recommended: true,
        },
        messages: {
          useDiamondStorage:
            "Use LibDiamond.diamondStorage() instead of direct storage variables in upgradeable contracts",
        },
        schema: [],
      },
      create: function (context) {
        return {
          VariableDeclaration(node) {
            // Check if this is a contract file (simplified check)
            const filename = context.getFilename();
            if (!filename.includes(".sol")) return;

            // Look for storage variables that might conflict with Diamond pattern
            if (node.kind === "contract" && node.declarations) {
              node.declarations.forEach((decl) => {
                if (decl.type === "VariableDeclaration" && decl.isStateVar) {
                  // This is a simplified check - in practice, you'd want more sophisticated analysis
                  context.report({
                    node: decl,
                    messageId: "useDiamondStorage",
                  });
                }
              });
            }
          },
        };
      },
    },

    "diamond-selector-validation": {
      meta: {
        type: "problem",
        docs: {
          description: "Ensure Diamond facet selectors are properly validated",
          category: "Best Practices",
          recommended: true,
        },
        messages: {
          validateSelectors:
            "Validate facet selectors for collisions before diamondCut operations",
        },
        schema: [],
      },
      create: function (context) {
        return {
          CallExpression(node) {
            // Check for diamondCut calls without proper validation
            if (node.callee && node.callee.name === "diamondCut") {
              // This is a simplified check - would need more sophisticated AST analysis
              context.report({
                node,
                messageId: "validateSelectors",
              });
            }
          },
        };
      },
    },

    "secure-external-calls": {
      meta: {
        type: "warning",
        docs: {
          description: "Warn about potentially unsafe external calls",
          category: "Security",
          recommended: true,
        },
        messages: {
          checkReturnValue:
            "Check the return value of external calls for success",
          useSafeWrappers:
            "Consider using safe wrapper functions for external calls",
        },
        schema: [],
      },
      create: function (context) {
        return {
          CallExpression(node) {
            // Check for .call() usage without proper error handling
            if (
              node.callee &&
              node.callee.property &&
              node.callee.property.name === "call"
            ) {
              // Look for parent assignment or check
              const ancestors = context.getAncestors();
              const hasSuccessCheck = ancestors.some((ancestor) => {
                return (
                  ancestor.type === "VariableDeclaration" ||
                  (ancestor.type === "ExpressionStatement" &&
                    ancestor.expression.type === "AssignmentExpression")
                );
              });

              if (!hasSuccessCheck) {
                context.report({
                  node,
                  messageId: "checkReturnValue",
                });
              }
            }
          },
        };
      },
    },
  },
};
