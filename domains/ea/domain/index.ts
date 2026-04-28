/**
 * EA Module — Domain Layer
 *
 * Pure types and interfaces for Enterprise Architecture entities.
 * No imports from infrastructure, DB, HTTP, or filesystem.
 */

export interface EaApplication {
  id: string;
  name: string;
  description: string | null;
  lifecycle: string | null;
  criticality: string | null;
  ownerTeam: string | null;
  techStack: unknown | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EaCapability {
  id: string;
  name: string;
  description: string | null;
  level: number | null;
  parentId: string | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EaDataDomain {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  classification: string | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EaTechnologyStandard {
  id: string;
  name: string;
  category: string | null;
  status: string | null;
  version: string | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EaIntegration {
  id: string;
  name: string;
  sourceAppId: string | null;
  targetAppId: string | null;
  protocol: string | null;
  dataFlow: string | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}
