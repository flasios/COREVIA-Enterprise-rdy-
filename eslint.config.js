import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "dist",
      "**/dist/**",
      "node_modules",
      "coverage",
      ".venv",
      ".venv/**",
      ".venv-tts311",
      ".venv-tts311/**",
      "playwright-report",
      "playwright-report/**",
      "test-results",
      "test-results/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
        JSX: "readonly",
        NodeJS: "readonly",
        RequestInit: "readonly",
        RequestInfo: "readonly",
        HeadersInit: "readonly",
        Express: "readonly",
        SpeechRecognition: "readonly",
        SpeechRecognitionEvent: "readonly",
        SpeechRecognitionErrorEvent: "readonly",
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "no-case-declarations": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-escape": "warn",
      "no-control-regex": "off",
      "no-constant-binary-expression": "off",
      "no-prototype-builtins": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "react/no-unknown-property": ["error", { ignore: ["cmdk-input-wrapper"] }],
    },
  },
  // Test files — add test globals
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        jest: "readonly",
      },
    },
  },

  // ── Canonical-root guard ─────────────────────────────────────────────
  // Canonical roots must NEVER import from @server/* or server/ paths.
  {
    files: [
      "brain/**/*.ts",
      "domains/**/*.ts",
      "interfaces/**/*.ts",
      "platform/**/*.ts",
      "apps/**/*.{ts,tsx,js,mjs}",
      "infrastructure/**/*.{ts,tsx,js,mjs}",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "@server/*",
              "@server/**",
              "**/server/*",
              "**/server/**",
            ],
            message: "Import through canonical aliases (@platform/*, @domains/*, @brain/*, @interfaces/*) — server/ is removed.",
          },
        ],
      }],
    },
  },
  {
    files: ["apps/web/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "@/modules/pages/*",
              "@/modules/pages/**",
              "@/modules/*/pages/*",
              "@/modules/*/pages/**",
            ],
            message: "Import through @/pages/* wrappers from the app layer instead of @/modules/**/pages/* implementations.",
          },
        ],
      }],
    },
  },
  {
    files: [
      "apps/web/components/**/*.{ts,tsx}",
      "apps/web/app/contexts/**/*.{ts,tsx}",
      "apps/web/hooks/**/*.{ts,tsx}",
      "apps/web/shared/lib/**/*.{ts,tsx}",
      "apps/web/services/**/*.{ts,tsx}",
      "apps/web/utils/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "@/pages/*",
              "@/pages/**",
            ],
            message: "Non-app layers must not import from @/pages/*; import shared modules/components directly instead.",
          },
        ],
      }],
    },
  },

  // ── Module Boundary Rules (enforced) ─────────────────────────────────

  //
  // IMPORTANT: ESLint flat config — when multiple config objects match the
  // same file and both set the same rule name, the LAST one wins (no merging).
  // Therefore, each file-glob group must have a SINGLE no-restricted-imports
  // entry that consolidates ALL restrictions for that scope.

  // Domain layer must NOT import DB, HTTP, queues, or filesystem
  {
    files: ["domains/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["**/db", "**/db/**", "drizzle-orm", "drizzle-orm/**"],
            message: "Domain layer must not import database modules. Use ports/interfaces instead.",
          },
          {
            group: ["express", "express/**"],
            message: "Domain layer must not import HTTP framework. Domain is framework-agnostic.",
          },
          {
            group: ["bullmq", "bullmq/**", "**/queue/**", "**/queues/**"],
            message: "Domain layer must not import queue infrastructure. Define ports instead.",
          },
          {
            group: ["fs", "fs/**", "path"],
            message: "Domain layer must not import filesystem modules directly.",
          },
          {
            group: ["**/platform/**"],
            message: "Domain layer must not import platform infrastructure. Use shared primitives/contracts only.",
          },
          {
            group: [
              "../../*/application/*", "../../*/domain/*", "../../*/infrastructure/*", "../../*/api/*",
            ],
            message: "Cross-module imports must go through the module's public barrel (index.ts), not internal layers.",
          },
        ],
      }],
    },
  },

  // API layer: no infrastructure bypass, no direct service imports, no cross-module deep imports, no DB
  {
    files: ["domains/*/api/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["../infrastructure", "../infrastructure/**"],
            message: "API layer must not import infrastructure directly. Use the application layer as mediator.",
          },
          {
            group: [
              "../../*/application/*", "../../*/domain/*", "../../*/infrastructure/*", "../../*/api/*",
            ],
            message: "Cross-module imports must go through the module's public barrel (index.ts), not internal layers.",
          },
          {
            group: ["**/db", "**/db/**", "drizzle-orm", "drizzle-orm/**"],
            message: "API layer should not import database modules. Use infrastructure adapters.",
          },
        ],
      }],
    },
  },

  // Application layer: no cross-module deep imports, warn on DB (debt tracking)
  {
    files: ["domains/*/application/**/*.ts"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          {
            group: [
              "../../*/application/*", "../../*/domain/*", "../../*/infrastructure/*", "../../*/api/*",
            ],
            message: "Cross-module imports must go through the module's public barrel (index.ts), not internal layers.",
          },
          {
            group: ["**/db", "**/db/**", "drizzle-orm", "drizzle-orm/**"],
            message: "Application layer should not import database modules. Use infrastructure adapters or ports.",
          },
        ],
      }],
    },
  },

  // Infrastructure layer: no cross-module deep imports
  {
    files: ["domains/*/infrastructure/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "../../*/application/*", "../../*/domain/*", "../../*/infrastructure/*", "../../*/api/*",
            ],
            message: "Cross-module imports must go through the module's public barrel (index.ts), not internal layers.",
          },
        ],
      }],
    },
  },

  // Client modules: no cross-module deep imports
  {
    files: [
      "apps/web/modules/*/api/**/*.ts",
      "apps/web/modules/*/components/**/*.{ts,tsx}",
      "apps/web/modules/*/hooks/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          {
            group: [
              "@/modules/*/api/*",
              "@/modules/*/components/*",
              "@/modules/*/hooks/*",
              "@/modules/*/state/*",
            ],
            message: "Cross-module imports should use the module barrel export (@/modules/<name>), not deep internal paths.",
          },
          {
            group: [
              "@/components/demand/*", "@/components/demand",
              "@/components/business-case/*", "@/components/business-case",
              "@/components/compliance/*", "@/components/compliance",
              "@/components/brain/*", "@/components/brain",
              "@/components/knowledge/*", "@/components/knowledge",
              "@/components/tabs/*", "@/components/tabs",
              "@/components/detailed-requirements/*", "@/components/detailed-requirements",
            ],
            message: "Domain components moved to @/modules/<domain>/components/. Import from there instead.",
          },
          {
            group: [
              "@/features/project-workspace",
              "@/features/project-workspace/*",
              "@/features/project-workspace/**",
              "@/features/demand/hooks/useDemandQueries",
              "@/features/business-case/financial",
              "@/features/business-case/financial/*",
              "@/features/business-case/financial/**",
            ],
            message: "Import through the owning module barrel instead of legacy feature paths.",
          },
        ],
      }],
    },
  },

  // Client pages layer: block old component paths for all page files
  {
    files: [
      "apps/web/modules/*/pages/**/*.{ts,tsx}",
      "apps/web/app/pages/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "@/components/demand/*", "@/components/demand",
              "@/components/business-case/*", "@/components/business-case",
              "@/components/compliance/*", "@/components/compliance",
              "@/components/brain/*", "@/components/brain",
              "@/components/knowledge/*", "@/components/knowledge",
              "@/components/tabs/*", "@/components/tabs",
              "@/components/detailed-requirements/*", "@/components/detailed-requirements",
            ],
            message: "Domain components moved to @/modules/<domain>/components/. Import from there instead.",
          },
          {
            group: [
              "@/features/project-workspace",
              "@/features/project-workspace/*",
              "@/features/project-workspace/**",
              "@/features/demand/hooks/useDemandQueries",
              "@/features/business-case/financial",
              "@/features/business-case/financial/*",
              "@/features/business-case/financial/**",
            ],
            message: "Import through the owning module barrel instead of legacy feature paths.",
          },
        ],
      }],
    },
  },
  {
    files: [
      "apps/web/modules/**/*.ts",
      "apps/web/modules/**/*.tsx",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: [
              "@/features/project-workspace",
              "@/features/project-workspace/*",
              "@/features/project-workspace/**",
              "@/features/demand/hooks/useDemandQueries",
              "@/features/business-case/financial",
              "@/features/business-case/financial/*",
              "@/features/business-case/financial/**",
            ],
            message: "Import through the owning module barrel instead of legacy feature paths.",
          },
        ],
      }],
    },
  },
  {
    files: [
      "apps/web/modules/portfolio/workspace/index.ts",
      "apps/web/modules/demand/business-case/index.ts",
      "apps/web/modules/demand/hooks/useDemandQueries.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
