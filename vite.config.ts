import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const projectRoot = import.meta.dirname;
const webRoot = path.resolve(projectRoot, "apps", "web");
const packagesRoot = path.resolve(projectRoot, "packages");
const domainsRoot = path.resolve(projectRoot, "domains");

function getFeatureChunkName(normalizedId: string): string | undefined {
  const chunkMappings: Array<[string, string]> = [
    ["/lib/", "shared-app-core"],
    ["/api/", "shared-app-core"],
    ["/contexts/", "shared-app-core"],
    ["/i18n/locales/en.json", "app-i18n-en"],
    ["/i18n/locales/ar.json", "app-i18n-ar"],
    ["/i18n/index.ts", "app-i18n"],
    ["/components/shared/CommandPalette.tsx", "app-shell-command-palette"],
    ["/components/shared/SmartBreadcrumbs.tsx", "app-shell-navigation"],
    ["/components/shared/user/", "app-shell-user"],
    ["/components/LanguageSwitcher.tsx", "app-shell-navigation"],
    ["/components/shared/versioning/", "shared-demand-versioning"],
    ["/components/shared/branching/", "shared-demand-versioning"],
    ["/components/shared/collaboration/", "shared-demand-collaboration"],
    ["/domains/demand/infrastructure/financialModel.ts", "shared-financial-model"],
    ["/packages/financialCalculations.ts", "shared-financial-calculations"],
    ["/packages/constants/archetypes.ts", "shared-archetypes"],
    ["/modules/demand/business-case/financial/components/FinancialModelContainer.tsx", "feature-demand-financial-model"],
    ["/modules/demand/business-case/financial/utils/", "feature-demand-financial-model"],
    ["/modules/demand/business-case/financial/types/", "feature-demand-financial-model"],
    ["/modules/demand/components/tabs/DetailedRequirementsTab.tsx", "feature-demand-requirements"],
    ["/modules/demand/components/tabs/BusinessCaseTab.tsx", "feature-demand-business-case"],
    ["/modules/demand/components/tabs/StrategicFitTab.tsx", "feature-demand-strategic-fit"],
    ["/modules/portfolio/workspace/components/tabs/ExecutionPhaseTab.tsx", "feature-workspace-execution"],
    ["/modules/portfolio/workspace/components/tabs/PlanningPhaseTab.tsx", "feature-workspace-planning"],
    ["/modules/portfolio/workspace/components/tabs/RfpDocumentTab.tsx", "feature-workspace-rfp"],
    ["/modules/portfolio/workspace/components/tabs/MonitoringPhaseTab.tsx", "feature-workspace-monitoring"],
    ["/modules/portfolio/pmo/PMOOfficePage.tsx", "feature-pmo-office"],
    ["/modules/ea/components/EnterpriseArchitectureTab.tsx", "feature-enterprise-architecture"],
    ["/modules/intelligence/pages/brain/Intelligence.tsx", "feature-brain-intelligence"],
    ["/modules/intelligence/pages/brain/", "feature-brain-intelligence"],
  ];

  for (const [pattern, chunkName] of chunkMappings) {
    if (normalizedId.includes(pattern)) {
      return chunkName;
    }
  }

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  const vendorChunkMappings: Array<[string, string]> = [
    ["/@radix-ui/", "vendor-radix"],
    ["/@tanstack/", "vendor-tanstack"],
    ["/react-dom/", "vendor-react"],
    ["/react/", "vendor-react"],
    ["/lucide-react/", "vendor-icons"],
    ["/react-icons/", "vendor-icons"],
    ["/recharts/", "vendor-charts"],
    ["/d3/", "vendor-charts"],
    ["/framer-motion/", "vendor-motion"],
    ["/react-hook-form/", "vendor-forms"],
    ["/@hookform/", "vendor-forms"],
    ["/i18next/", "vendor-i18n"],
    ["/react-i18next/", "vendor-i18n"],
    ["/lodash/", "vendor-utils"],
    ["/date-fns/", "vendor-utils"],
    ["/embla-carousel-react/", "vendor-ui"],
    ["/cmdk/", "vendor-ui"],
    ["/vaul/", "vendor-ui"],
  ];

  for (const [pattern, chunkName] of vendorChunkMappings) {
    if (normalizedId.includes(pattern)) {
      return chunkName;
    }
  }

  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@/contexts": path.resolve(webRoot, "app/contexts"),
      "@/pages": path.resolve(webRoot, "app/pages"),
      "@/lib": path.resolve(webRoot, "shared/lib"),
      "@/api": path.resolve(webRoot, "services/api"),
      "@/features": path.resolve(webRoot, "modules"),
      "@": webRoot,
      "@web": webRoot,
      "@shared": packagesRoot,
      "@packages": packagesRoot,
      "@domains": domainsRoot,
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  root: webRoot,
  cacheDir: path.resolve(projectRoot, "node_modules/.vite"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          return getFeatureChunkName(normalizedId);
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "@hookform/resolvers/zod",
      "class-variance-authority",
      "clsx",
      "cmdk",
      "date-fns",
      "embla-carousel-react",
      "framer-motion",
      "input-otp",
      "lucide-react",
      "react-day-picker",
      "react-dropzone",
      "react-hook-form",
      "react-resizable-panels",
      "recharts",
      "tailwind-merge",
      "vaul",
      "wouter",
      "i18next",
      "react-i18next",
    ],
  },
  server: {
    hmr: {
      overlay: false,
    },
    fs: {
      strict: true,
      allow: [path.resolve(projectRoot)],
      deny: ["**/.*"],
    },
  },
});
