/**
 * EA Module — Application Layer
 *
 * Use-cases and orchestration logic for Enterprise Architecture.
 */
export type { EaApplication, EaCapability, EaDataDomain, EaTechnologyStandard, EaIntegration } from "../domain";
export { buildEaRegistryDeps } from "./buildDeps";
export type { EaRegistryDeps, EaStorageSlice } from "./buildDeps";
