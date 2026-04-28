/**
 * EA Registry Storage Port — CRUD contract for the structured EA baseline.
 */
import type {
  EaApplication,
  InsertEaApplication,
  EaCapability,
  InsertEaCapability,
  EaDataDomain,
  InsertEaDataDomain,
  EaTechnologyStandard,
  InsertEaTechnologyStandard,
  EaIntegration,
  InsertEaIntegration,
} from "@shared/schema";

export interface IEaRegistryStoragePort {
  // Applications
  getEaApplication(id: string): Promise<EaApplication | undefined>;
  getAllEaApplications(): Promise<EaApplication[]>;
  createEaApplication(data: InsertEaApplication): Promise<EaApplication>;
  updateEaApplication(id: string, data: Partial<InsertEaApplication>): Promise<EaApplication | undefined>;
  deleteEaApplication(id: string): Promise<boolean>;

  // Capabilities
  getEaCapability(id: string): Promise<EaCapability | undefined>;
  getAllEaCapabilities(): Promise<EaCapability[]>;
  createEaCapability(data: InsertEaCapability): Promise<EaCapability>;
  updateEaCapability(id: string, data: Partial<InsertEaCapability>): Promise<EaCapability | undefined>;
  deleteEaCapability(id: string): Promise<boolean>;

  // Data Domains
  getEaDataDomain(id: string): Promise<EaDataDomain | undefined>;
  getAllEaDataDomains(): Promise<EaDataDomain[]>;
  createEaDataDomain(data: InsertEaDataDomain): Promise<EaDataDomain>;
  updateEaDataDomain(id: string, data: Partial<InsertEaDataDomain>): Promise<EaDataDomain | undefined>;
  deleteEaDataDomain(id: string): Promise<boolean>;

  // Technology Standards
  getEaTechnologyStandard(id: string): Promise<EaTechnologyStandard | undefined>;
  getAllEaTechnologyStandards(): Promise<EaTechnologyStandard[]>;
  createEaTechnologyStandard(data: InsertEaTechnologyStandard): Promise<EaTechnologyStandard>;
  updateEaTechnologyStandard(id: string, data: Partial<InsertEaTechnologyStandard>): Promise<EaTechnologyStandard | undefined>;
  deleteEaTechnologyStandard(id: string): Promise<boolean>;

  // Integrations
  getEaIntegration(id: string): Promise<EaIntegration | undefined>;
  getAllEaIntegrations(): Promise<EaIntegration[]>;
  createEaIntegration(data: InsertEaIntegration): Promise<EaIntegration>;
  updateEaIntegration(id: string, data: Partial<InsertEaIntegration>): Promise<EaIntegration | undefined>;
  deleteEaIntegration(id: string): Promise<boolean>;
}
