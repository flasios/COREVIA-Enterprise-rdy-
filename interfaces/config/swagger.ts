import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { openApiSchemas } from './openapi-schemas';

const userRoleEnum = [
  'super_admin',
  'analyst',
  'specialist',
  'manager',
  'director',
  'technical_analyst',
  'security_analyst',
  'business_analyst',
  'project_analyst',
  'finance_analyst',
  'compliance_analyst',
  'data_analyst',
  'qa_analyst',
  'infrastructure_engineer',
  'portfolio_manager',
  'project_manager',
  'pmo_director',
  'pmo_analyst',
  'financial_director',
  'tender_manager',
] as const;

const sessionSecurity = [{ sessionAuth: [] }] as const;

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Enterprise Intelligence AI Platform API',
    version: '1.0.0',
    description: 'API documentation for the Enterprise Intelligence AI Transformation Platform Hub (EIAPH)',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'corevia.sid',
        description: 'Session-based authentication',
      },
    },
    schemas: {
      ...openApiSchemas,
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Error message' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string' },
          role: { type: 'string', enum: userRoleEnum },
          department: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          organizationId: { type: 'string', nullable: true },
          phoneNumber: { type: 'string', nullable: true },
          whatsappOptIn: { type: 'boolean' },
          lastLogin: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserArrayResponse: {
        type: 'array',
        items: { $ref: '#/components/schemas/User' },
      },
      UserPaginatedResponse: {
        allOf: [
          { $ref: '#/components/schemas/PaginatedResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/User' },
              },
            },
          },
        ],
      },
      AuthCsrfTokenResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          csrfToken: { type: 'string', nullable: true },
        },
      },
      SessionCheckResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          authenticated: { type: 'boolean', example: true },
          userId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: userRoleEnum },
        },
      },
      PrivacyDataSubjectRequestSubmitRequest: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['access', 'erasure', 'rectification', 'portability', 'restriction'],
          },
          reason: { type: 'string', minLength: 1, maxLength: 2000 },
          targetUserId: { type: 'string', format: 'uuid' },
        },
        required: ['type', 'reason'],
      },
      PrivacyDataSubjectRequestProcessRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'rejected'] },
          outcome: { type: 'string' },
        },
        required: ['status'],
      },
      PrivacyConsentUpdateRequest: {
        type: 'object',
        properties: {
          purpose: { type: 'string', minLength: 1 },
          granted: { type: 'boolean' },
        },
        required: ['purpose', 'granted'],
      },
      PrivacyDataSubjectRequestRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'rejected'] },
          requestedBy: { type: 'string', format: 'uuid' },
          targetUserId: { type: 'string', format: 'uuid' },
          reason: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          outcome: { type: 'string', nullable: true },
        },
      },
      PrivacyDataSubjectRequestCreateResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  requestId: { type: 'string', format: 'uuid' },
                  type: { type: 'string' },
                  status: { type: 'string', enum: ['pending'] },
                  message: { type: 'string' },
                },
              },
            },
          },
        ],
      },
      PrivacyDataSubjectRequestListResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/PrivacyDataSubjectRequestRecord' },
              },
            },
          },
        ],
      },
      PrivacyAdminRequestListResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/PrivacyDataSubjectRequestRecord' },
              },
              total: { type: 'number' },
            },
          },
        ],
      },
      PrivacyDataExportResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        ],
      },
      PrivacyConsentUpdateResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  purpose: { type: 'string' },
                  granted: { type: 'boolean' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  message: { type: 'string' },
                },
              },
            },
          },
        ],
      },
      HealthService: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          latencyMs: { type: 'number', nullable: true },
          message: { type: 'string', nullable: true },
          lastCheck: { type: 'string', format: 'date-time' },
        },
      },
      HealthSystem: {
        type: 'object',
        properties: {
          memoryUsageMB: { type: 'number' },
          heapUsedMB: { type: 'number' },
          heapTotalMB: { type: 'number' },
          cpuUser: { type: 'number' },
          cpuSystem: { type: 'number' },
          activeHandles: { type: 'number' },
          eventLoopLagMs: { type: 'number', nullable: true },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          timestamp: { type: 'string', format: 'date-time' },
          version: { type: 'string' },
          uptime: { type: 'number' },
          services: {
            type: 'array',
            items: { $ref: '#/components/schemas/HealthService' },
          },
          system: { $ref: '#/components/schemas/HealthSystem' },
        },
      },
      HealthServicesResponse: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          totalServices: { type: 'number' },
          healthy: { type: 'number' },
          degraded: { type: 'number' },
          unhealthy: { type: 'number' },
          services: {
            type: 'array',
            items: { $ref: '#/components/schemas/HealthService' },
          },
        },
      },
      CoreviaHealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'healthy' },
          timestamp: { type: 'string', format: 'date-time' },
          components: {
            type: 'object',
            properties: {
              pipeline: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  layers: { type: 'number' },
                },
              },
              intelligence: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  engines: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
              agents: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                },
              },
              rag: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                },
              },
            },
          },
          version: { type: 'string' },
        },
      },
      DemandReportListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/DemandReport' },
          },
          count: { type: 'number' },
          page: { type: 'number' },
          pageSize: { type: 'number' },
          totalPages: { type: 'number' },
        },
      },
      DemandReportWorkflowStatusResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string' },
          history: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          lastUpdated: { type: 'string', format: 'date-time', nullable: true },
          currentStage: {
            type: 'object',
            properties: {
              stage: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time', nullable: true },
              performer: { type: 'string' },
            },
          },
        },
      },
      DemandReportDeleteResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Demand report deleted successfully' },
        },
      },
      KnowledgeDocumentListResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/KnowledgeDocument' },
              },
              count: { type: 'number' },
            },
          },
        ],
      },
      KnowledgeUploadResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        ],
      },
      KnowledgeChunkedUploadInitResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  uploadId: { type: 'string' },
                  chunkSize: { type: 'number' },
                  totalChunks: { type: 'number' },
                },
              },
            },
          },
        ],
      },
      KnowledgeChunkedUploadProgressResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  uploadId: { type: 'string' },
                  filename: { type: 'string' },
                  fileSize: { type: 'number' },
                  chunkIndex: { type: 'number' },
                  receivedChunks: { type: 'number' },
                  totalChunks: { type: 'number' },
                  progress: { type: 'number' },
                  missingChunks: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
              },
            },
          },
        ],
      },
      GenerateBusinessCaseRequest: {
        type: 'object',
        properties: {
          clarificationResponses: {
            type: 'array',
            items: {},
            default: [],
          },
          clarificationsBypassed: { type: 'boolean', default: false },
          totalClarificationQuestions: { type: 'number', default: 0 },
          generationMode: { type: 'string', default: 'prompt_on_fallback' },
          force: { type: 'boolean', default: false },
        },
      },
      UpdateBusinessCaseRequest: {
        type: 'object',
        properties: {
          financialAssumptions: {},
          domainParameters: {},
          totalCostEstimate: {},
          aiRecommendedBudget: {},
        },
        additionalProperties: true,
      },
      CreateDemandVersionRequest: {
        type: 'object',
        properties: {
          versionType: { type: 'string', enum: ['major', 'minor', 'patch'] },
          contentType: { type: 'string', enum: ['business_case', 'requirements', 'enterprise_architecture', 'strategic_fit'], default: 'business_case' },
          changesSummary: { type: 'string' },
          skipAiSummary: { type: 'boolean', default: false },
          editReason: { type: 'string' },
          createdBy: { type: 'string' },
          createdByName: { type: 'string' },
          createdByRole: { type: 'string' },
          createdByDepartment: { type: 'string' },
          sessionId: { type: 'string' },
          ipAddress: { type: 'string' },
          businessCaseId: { type: 'string' },
          editedContent: {
            type: 'object',
            additionalProperties: true,
          },
          teamAssignments: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        required: ['versionType', 'createdBy', 'createdByName'],
      },
      UpdateDemandVersionRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'under_review', 'approved', 'published', 'archived', 'rejected', 'superseded'] },
          reviewComments: { type: 'string' },
          approvalComments: { type: 'string' },
          updatedBy: { type: 'string' },
          updatedByName: { type: 'string' },
          updatedByRole: { type: 'string' },
          sessionId: { type: 'string' },
          ipAddress: { type: 'string' },
        },
        required: ['updatedBy', 'updatedByName'],
      },
      ApproveDemandVersionRequest: {
        type: 'object',
        properties: {
          approvalComments: { type: 'string' },
          approvalLevel: { type: 'string', enum: ['initial', 'manager', 'final'], default: 'initial' },
          sessionId: { type: 'string' },
          ipAddress: { type: 'string' },
        },
      },
      PublishDemandVersionRequest: {
        type: 'object',
        properties: {
          publishReason: { type: 'string' },
          performedBy: { type: 'string' },
          performedByName: { type: 'string' },
          performedByRole: { type: 'string' },
          performedByDepartment: { type: 'string' },
          sessionId: { type: 'string' },
          ipAddress: { type: 'string' },
          effectiveDate: { type: 'string' },
          expirationDate: { type: 'string' },
        },
        required: ['publishReason', 'performedBy', 'performedByName', 'performedByRole', 'performedByDepartment'],
      },
      DemandVersionListResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        ],
      },
      StrategicFitPatchRequest: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            additionalProperties: true,
          },
          changesSummary: { type: 'string' },
        },
        required: ['data'],
      },
      DemandBranchCreateRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          parentBranchId: { type: 'string' },
          headVersionId: { type: 'string' },
          accessControl: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['name'],
      },
      DemandBranchUpdateRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['active', 'merged', 'abandoned'] },
          headVersionId: { type: 'string' },
          accessControl: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      DemandBranchMergeRequest: {
        type: 'object',
        properties: {
          targetBranchId: { type: 'string' },
        },
        required: ['targetBranchId'],
      },
      DemandGenericObjectRequest: {
        type: 'object',
        additionalProperties: true,
      },
      DemandConversionCreateRequest: {
        type: 'object',
        properties: {
          demandId: { type: 'string' },
          projectName: { type: 'string' },
          projectDescription: { type: 'string' },
          priority: { type: 'string' },
          proposedBudget: {},
          proposedStartDate: { type: 'string' },
          proposedEndDate: { type: 'string' },
          conversionData: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['demandId', 'projectName'],
      },
      DemandConversionDecisionRequest: {
        type: 'object',
        properties: {
          decisionNotes: { type: 'string' },
          rejectionReason: { type: 'string' },
        },
      },
      DemandAnalysisGenerateFieldsRequest: {
        type: 'object',
        properties: {
          businessObjective: { type: 'string', minLength: 10, maxLength: 5000 },
          organizationName: { type: 'string' },
          userId: { type: 'string' },
          accessLevel: { type: 'string' },
          dataClassification: { type: 'string' },
          generationMode: { type: 'string', enum: ['prompt_on_fallback', 'allow_fallback_template', 'ai_only'], default: 'prompt_on_fallback' },
        },
        required: ['businessObjective'],
      },
      DemandAnalysisEnhanceObjectiveRequest: {
        type: 'object',
        properties: {
          objective: { type: 'string', minLength: 10, maxLength: 5000 },
        },
        required: ['objective'],
      },
      DemandAnalysisClassifyRequest: {
        type: 'object',
        properties: {
          businessObjective: { type: 'string', minLength: 1, maxLength: 5000 },
          additionalContext: {
            type: 'object',
            additionalProperties: true,
          },
          generationMode: { type: 'string', enum: ['prompt_on_fallback', 'allow_fallback_template', 'ai_only'], default: 'prompt_on_fallback' },
        },
        required: ['businessObjective'],
      },
      DemandAnalysisComprehensiveRequest: {
        type: 'object',
        properties: {
          businessObjective: { type: 'string', minLength: 10, maxLength: 5000 },
          demandType: { type: 'string' },
          priorityLevel: { type: 'string' },
          estimatedBudget: { type: 'number' },
          targetDate: { type: 'string' },
          stakeholders: {
            type: 'array',
            items: { type: 'string' },
          },
          additionalContext: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['businessObjective'],
      },
      DemandAnalysisBatchRequest: {
        type: 'object',
        properties: {
          objectives: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: { type: 'string', minLength: 10 },
          },
        },
        required: ['objectives'],
      },
      DemandReport: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          workflowStatus: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      BusinessCase: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          demandReportId: { type: 'string', format: 'uuid' },
          executiveSummary: { type: 'string' },
          strategicAlignment: { type: 'object' },
          financialAnalysis: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      KnowledgeDocument: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          category: { type: 'string' },
          content: { type: 'string' },
          metadata: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  tags: [
    { name: 'Authentication', description: 'User authentication endpoints' },
    { name: 'Platform', description: 'Platform health and operational endpoints' },
    { name: 'Privacy', description: 'Privacy and data-subject rights endpoints' },
    { name: 'Users', description: 'User management endpoints' },
    { name: 'Demand Reports', description: 'Demand report CRUD and workflow operations' },
    { name: 'Demand Conversion', description: 'Demand-to-project conversion request endpoints' },
    { name: 'Demand Analysis', description: 'AI-powered demand analysis and classification endpoints' },
    { name: 'Business Cases', description: 'AI-generated business case operations' },
    { name: 'Knowledge Centre', description: 'Document management and AI search' },
    { name: 'AI Assistant', description: 'COREVIA AI assistant endpoints' },
    { name: 'Portfolio', description: 'Portfolio management and tracking' },
    { name: 'Compliance', description: 'Compliance engine operations' },
    { name: 'Analytics', description: 'Platform analytics and reporting' },
    { name: 'Documentation', description: 'API documentation endpoints' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Platform'],
        summary: 'Basic liveness check',
        description: 'Returns process uptime and system metrics for the API server.',
        operationId: 'getApiHealth',
        responses: {
          '200': {
            description: 'API server is running',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Platform'],
        summary: 'Dependency readiness check',
        description: 'Checks database, Redis, AI key availability, and module-level health before marking the service ready.',
        operationId: 'getApiReadiness',
        responses: {
          '200': {
            description: 'Service is ready or degraded but still serving traffic',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          '503': {
            description: 'Service is not ready',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/health/services': {
      get: {
        tags: ['Platform'],
        summary: 'Detailed service health inventory',
        description: 'Returns a per-service breakdown for platform dependencies and domain modules.',
        operationId: 'getApiServiceHealth',
        responses: {
          '200': {
            description: 'Service inventory',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthServicesResponse' },
              },
            },
          },
        },
      },
    },
    '/corevia/healthz': {
      get: {
        tags: ['Platform'],
        summary: 'COREVIA intelligence subsystem health',
        description: 'Operational health snapshot for pipeline, intelligence engines, agents, and RAG subsystems.',
        operationId: 'getCoreviaHealthz',
        responses: {
          '200': {
            description: 'COREVIA subsystem health',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CoreviaHealthResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/csrf-token': {
      get: {
        tags: ['Authentication'],
        summary: 'Get CSRF token for the current session',
        operationId: 'getCsrfToken',
        responses: {
          '200': {
            description: 'CSRF token payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthCsrfTokenResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/session-check': {
      get: {
        tags: ['Authentication'],
        summary: 'Check whether a session is authenticated',
        operationId: 'checkSession',
        responses: {
          '200': {
            description: 'Authenticated session',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionCheckResponse' },
              },
            },
          },
          '401': {
            description: 'No valid authenticated session',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    authenticated: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user and establish a session',
        operationId: 'registerUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered and authenticated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Validation or business rule failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate with username or email and establish a session',
        operationId: 'loginUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'User authenticated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Validation or authentication failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication rejected',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Destroy the current session',
        operationId: 'logoutUser',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Session destroyed',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        message: { type: 'string', example: 'Logged out successfully' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get the current authenticated user',
        operationId: 'getCurrentUser',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Authenticated user payload',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/privacy/data-request': {
      post: {
        tags: ['Privacy'],
        summary: 'Submit a data subject request',
        operationId: 'submitPrivacyDataRequest',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrivacyDataSubjectRequestSubmitRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Data subject request submitted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PrivacyDataSubjectRequestCreateResponse' },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      get: {
        tags: ['Privacy'],
        summary: 'List the current user privacy requests',
        operationId: 'listPrivacyDataRequests',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Privacy request list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PrivacyDataSubjectRequestListResponse' },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/privacy/data-export': {
      get: {
        tags: ['Privacy'],
        summary: 'Export the current user data package',
        operationId: 'exportPrivacyData',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Data export payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PrivacyDataExportResponse' },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/privacy/consent': {
      post: {
        tags: ['Privacy'],
        summary: 'Update consent preferences',
        operationId: 'updatePrivacyConsent',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrivacyConsentUpdateRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Consent updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PrivacyConsentUpdateResponse' },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/privacy/admin/requests': {
      get: {
        tags: ['Privacy'],
        summary: 'List all privacy requests for administrators',
        operationId: 'listPrivacyAdminRequests',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Administrative privacy request list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PrivacyAdminRequestListResponse' },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient privileges',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/privacy/admin/requests/{id}': {
      patch: {
        tags: ['Privacy'],
        summary: 'Process a privacy request',
        operationId: 'processPrivacyAdminRequest',
        security: sessionSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PrivacyDataSubjectRequestProcessRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Privacy request updated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/PrivacyDataSubjectRequestRecord' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient privileges',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Request not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        description: 'Returns the full user list, or a paginated response when the page query parameter is supplied.',
        operationId: 'listUsers',
        security: sessionSecurity,
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 },
            description: 'Optional page number. When omitted, the route returns the legacy non-paginated response envelope.',
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            description: 'Optional page size used only when page is provided.',
          },
        ],
        responses: {
          '200': {
            description: 'User list',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      allOf: [
                        { $ref: '#/components/schemas/SuccessResponse' },
                        {
                          type: 'object',
                          properties: {
                            data: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/User' },
                            },
                          },
                        },
                      ],
                    },
                    { $ref: '#/components/schemas/UserPaginatedResponse' },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a user',
        operationId: 'createUser',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InsertUser' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/users/available-project-managers': {
      get: {
        tags: ['Users'],
        summary: 'List available project managers',
        description: 'Legacy endpoint that returns a raw array instead of the standard success envelope.',
        operationId: 'getAvailableProjectManagers',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Available project managers',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserArrayResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get a single user by id',
        operationId: 'getUser',
        security: sessionSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'User found',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update a user',
        operationId: 'updateUser',
        security: sessionSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateUser' },
            },
          },
        },
        responses: {
          '200': {
            description: 'User updated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Deactivate a user',
        operationId: 'deactivateUser',
        security: sessionSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'User deactivated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-reports/stats': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get demand report statistics',
        operationId: 'getDemandReportStats',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Demand report statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-reports': {
      get: {
        tags: ['Demand Reports'],
        summary: 'List demand reports',
        description: 'Lists demand reports with optional filtering, field selection, workflow-status enrichment, and pagination.',
        operationId: 'listDemandReports',
        security: sessionSecurity,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200 } },
          { name: 'fields', in: 'query', schema: { type: 'string' }, description: 'Comma-separated field list.' },
          { name: 'includeRequirementsStatus', in: 'query', schema: { type: 'string' } },
          { name: 'includeEnterpriseArchitectureStatus', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Free-text search query.' },
          { name: 'mine', in: 'query', schema: { type: 'string' }, description: 'Boolean-like filter for requester-owned reports.' },
        ],
        responses: {
          '200': {
            description: 'Demand report list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DemandReportListResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid query parameters',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Demand Reports'],
        summary: 'Create a demand report',
        description: 'Creates a new demand report, assigns a project ID, and initializes workflow history.',
        operationId: 'createDemandReport',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InsertDemandReport' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Demand report created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/DemandReport' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Project ID conflict',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/submitted-summary': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get the submitted summary and decision feedback for a demand report',
        operationId: 'getDemandReportSubmittedSummary',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Submitted demand summary',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Not authorized to view this report',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-reports/{id}': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get a demand report by id',
        operationId: 'getDemandReport',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Demand report',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/DemandReport' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Demand Reports'],
        summary: 'Update a demand report',
        operationId: 'updateDemandReport',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateDemandReport' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Demand report updated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/DemandReport' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions or ownership failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Demand Reports'],
        summary: 'Delete a demand report',
        description: 'Only managers can delete reports.',
        operationId: 'deleteDemandReport',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Demand report deleted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DemandReportDeleteResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/workflow-status': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get workflow status for a demand report',
        operationId: 'getDemandReportWorkflowStatus',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Workflow status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DemandReportWorkflowStatusResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/detect-clarifications': {
      post: {
        tags: ['Business Cases'],
        summary: 'Detect business-case clarification questions for a demand report',
        operationId: 'detectDemandClarifications',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Clarification detection result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/generate-business-case': {
      post: {
        tags: ['Business Cases'],
        summary: 'Generate or regenerate a business case draft',
        operationId: 'generateDemandBusinessCase',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenerateBusinessCaseRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Business case generation result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '500': {
            description: 'Pipeline completed without a business case draft',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/submit-clarifications': {
      post: {
        tags: ['Business Cases'],
        summary: 'Submit clarification answers and continue business-case generation',
        operationId: 'submitDemandClarifications',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Clarifications submitted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/business-case': {
      get: {
        tags: ['Business Cases'],
        summary: 'Get the current business case for a demand report',
        operationId: 'getDemandBusinessCase',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Business case payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Business case not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
      put: {
        tags: ['Business Cases'],
        summary: 'Update a business case draft for a demand report',
        operationId: 'updateDemandBusinessCase',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateBusinessCaseRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Business case updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Business case not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/financial-model': {
      get: {
        tags: ['Business Cases'],
        summary: 'Get the current financial model for a demand report',
        operationId: 'getDemandFinancialModel',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Financial model payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report or financial model not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/generate-requirements': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Generate requirements analysis for a demand report',
        operationId: 'generateDemandRequirements',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Requirements analysis generated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Layer gate or validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '409': {
            description: 'AI fallback choice required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/requirements': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get requirements analysis for a demand report',
        operationId: 'getDemandRequirements',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Requirements analysis payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report or requirements analysis not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/requirements/market-research': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Generate market research from requirements analysis',
        operationId: 'generateRequirementsMarketResearch',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Market research result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report or requirements analysis not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/versions': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Create a report version',
        operationId: 'createDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateDemandVersionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Version created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure or pending version conflict',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
      get: {
        tags: ['Demand Reports'],
        summary: 'List report versions',
        operationId: 'listDemandReportVersions',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Version list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DemandVersionListResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get a specific report version',
        operationId: 'getDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Version detail',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Version not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
      put: {
        tags: ['Demand Reports'],
        summary: 'Update a specific report version',
        operationId: 'updateDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateDemandVersionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Version updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Version not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/approve': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Approve a report version',
        operationId: 'approveDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApproveDemandVersionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Version approved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation or workflow failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Version not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/publish': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Publish a report version',
        operationId: 'publishDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PublishDemandVersionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Version published',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation or workflow failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Version not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/verify': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Verify integrity for a report version',
        operationId: 'verifyDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Integrity verification result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Version not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/audit-log': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get audit log entries for a report version',
        operationId: 'getDemandReportVersionAuditLog',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Version audit log',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Version not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/viewers': {
      get: {
        tags: ['Demand Reports'],
        summary: 'List viewers for a report version',
        operationId: 'listDemandReportVersionViewers',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Version viewers', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/editors': {
      get: {
        tags: ['Demand Reports'],
        summary: 'List editors for a report version',
        operationId: 'listDemandReportVersionEditors',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Version editors', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/impact': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get downstream impact for a report version',
        operationId: 'getDemandReportVersionImpact',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Version impact summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/sign': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Digitally sign a report version',
        operationId: 'signDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Version signed', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/audit-trail': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get the audit trail for a report version',
        operationId: 'getDemandReportVersionAuditTrail',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Version audit trail', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/export/pdf': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Export all report versions as PDF',
        operationId: 'exportDemandReportVersionsPdf',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Versions export PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Demand report not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/export/pdf': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Export a specific report version as PDF',
        operationId: 'exportDemandReportVersionPdf',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Version export PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/compare/{v1}/{v2}/pdf': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Export a PDF comparison between two versions',
        operationId: 'compareDemandReportVersionsPdf',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'v1', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'v2', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Version comparison PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'One or more versions not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/rollback': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Rollback a report version',
        operationId: 'rollbackDemandReportVersion',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Version rolled back', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation or workflow failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/versions/{versionId}/send-to-manager': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Escalate a report version to manager review',
        operationId: 'sendDemandReportVersionToManager',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Version sent to manager', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation or workflow failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Version not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/migrate-to-versions': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Migrate a demand report into versioned history',
        operationId: 'migrateDemandReportToVersions',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Demand report migrated to versions', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation or migration failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Demand report not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/export/{type}/{format}': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Export a demand artifact',
        description: 'Exports business case, requirements, or strategic-fit artifacts in PDF or PPTX format.',
        operationId: 'exportDemandArtifact',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['business_case', 'requirements', 'strategic_fit'] } },
          { name: 'format', in: 'path', required: true, schema: { type: 'string', enum: ['pdf', 'pptx'] } },
          { name: 'versionId', in: 'query', schema: { type: 'string' } },
          { name: 'useAgent', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Exported artifact',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '400': {
            description: 'Unsupported type or format',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '500': {
            description: 'Export generation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/workflow': {
      put: {
        tags: ['Demand Reports'],
        summary: 'Advance or update demand workflow state',
        operationId: 'updateDemandWorkflow',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Workflow updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Workflow validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/workflow-history': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get demand workflow history',
        operationId: 'getDemandWorkflowHistory',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Workflow history',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/coveria-notify-specialist': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Notify the Coveria specialist for a demand workflow event',
        operationId: 'notifyDemandSpecialist',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Notification result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/generate-strategic-fit': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Generate strategic fit analysis',
        operationId: 'generateDemandStrategicFit',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Strategic fit generated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
            },
          },
          '400': {
            description: 'Prerequisite or validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/strategic-fit': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get strategic fit analysis',
        operationId: 'getDemandStrategicFit',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Strategic fit payload',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Strategic fit not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
      patch: {
        tags: ['Demand Reports'],
        summary: 'Patch strategic fit analysis',
        operationId: 'patchDemandStrategicFit',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StrategicFitPatchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Strategic fit updated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/regenerate-strategic-fit': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Regenerate strategic fit analysis',
        operationId: 'regenerateDemandStrategicFit',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Strategic fit regenerated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
            },
          },
          '400': {
            description: 'Prerequisite failure',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Demand report not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/demand-reports/{id}/branches': {
      get: {
        tags: ['Demand Reports'],
        summary: 'List branches for a demand report',
        operationId: 'listDemandBranches',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Branch list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
            },
          },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        tags: ['Demand Reports'],
        summary: 'Create a branch for a demand report',
        operationId: 'createDemandBranch',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandBranchCreateRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Branch created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
            },
          },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions or ownership failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/branches/tree': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get branch tree for a demand report',
        operationId: 'getDemandBranchTree',
        security: sessionSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Branch tree', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/branches/{branchId}': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get a demand branch',
        operationId: 'getDemandBranch',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'branchId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Branch detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Branch not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        tags: ['Demand Reports'],
        summary: 'Update a demand branch',
        operationId: 'updateDemandBranch',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'branchId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DemandBranchUpdateRequest' } },
          },
        },
        responses: {
          '200': { description: 'Branch updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions or ownership failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Branch not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Demand Reports'],
        summary: 'Delete a demand branch',
        operationId: 'deleteDemandBranch',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'branchId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Branch deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions or ownership failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Branch not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/branches/{branchId}/merge': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Merge a demand branch into a target branch',
        operationId: 'mergeDemandBranch',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'branchId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DemandBranchMergeRequest' } },
          },
        },
        responses: {
          '201': { description: 'Merge initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions or ownership failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Branch not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/merges': {
      get: {
        tags: ['Demand Reports'],
        summary: 'List branch merges for a demand report',
        operationId: 'listDemandBranchMerges',
        security: sessionSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Merge list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/section-assignments': {
      get: {
        tags: ['Demand Reports'],
        summary: 'List section assignments for a demand report',
        operationId: 'listDemandSectionAssignments',
        security: sessionSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Section assignments', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        tags: ['Demand Reports'],
        summary: 'Assign a section for a demand report',
        operationId: 'assignDemandSection',
        security: sessionSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' } },
          },
        },
        responses: {
          '200': { description: 'Section assigned', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{id}/section-assignments/{sectionName}': {
      patch: {
        tags: ['Demand Reports'],
        summary: 'Update a section assignment',
        operationId: 'updateDemandSectionAssignment',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'sectionName', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DemandGenericObjectRequest' } },
          },
        },
        responses: {
          '200': { description: 'Section assignment updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Section assignment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Demand Reports'],
        summary: 'Remove a section assignment',
        operationId: 'removeDemandSectionAssignment',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'sectionName', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Section assignment removed', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Section assignment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{demandReportId}/ea/generate': {
      post: {
        tags: ['Demand Reports'],
        summary: 'Generate enterprise architecture via demand compatibility route',
        operationId: 'generateDemandEaCompatibility',
        security: sessionSecurity,
        parameters: [{ name: 'demandReportId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Enterprise architecture generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Prerequisite or validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Demand report not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-reports/{demandReportId}/ea': {
      get: {
        tags: ['Demand Reports'],
        summary: 'Get enterprise architecture via demand compatibility route',
        operationId: 'getDemandEaCompatibility',
        security: sessionSecurity,
        parameters: [{ name: 'demandReportId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Enterprise architecture payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Enterprise architecture not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        tags: ['Demand Reports'],
        summary: 'Patch enterprise architecture via demand compatibility route',
        operationId: 'patchDemandEaCompatibility',
        security: sessionSecurity,
        parameters: [{ name: 'demandReportId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/StrategicFitPatchRequest' } },
          },
        },
        responses: {
          '200': { description: 'Enterprise architecture updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation or prerequisite failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Demand report not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/knowledge/search': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Run semantic search over knowledge assets',
        operationId: 'semanticKnowledgeSearch',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  topK: { type: 'integer', minimum: 1, maximum: 100 },
                  accessLevel: { type: 'string', enum: ['public', 'internal', 'restricted'] },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Semantic search result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/hybrid-search': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Run hybrid lexical and semantic search',
        operationId: 'hybridKnowledgeSearch',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  topK: { type: 'integer', minimum: 1, maximum: 100 },
                  accessLevel: { type: 'string', enum: ['public', 'internal', 'restricted'] },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Hybrid search result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/enhanced-search': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Run enhanced search with expansion and reranking controls',
        operationId: 'enhancedKnowledgeSearch',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  topK: { type: 'integer', minimum: 1 },
                  accessLevel: { type: 'string' },
                  sessionId: { type: 'string' },
                  useQueryExpansion: { type: 'boolean' },
                  useReranking: { type: 'boolean' },
                  useConversationalMemory: { type: 'boolean' },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Enhanced search result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/enhanced-ask': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Ask an enhanced grounded question with session context',
        operationId: 'enhancedAskKnowledge',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  topK: { type: 'integer', minimum: 1 },
                  accessLevel: { type: 'string' },
                  sessionId: { type: 'string' },
                  systemPrompt: { type: 'string' },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Enhanced answer payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/ask': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Ask a grounded knowledge question',
        operationId: 'askKnowledge',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  topK: { type: 'integer', minimum: 1, maximum: 20 },
                  accessLevel: { type: 'string', enum: ['public', 'internal', 'restricted'] },
                  systemPrompt: { type: 'string' },
                  useHybrid: { type: 'boolean' },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Grounded answer payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/suggestions': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'Get contextual knowledge suggestions',
        operationId: 'getKnowledgeSuggestions',
        security: sessionSecurity,
        parameters: [
          { name: 'stage', in: 'query', schema: { type: 'string' } },
          { name: 'demandId', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 3 } },
          { name: 'title', in: 'query', schema: { type: 'string' } },
          { name: 'description', in: 'query', schema: { type: 'string' } },
          { name: 'requestType', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Knowledge suggestions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/documents/stats': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'Get knowledge document statistics',
        operationId: 'getKnowledgeDocumentStats',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Document statistics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-conversion-requests': {
      get: {
        tags: ['Demand Conversion'],
        summary: 'List demand conversion requests',
        operationId: 'listDemandConversionRequests',
        security: sessionSecurity,
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string' },
            description: 'Optional conversion request status filter.',
          },
        ],
        responses: {
          '200': {
            description: 'Conversion request list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    requests: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Demand Conversion'],
        summary: 'Create a new demand conversion request',
        operationId: 'createDemandConversionRequest',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandConversionCreateRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Conversion request created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-conversion-requests/stats': {
      get: {
        tags: ['Demand Conversion'],
        summary: 'Get demand conversion statistics',
        operationId: 'getDemandConversionStats',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Conversion request statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-conversion-requests/{id}': {
      get: {
        tags: ['Demand Conversion'],
        summary: 'Get a demand conversion request',
        operationId: 'getDemandConversionRequest',
        security: sessionSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Conversion request details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Request not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-conversion-requests/{id}/approve': {
      put: {
        tags: ['Demand Conversion'],
        summary: 'Approve a demand conversion request',
        operationId: 'approveDemandConversionRequest',
        security: sessionSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandConversionDecisionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Conversion request approved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Request not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-conversion-requests/{id}/reject': {
      put: {
        tags: ['Demand Conversion'],
        summary: 'Reject a demand conversion request',
        operationId: 'rejectDemandConversionRequest',
        security: sessionSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandConversionDecisionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Conversion request rejected',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Request not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/demand-analysis/generate-fields': {
      post: {
        tags: ['Demand Analysis'],
        summary: 'Generate demand fields from a business objective',
        operationId: 'generateDemandAnalysisFields',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandAnalysisGenerateFieldsRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Generated demand field analysis', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'AI fallback choice required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-analysis/enhance-objective': {
      post: {
        tags: ['Demand Analysis'],
        summary: 'Enhance a business objective with AI',
        operationId: 'enhanceDemandAnalysisObjective',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandAnalysisEnhanceObjectiveRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Enhanced objective response', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-analysis/classify': {
      post: {
        tags: ['Demand Analysis'],
        summary: 'Classify a demand request',
        operationId: 'classifyDemandAnalysisRequest',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandAnalysisClassifyRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Demand classification result', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'AI fallback choice required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-analysis/comprehensive': {
      post: {
        tags: ['Demand Analysis'],
        summary: 'Generate comprehensive demand analysis',
        operationId: 'createComprehensiveDemandAnalysis',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandAnalysisComprehensiveRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Comprehensive demand analysis', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-analysis/batch-analyze': {
      post: {
        tags: ['Demand Analysis'],
        summary: 'Batch analyze multiple demand objectives',
        operationId: 'batchAnalyzeDemandObjectives',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DemandAnalysisBatchRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Batch analysis result', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { description: 'Validation failure', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-analysis/statistics': {
      get: {
        tags: ['Demand Analysis'],
        summary: 'Get demand analysis runtime statistics',
        operationId: 'getDemandAnalysisStatistics',
        security: sessionSecurity,
        responses: {
          '200': { description: 'Demand analysis statistics', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-analysis/cache': {
      delete: {
        tags: ['Demand Analysis'],
        summary: 'Clear the demand analysis cache',
        operationId: 'clearDemandAnalysisCache',
        security: sessionSecurity,
        responses: {
          '200': { description: 'Demand analysis cache cleared', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { description: 'Authentication required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/demand-analysis/health': {
      get: {
        tags: ['Demand Analysis'],
        summary: 'Get demand analysis service health',
        operationId: 'getDemandAnalysisHealth',
        responses: {
          '200': { description: 'Demand analysis health payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
        },
      },
    },
    '/knowledge/documents': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'List knowledge documents',
        operationId: 'listKnowledgeDocuments',
        security: sessionSecurity,
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'accessLevel', in: 'query', schema: { type: 'string' } },
          { name: 'fileType', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
          { name: 'visibilityScope', in: 'query', schema: { type: 'string', enum: ['global', 'organization', 'department', 'private'] } },
          { name: 'sector', in: 'query', schema: { type: 'string' } },
          { name: 'organization', in: 'query', schema: { type: 'string' } },
          { name: 'department', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Document list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KnowledgeDocumentListResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/documents/unassigned': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'List unassigned knowledge documents',
        operationId: 'getUnassignedKnowledgeDocuments',
        security: sessionSecurity,
        responses: {
          '200': {
            description: 'Unassigned document list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KnowledgeDocumentListResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/documents/{id}': {
      patch: {
        tags: ['Knowledge Centre'],
        summary: 'Update knowledge document metadata',
        operationId: 'updateKnowledgeDocument',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  accessLevel: { type: 'string', enum: ['public', 'internal', 'confidential'] },
                },
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Document updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Knowledge Centre'],
        summary: 'Delete a knowledge document',
        operationId: 'deleteKnowledgeDocument',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Document deleted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/documents/{id}/preview': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'Preview a knowledge document',
        operationId: 'previewKnowledgeDocument',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'chunkId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Document preview payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/documents/{id}/file': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'Get inline file content for a knowledge document',
        operationId: 'getKnowledgeDocumentFile',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Inline file or text fallback',
            content: {
              'text/plain': { schema: { type: 'string' } },
              'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/knowledge/documents/{id}/download': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'Download a knowledge document',
        operationId: 'downloadKnowledgeDocument',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Binary or text fallback content',
            content: {
              'application/octet-stream': {
                schema: { type: 'string', format: 'binary' },
              },
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/documents/{id}/view': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'View a stored knowledge document inline',
        operationId: 'viewKnowledgeDocument',
        security: sessionSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Inline document stream or text fallback',
            content: {
              'text/plain': { schema: { type: 'string' } },
              'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Document not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/knowledge/upload': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Upload a single knowledge document',
        operationId: 'uploadKnowledgeDocument',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  category: { type: 'string' },
                  tags: { type: 'string', description: 'JSON-encoded array of strings.' },
                  accessLevel: { type: 'string', enum: ['public', 'internal', 'restricted'], default: 'internal' },
                  ignoreDuplicateWarning: { type: 'string' },
                  folderPath: { type: 'string' },
                  visibilityScope: { type: 'string', enum: ['global', 'organization', 'department', 'private'] },
                  sector: { type: 'string' },
                  organization: { type: 'string' },
                  department: { type: 'string' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload processed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KnowledgeUploadResponse' },
              },
            },
          },
          '400': {
            description: 'Upload validation or security failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/knowledge/upload/chunked/init': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Initialize a chunked knowledge upload session',
        operationId: 'initKnowledgeChunkedUpload',
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  fileSize: { type: 'number' },
                  fileType: { type: 'string' },
                  totalChunks: { type: 'number' },
                  category: { type: 'string' },
                  tags: { type: 'string' },
                  accessLevel: { type: 'string' },
                  folderPath: { type: 'string' },
                  visibilityScope: { type: 'string', enum: ['global', 'organization', 'department', 'private'] },
                  sector: { type: 'string' },
                  organization: { type: 'string' },
                  department: { type: 'string' },
                },
                required: ['filename', 'fileSize', 'totalChunks'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Chunked upload initialized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KnowledgeChunkedUploadInitResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid initialization payload',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '429': {
            description: 'Too many concurrent uploads',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/knowledge/upload/chunked/{uploadId}/chunk': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Upload one chunk for a chunked knowledge upload session',
        operationId: 'uploadKnowledgeChunk',
        security: sessionSecurity,
        parameters: [
          { name: 'uploadId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  chunk: { type: 'string', format: 'binary' },
                  chunkIndex: { type: 'number' },
                },
                required: ['chunk', 'chunkIndex'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Chunk accepted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KnowledgeChunkedUploadProgressResponse' },
              },
            },
          },
          '400': {
            description: 'Missing chunk data or index',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Unauthorized upload session access',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Upload session not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/knowledge/upload/chunked/{uploadId}/complete': {
      post: {
        tags: ['Knowledge Centre'],
        summary: 'Complete a chunked knowledge upload session',
        operationId: 'completeKnowledgeChunkedUpload',
        security: sessionSecurity,
        parameters: [
          { name: 'uploadId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Chunked upload completed and document created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KnowledgeUploadResponse' },
              },
            },
          },
          '400': {
            description: 'Upload incomplete or failed security checks',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Unauthorized upload session access',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Upload session not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/knowledge/upload/chunked/{uploadId}/status': {
      get: {
        tags: ['Knowledge Centre'],
        summary: 'Get status for a chunked knowledge upload session',
        operationId: 'getKnowledgeChunkedUploadStatus',
        security: sessionSecurity,
        parameters: [
          { name: 'uploadId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Upload status payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KnowledgeChunkedUploadProgressResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '403': {
            description: 'Unauthorized upload session access',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          '404': {
            description: 'Upload session not found',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/docs.json': {
      get: {
        tags: ['Documentation'],
        summary: 'Get the generated OpenAPI document',
        operationId: 'getOpenApiDocument',
        responses: {
          '200': {
            description: 'OpenAPI JSON document',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function setupSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EIAPH API Documentation',
  }));

  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
