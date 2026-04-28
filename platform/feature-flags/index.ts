/**
 * Feature Flags — Public API barrel export.
 */

export { featureFlags, type FeatureFlag, type NewFeatureFlag } from "./feature-flag.schema";
export { createFeatureFlagInput, updateFeatureFlagInput } from "./feature-flag.schema";
export { featureFlagService, type FeatureFlagContext } from "./feature-flag.service";
export { requireFeatureFlag, evaluateFeatureFlags } from "./feature-flag.middleware";
export { createFeatureFlagRoutes } from "./feature-flag.routes";
