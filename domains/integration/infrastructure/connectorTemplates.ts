/**
 * COREVIA API Integration Hub — Pre-Built Connector Templates
 * =============================================================
 * Ready-to-use connector configurations for common enterprise systems.
 * Users configure credentials, and the connector is ready to go.
 * 
 * Categories:
 *  - ERP: SAP, Oracle EBS, Microsoft Dynamics 365
 *  - ITSM: ServiceNow, Jira Service Management, BMC Remedy
 *  - CRM: Salesforce, HubSpot, Microsoft Dynamics CRM
 *  - HR: SAP SuccessFactors, Workday, Oracle HCM
 *  - Cloud: AWS, Azure, GCP
 *  - Government: UAE PASS, TDRA, MOHRE, ICP
 *  - DevOps: GitHub, GitLab, Azure DevOps, Jenkins
 *  - Communication: Slack, Microsoft Teams, Twilio
 *  - Custom: User-defined connectors
 */

import type { ConnectorEndpoint, ConnectorAuth, RetryConfig, CircuitBreakerConfig } from "./connectorEngine";

export interface ConnectorTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  protocol: "rest" | "graphql" | "soap" | "webhook" | "grpc";
  baseUrl: string;        // placeholder, user fills in
  authType: ConnectorAuth["type"];
  defaultHeaders?: Record<string, string>;
  timeout: number;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  endpoints: ConnectorEndpoint[];
  healthCheck?: {
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    expectedStatus: number;
    intervalMs: number;
  };
  requiredFields: string[];          // fields the admin must fill
  documentationUrl?: string;
}

// ─── Default Configs ────────────────────────────────────────────────────────

const defaultRetry: RetryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  retryOnStatus: [429, 502, 503, 504],
};

const defaultCircuitBreaker: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenRequests: 2,
};

// ─── ERP Connectors ─────────────────────────────────────────────────────────

const sapErp: ConnectorTemplate = {
  id: "sap-erp",
  name: "SAP S/4HANA",
  description: "Connect to SAP S/4HANA for ERP data — purchase orders, budgets, cost centers, and financial postings.",
  icon: "database",
  category: "erp",
  protocol: "rest",
  baseUrl: "https://your-sap-instance.com/sap/opu/odata/sap",
  authType: "basic",
  defaultHeaders: { "X-CSRF-Token": "Fetch" },
  timeout: 45000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-cost-centers", name: "Get Cost Centers", method: "GET", path: "/API_COSTCENTER_SRV/A_CostCenter" },
    { id: "get-purchase-orders", name: "Get Purchase Orders", method: "GET", path: "/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder" },
    { id: "create-purchase-req", name: "Create Purchase Requisition", method: "POST", path: "/API_PURCHASEREQ_PROCESS_SRV/A_PurchaseRequisitionHeader" },
    { id: "get-budgets", name: "Get Budget Data", method: "GET", path: "/API_BUDGET_SRV/A_Budget" },
    { id: "get-vendors", name: "Get Vendor Master", method: "GET", path: "/API_BUSINESS_PARTNER/A_BusinessPartner", queryParams: { "$filter": "BusinessPartnerCategory eq '1'" } },
    { id: "post-financial", name: "Post Financial Entry", method: "POST", path: "/API_JOURNALENTRY_SRV/A_JournalEntryItemBasic" },
  ],
  healthCheck: { endpoint: "/API_COSTCENTER_SRV/$metadata", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "username", "password"],
  documentationUrl: "https://api.sap.com/api/API_COSTCENTER_SRV/overview",
};

const oracleEbs: ConnectorTemplate = {
  id: "oracle-ebs",
  name: "Oracle E-Business Suite",
  description: "Connect to Oracle EBS for financials, procurement, and project accounting.",
  icon: "database",
  category: "erp",
  protocol: "rest",
  baseUrl: "https://your-oracle-instance.com/webservices/rest",
  authType: "basic",
  timeout: 45000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-gl-periods", name: "Get GL Periods", method: "GET", path: "/gl/periods" },
    { id: "get-purchase-orders", name: "Get Purchase Orders", method: "GET", path: "/po/purchase-orders" },
    { id: "get-projects", name: "Get Projects", method: "GET", path: "/pa/projects" },
    { id: "get-budgets", name: "Get Budgets", method: "GET", path: "/gl/budgets" },
  ],
  healthCheck: { endpoint: "/health", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "username", "password"],
};

const dynamics365: ConnectorTemplate = {
  id: "dynamics-365",
  name: "Microsoft Dynamics 365",
  description: "Connect to Dynamics 365 Finance & Operations for ERP, CRM, and project data.",
  icon: "boxes",
  category: "erp",
  protocol: "rest",
  baseUrl: "https://your-org.api.crm.dynamics.com/api/data/v9.2",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-accounts", name: "Get Accounts", method: "GET", path: "/accounts" },
    { id: "get-opportunities", name: "Get Opportunities", method: "GET", path: "/opportunities" },
    { id: "get-projects", name: "Get Projects", method: "GET", path: "/msdyn_projects" },
    { id: "get-purchase-orders", name: "Get Purchase Orders", method: "GET", path: "/purchaseorders" },
    { id: "create-contact", name: "Create Contact", method: "POST", path: "/contacts" },
  ],
  healthCheck: { endpoint: "/WhoAmI", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/odata",
};

// ─── ITSM Connectors ────────────────────────────────────────────────────────

const serviceNow: ConnectorTemplate = {
  id: "servicenow",
  name: "ServiceNow",
  description: "Connect to ServiceNow for incident management, change requests, CMDB, and service catalog.",
  icon: "ticket",
  category: "itsm",
  protocol: "rest",
  baseUrl: "https://your-instance.service-now.com/api",
  authType: "basic",
  defaultHeaders: { "Accept": "application/json" },
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-incidents", name: "Get Incidents", method: "GET", path: "/now/table/incident" },
    { id: "create-incident", name: "Create Incident", method: "POST", path: "/now/table/incident" },
    { id: "get-changes", name: "Get Change Requests", method: "GET", path: "/now/table/change_request" },
    { id: "create-change", name: "Create Change Request", method: "POST", path: "/now/table/change_request" },
    { id: "get-cmdb-ci", name: "Get CMDB Items", method: "GET", path: "/now/table/cmdb_ci" },
    { id: "get-catalog-items", name: "Get Catalog Items", method: "GET", path: "/sn_sc/servicecatalog/items" },
  ],
  healthCheck: { endpoint: "/now/table/sys_properties?sysparm_limit=1", method: "GET", expectedStatus: 200, intervalMs: 120000 },
  requiredFields: ["baseUrl", "username", "password"],
  documentationUrl: "https://developer.servicenow.com/dev.do#!/reference/api/latest/rest/c_TableAPI",
};

const jiraServiceManagement: ConnectorTemplate = {
  id: "jira-sm",
  name: "Jira Service Management",
  description: "Connect to Jira Service Management for tickets, queues, SLAs, and knowledge base.",
  icon: "bug",
  category: "itsm",
  protocol: "rest",
  baseUrl: "https://your-domain.atlassian.net/rest",
  authType: "basic",
  defaultHeaders: { "Accept": "application/json" },
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-issues", name: "Search Issues", method: "POST", path: "/api/3/search" },
    { id: "create-issue", name: "Create Issue", method: "POST", path: "/api/3/issue" },
    { id: "get-queues", name: "Get Queues", method: "GET", path: "/servicedeskapi/servicedesk/:serviceDeskId/queue" },
    { id: "get-customers", name: "Get Customers", method: "GET", path: "/servicedeskapi/servicedesk/:serviceDeskId/customer" },
  ],
  healthCheck: { endpoint: "/api/3/myself", method: "GET", expectedStatus: 200, intervalMs: 120000 },
  requiredFields: ["baseUrl", "username", "password"],
  documentationUrl: "https://developer.atlassian.com/cloud/jira/service-desk/rest/intro/",
};

// ─── CRM Connectors ─────────────────────────────────────────────────────────

const salesforce: ConnectorTemplate = {
  id: "salesforce",
  name: "Salesforce",
  description: "Connect to Salesforce CRM for leads, opportunities, accounts, and custom objects.",
  icon: "cloud",
  category: "crm",
  protocol: "rest",
  baseUrl: "https://your-instance.salesforce.com/services/data/v59.0",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "query", name: "SOQL Query", method: "GET", path: "/query", queryParams: { q: "{{soql}}" } },
    { id: "get-accounts", name: "Get Accounts", method: "GET", path: "/sobjects/Account" },
    { id: "get-opportunities", name: "Get Opportunities", method: "GET", path: "/sobjects/Opportunity" },
    { id: "get-leads", name: "Get Leads", method: "GET", path: "/sobjects/Lead" },
    { id: "create-account", name: "Create Account", method: "POST", path: "/sobjects/Account" },
    { id: "create-opportunity", name: "Create Opportunity", method: "POST", path: "/sobjects/Opportunity" },
  ],
  healthCheck: { endpoint: "/limits", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm",
};

const hubspot: ConnectorTemplate = {
  id: "hubspot",
  name: "HubSpot",
  description: "Connect to HubSpot for contacts, deals, companies, and marketing automation.",
  icon: "users",
  category: "crm",
  protocol: "rest",
  baseUrl: "https://api.hubapi.com",
  authType: "bearer",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-contacts", name: "Get Contacts", method: "GET", path: "/crm/v3/objects/contacts" },
    { id: "create-contact", name: "Create Contact", method: "POST", path: "/crm/v3/objects/contacts" },
    { id: "get-deals", name: "Get Deals", method: "GET", path: "/crm/v3/objects/deals" },
    { id: "create-deal", name: "Create Deal", method: "POST", path: "/crm/v3/objects/deals" },
    { id: "get-companies", name: "Get Companies", method: "GET", path: "/crm/v3/objects/companies" },
  ],
  healthCheck: { endpoint: "/crm/v3/objects/contacts?limit=1", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["bearerToken"],
  documentationUrl: "https://developers.hubspot.com/docs/api/crm/contacts",
};

// ─── HR / HCM Connectors ────────────────────────────────────────────────────

const workday: ConnectorTemplate = {
  id: "workday",
  name: "Workday",
  description: "Connect to Workday for HR data — employees, org structure, benefits, and payroll.",
  icon: "user-cog",
  category: "hr",
  protocol: "rest",
  baseUrl: "https://your-tenant.workday.com/ccx/api/v1/your-tenant",
  authType: "oauth2_client_credentials",
  timeout: 45000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-workers", name: "Get Workers", method: "GET", path: "/workers" },
    { id: "get-organizations", name: "Get Organizations", method: "GET", path: "/organizations" },
    { id: "get-supervisory-orgs", name: "Get Supervisory Orgs", method: "GET", path: "/supervisoryOrganizations" },
    { id: "get-jobs", name: "Get Job Profiles", method: "GET", path: "/jobProfiles" },
  ],
  healthCheck: { endpoint: "/workers?limit=1", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://community.workday.com/sites/default/files/file-hosting/restapi/index.html",
};

const sapSuccessFactors: ConnectorTemplate = {
  id: "sap-successfactors",
  name: "SAP SuccessFactors",
  description: "Connect to SAP SuccessFactors for HR, talent, learning, and performance management.",
  icon: "graduation-cap",
  category: "hr",
  protocol: "rest",
  baseUrl: "https://your-api.successfactors.com/odata/v2",
  authType: "basic",
  timeout: 45000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-employees", name: "Get Employees", method: "GET", path: "/User" },
    { id: "get-jobs", name: "Get Job Info", method: "GET", path: "/EmpJob" },
    { id: "get-org-chart", name: "Get Org Chart", method: "GET", path: "/Position" },
    { id: "get-learning", name: "Get Learning Activities", method: "GET", path: "/LearningHistoryV2" },
  ],
  healthCheck: { endpoint: "/User?$top=1", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "username", "password"],
};

// ─── Cloud Platform Connectors ───────────────────────────────────────────────

const awsConnector: ConnectorTemplate = {
  id: "aws",
  name: "AWS Services",
  description: "Connect to AWS APIs for S3, Lambda, CloudWatch, Cost Explorer, and more.",
  icon: "cloud",
  category: "cloud",
  protocol: "rest",
  baseUrl: "https://{{service}}.{{region}}.amazonaws.com",
  authType: "custom_header",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "s3-list-buckets", name: "List S3 Buckets", method: "GET", path: "/" },
    { id: "cloudwatch-metrics", name: "Get CloudWatch Metrics", method: "POST", path: "/" },
    { id: "cost-explorer", name: "Get Cost & Usage", method: "POST", path: "/" },
  ],
  requiredFields: ["baseUrl", "customHeaders"],
  documentationUrl: "https://docs.aws.amazon.com/general/latest/gr/rande.html",
};

const azureConnector: ConnectorTemplate = {
  id: "azure",
  name: "Microsoft Azure",
  description: "Connect to Azure Resource Manager, Azure DevOps, and Azure AD.",
  icon: "cloud",
  category: "cloud",
  protocol: "rest",
  baseUrl: "https://management.azure.com",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "list-subscriptions", name: "List Subscriptions", method: "GET", path: "/subscriptions", queryParams: { "api-version": "2022-12-01" } },
    { id: "list-resource-groups", name: "List Resource Groups", method: "GET", path: "/subscriptions/:subscriptionId/resourcegroups", queryParams: { "api-version": "2022-12-01" } },
    { id: "get-costs", name: "Get Cost Management", method: "POST", path: "/subscriptions/:subscriptionId/providers/Microsoft.CostManagement/query", queryParams: { "api-version": "2023-03-01" } },
  ],
  healthCheck: { endpoint: "/subscriptions?api-version=2022-12-01", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://learn.microsoft.com/en-us/rest/api/azure/",
};

// ─── Government (UAE) Connectors ─────────────────────────────────────────────

const uaePass: ConnectorTemplate = {
  id: "uae-pass",
  name: "UAE PASS",
  description: "UAE national digital identity — SSO authentication, document signing, and digital identity verification for government services.",
  icon: "shield-check",
  category: "government",
  protocol: "rest",
  baseUrl: "https://stg-id.uaepass.ae",
  authType: "oauth2_authorization_code",
  timeout: 30000,
  retry: { ...defaultRetry, maxRetries: 2 },
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "authorize", name: "Authorize", method: "GET", path: "/idp/oidc/authorize" },
    { id: "token", name: "Get Token", method: "POST", path: "/idp/oidc/token" },
    { id: "userinfo", name: "Get User Info", method: "GET", path: "/idp/oidc/userinfo" },
    { id: "sign-document", name: "Sign Document", method: "POST", path: "/dsp/api/v1/sign" },
    { id: "verify-signature", name: "Verify Signature", method: "POST", path: "/dsp/api/v1/verify" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "redirectUri"],
  documentationUrl: "https://docs.uaepass.ae/",
};

const tdraConnector: ConnectorTemplate = {
  id: "tdra",
  name: "TDRA (UAE Telecom & Digital Gov)",
  description: "UAE Telecommunications and Digital Government Regulatory Authority — identity verification, digital services, and e-government APIs.",
  icon: "radio-tower",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.tdra.gov.ae",
  authType: "api_key",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "verify-identity", name: "Verify Identity", method: "POST", path: "/v1/identity/verify" },
    { id: "get-services", name: "Get Digital Services", method: "GET", path: "/v1/services" },
    { id: "submit-request", name: "Submit Service Request", method: "POST", path: "/v1/requests" },
    { id: "get-status", name: "Get Request Status", method: "GET", path: "/v1/requests/:requestId/status" },
  ],
  requiredFields: ["baseUrl", "apiKey"],
  documentationUrl: "https://tdra.gov.ae/en/digital-services",
};

const mohreConnector: ConnectorTemplate = {
  id: "mohre",
  name: "MOHRE (Ministry of Human Resources)",
  description: "UAE Ministry of Human Resources & Emiratisation — work permits, labor approvals, contract management, and Emiratisation compliance.",
  icon: "briefcase",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.mohre.gov.ae",
  authType: "oauth2_client_credentials",
  timeout: 45000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-work-permits", name: "Get Work Permits", method: "GET", path: "/v1/work-permits" },
    { id: "submit-work-permit", name: "Submit Work Permit Application", method: "POST", path: "/v1/work-permits" },
    { id: "get-labor-contracts", name: "Get Labor Contracts", method: "GET", path: "/v1/contracts" },
    { id: "verify-employee", name: "Verify Employee Status", method: "GET", path: "/v1/employees/:emiratesId/verify" },
    { id: "get-emiratisation-quota", name: "Get Emiratisation Quota", method: "GET", path: "/v1/emiratisation/quota" },
    { id: "submit-emiratisation-report", name: "Submit Emiratisation Report", method: "POST", path: "/v1/emiratisation/reports" },
  ],
  healthCheck: { endpoint: "/health", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.mohre.gov.ae/en/services.aspx",
};

const icpConnector: ConnectorTemplate = {
  id: "icp-uae",
  name: "ICP (Federal Authority for Identity)",
  description: "UAE Federal Authority for Identity, Citizenship, Customs & Port Security — Emirates ID verification, visa services, and residency management.",
  icon: "id-card",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.icp.gov.ae",
  authType: "oauth2_client_credentials",
  timeout: 45000,
  retry: { ...defaultRetry, maxRetries: 2 },
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "verify-emirates-id", name: "Verify Emirates ID", method: "POST", path: "/v1/identity/verify" },
    { id: "get-visa-status", name: "Get Visa Status", method: "GET", path: "/v1/visa/:visaNumber/status" },
    { id: "get-residency-info", name: "Get Residency Info", method: "GET", path: "/v1/residency/:emiratesId" },
    { id: "submit-visa-application", name: "Submit Visa Application", method: "POST", path: "/v1/visa/applications" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://icp.gov.ae/en/services/",
};

const adgmConnector: ConnectorTemplate = {
  id: "adgm",
  name: "ADGM (Abu Dhabi Global Market)",
  description: "Abu Dhabi Global Market financial free zone — company registration, licensing, regulatory filings, and KYC verification.",
  icon: "landmark",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.adgm.com",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "search-entities", name: "Search Registered Entities", method: "GET", path: "/v1/entities", queryParams: { "status": "active" } },
    { id: "get-entity", name: "Get Entity Details", method: "GET", path: "/v1/entities/:entityId" },
    { id: "submit-filing", name: "Submit Regulatory Filing", method: "POST", path: "/v1/filings" },
    { id: "get-licenses", name: "Get Licenses", method: "GET", path: "/v1/licenses" },
    { id: "kyc-check", name: "KYC Verification", method: "POST", path: "/v1/kyc/verify" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.adgm.com/operating-in-adgm/registration-authority",
};

const difcConnector: ConnectorTemplate = {
  id: "difc",
  name: "DIFC (Dubai International Financial Centre)",
  description: "DIFC — company registration, DFSA regulatory reporting, and financial services licensing.",
  icon: "landmark",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.difc.ae",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-companies", name: "Get Registered Companies", method: "GET", path: "/v1/companies" },
    { id: "get-company", name: "Get Company Details", method: "GET", path: "/v1/companies/:companyId" },
    { id: "submit-report", name: "Submit Regulatory Report", method: "POST", path: "/v1/regulatory/reports" },
    { id: "get-licenses", name: "Get Active Licenses", method: "GET", path: "/v1/licenses" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.difc.ae/business/registering-a-company/",
};

const dhaConnector: ConnectorTemplate = {
  id: "dha",
  name: "DHA (Dubai Health Authority)",
  description: "Dubai Health Authority — healthcare licensing, facility permits, practitioner verification, and health data exchange.",
  icon: "heart-pulse",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.dha.gov.ae",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "verify-practitioner", name: "Verify Healthcare Practitioner", method: "GET", path: "/v1/practitioners/:licenseNo/verify" },
    { id: "get-facilities", name: "Get Licensed Facilities", method: "GET", path: "/v1/facilities" },
    { id: "submit-license-app", name: "Submit License Application", method: "POST", path: "/v1/licenses/applications" },
    { id: "get-health-data", name: "Get Health Data Exchange", method: "GET", path: "/v1/nabidh/records" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.dha.gov.ae/en/e-services",
};

const smartDubaiConnector: ConnectorTemplate = {
  id: "smart-dubai",
  name: "Smart Dubai Platform",
  description: "Smart Dubai — open data, city services, blockchain-based transactions, and shared government services.",
  icon: "building-2",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.smartdubai.ae",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-open-data", name: "Get Open Data Sets", method: "GET", path: "/v1/datasets" },
    { id: "search-services", name: "Search City Services", method: "GET", path: "/v1/services" },
    { id: "submit-service-request", name: "Submit Service Request", method: "POST", path: "/v1/requests" },
    { id: "get-blockchain-tx", name: "Get Blockchain Transactions", method: "GET", path: "/v1/blockchain/transactions" },
    { id: "verify-document", name: "Verify Document (DubaiDocs)", method: "POST", path: "/v1/documents/verify" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.digitaldubai.ae/",
};

const tameenConnector: ConnectorTemplate = {
  id: "tameen",
  name: "Tameen (UAE Insurance Platform)",
  description: "UAE unified insurance platform — policy verification, claims management, and vehicle insurance integration.",
  icon: "shield",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.tameen.ae",
  authType: "api_key",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "verify-policy", name: "Verify Insurance Policy", method: "GET", path: "/v1/policies/:policyNumber/verify" },
    { id: "get-claims", name: "Get Claims", method: "GET", path: "/v1/claims" },
    { id: "submit-claim", name: "Submit Insurance Claim", method: "POST", path: "/v1/claims" },
    { id: "get-vehicle-insurance", name: "Get Vehicle Insurance", method: "GET", path: "/v1/vehicle/:plateNumber/insurance" },
  ],
  requiredFields: ["baseUrl", "apiKey"],
};

const federalTaxConnector: ConnectorTemplate = {
  id: "uae-fta",
  name: "FTA (Federal Tax Authority)",
  description: "UAE Federal Tax Authority — VAT returns, corporate tax filing, excise tax, and tax registration verification.",
  icon: "receipt",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.tax.gov.ae",
  authType: "oauth2_client_credentials",
  timeout: 45000,
  retry: { ...defaultRetry, maxRetries: 2 },
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "verify-trn", name: "Verify Tax Registration (TRN)", method: "GET", path: "/v1/trn/:trnNumber/verify" },
    { id: "submit-vat-return", name: "Submit VAT Return", method: "POST", path: "/v1/vat/returns" },
    { id: "get-vat-returns", name: "Get VAT Returns", method: "GET", path: "/v1/vat/returns" },
    { id: "submit-ct-return", name: "Submit Corporate Tax Return", method: "POST", path: "/v1/corporate-tax/returns" },
    { id: "get-tax-certificates", name: "Get Tax Certificates", method: "GET", path: "/v1/certificates" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://tax.gov.ae/en/services.aspx",
};

const dubaiCustomsConnector: ConnectorTemplate = {
  id: "dubai-customs",
  name: "Dubai Customs (Mirsal)",
  description: "Dubai Customs Mirsal system — customs declarations, HS code lookups, duty calculations, and cargo tracking.",
  icon: "package",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.dubaicustoms.gov.ae",
  authType: "oauth2_client_credentials",
  timeout: 45000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "submit-declaration", name: "Submit Customs Declaration", method: "POST", path: "/v1/declarations" },
    { id: "get-declaration", name: "Get Declaration Status", method: "GET", path: "/v1/declarations/:declarationId" },
    { id: "lookup-hs-code", name: "HS Code Lookup", method: "GET", path: "/v1/tariff/hs-codes", queryParams: { "q": "{{query}}" } },
    { id: "calculate-duty", name: "Calculate Import Duty", method: "POST", path: "/v1/tariff/calculate" },
    { id: "track-cargo", name: "Track Cargo", method: "GET", path: "/v1/cargo/:trackingNumber" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.dubaicustoms.gov.ae/en/eservices",
};

const abuDhabiDigitalConnector: ConnectorTemplate = {
  id: "tamm-ad",
  name: "TAMM (Abu Dhabi Government)",
  description: "Abu Dhabi unified government services platform — permits, licenses, NOCs, and e-government transactions.",
  icon: "building",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.tamm.abudhabi.ae",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "search-services", name: "Search Government Services", method: "GET", path: "/v1/services" },
    { id: "submit-application", name: "Submit Application", method: "POST", path: "/v1/applications" },
    { id: "get-application-status", name: "Get Application Status", method: "GET", path: "/v1/applications/:applicationId" },
    { id: "get-permits", name: "Get Permits & Licenses", method: "GET", path: "/v1/permits" },
    { id: "get-nocs", name: "Get NOCs", method: "GET", path: "/v1/nocs" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.tamm.abudhabi/",
};

// ─── Government (International) Connectors ───────────────────────────────────

const saudiNafathConnector: ConnectorTemplate = {
  id: "saudi-nafath",
  name: "Nafath (Saudi Digital Identity)",
  description: "Saudi Arabia national digital identity authentication — SSO and identity verification for government services.",
  icon: "shield-check",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.nafath.sa",
  authType: "oauth2_authorization_code",
  timeout: 30000,
  retry: { ...defaultRetry, maxRetries: 2 },
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "initiate-auth", name: "Initiate Authentication", method: "POST", path: "/v1/auth/initiate" },
    { id: "verify-auth", name: "Verify Authentication", method: "POST", path: "/v1/auth/verify" },
    { id: "get-user-info", name: "Get User Info", method: "GET", path: "/v1/user/info" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "redirectUri"],
  documentationUrl: "https://nafath.sa/en",
};

const saudiBahrainGateway: ConnectorTemplate = {
  id: "bahrain-egov",
  name: "Bahrain eGovernment Gateway",
  description: "Kingdom of Bahrain electronic government — national gateway for eServices, ePayments, and company registration.",
  icon: "landmark",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.bahrain.bh",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-services", name: "Get eServices", method: "GET", path: "/v1/services" },
    { id: "get-company-registry", name: "Get Company Registry", method: "GET", path: "/v1/commerce/companies" },
    { id: "submit-payment", name: "Submit ePayment", method: "POST", path: "/v1/payments" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://www.bahrain.bh/",
};

const omanDigitalConnector: ConnectorTemplate = {
  id: "oman-ita",
  name: "Oman ITA (Digital Gov)",
  description: "Oman Information Technology Authority — eGovernment services, digital signatures, and PKI infrastructure.",
  icon: "landmark",
  category: "government",
  protocol: "rest",
  baseUrl: "https://api.ita.gov.om",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-services", name: "Get eGovernment Services", method: "GET", path: "/v1/services" },
    { id: "verify-signature", name: "Verify Digital Signature", method: "POST", path: "/v1/pki/verify" },
    { id: "submit-request", name: "Submit Service Request", method: "POST", path: "/v1/requests" },
  ],
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
};

// ─── Procurement & Financial Connectors ──────────────────────────────────────

const aribaProcurement: ConnectorTemplate = {
  id: "sap-ariba",
  name: "SAP Ariba (Procurement)",
  description: "SAP Ariba procurement network — sourcing, contracts, purchase orders, invoices, and supplier management.",
  icon: "shopping-cart",
  category: "erp",
  protocol: "rest",
  baseUrl: "https://openapi.ariba.com/api",
  authType: "oauth2_client_credentials",
  timeout: 45000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-rfx-events", name: "Get RFx Events", method: "GET", path: "/sourcing/v1/rfxevents" },
    { id: "get-contracts", name: "Get Contracts", method: "GET", path: "/contractworkspace/v1/contracts" },
    { id: "get-purchase-orders", name: "Get Purchase Orders", method: "GET", path: "/procurement/v3/purchaseOrders" },
    { id: "get-invoices", name: "Get Invoices", method: "GET", path: "/invoice/v1/invoices" },
    { id: "get-suppliers", name: "Get Suppliers", method: "GET", path: "/supplier/v2/suppliers" },
    { id: "create-purchase-req", name: "Create Purchase Requisition", method: "POST", path: "/procurement/v3/purchaseRequisitions" },
  ],
  healthCheck: { endpoint: "/sourcing/v1/rfxevents?$top=1", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://developer.sap.com/topics/ariba-api-all.html",
};

const coupaProcurement: ConnectorTemplate = {
  id: "coupa",
  name: "Coupa (Procurement & BSM)",
  description: "Coupa Business Spend Management — requisitions, POs, invoices, contracts, and spend analytics.",
  icon: "shopping-cart",
  category: "erp",
  protocol: "rest",
  baseUrl: "https://your-instance.coupahost.com/api",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-requisitions", name: "Get Requisitions", method: "GET", path: "/requisitions" },
    { id: "get-purchase-orders", name: "Get Purchase Orders", method: "GET", path: "/purchase_orders" },
    { id: "get-invoices", name: "Get Invoices", method: "GET", path: "/invoices" },
    { id: "get-suppliers", name: "Get Suppliers", method: "GET", path: "/suppliers" },
    { id: "create-requisition", name: "Create Requisition", method: "POST", path: "/requisitions" },
  ],
  healthCheck: { endpoint: "/requisitions?limit=1", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["baseUrl", "clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://compass.coupa.com/en-us/products/core-platform/integration-playbooks-and-resources/api-resources",
};

// ─── Security & Compliance Connectors ────────────────────────────────────────

const qualysConnector: ConnectorTemplate = {
  id: "qualys",
  name: "Qualys (Vulnerability Management)",
  description: "Qualys cloud security — vulnerability scanning, compliance monitoring, web application scanning, and asset management.",
  icon: "scan",
  category: "security",
  protocol: "rest",
  baseUrl: "https://qualysapi.qualys.com/api/2.0",
  authType: "basic",
  timeout: 60000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "list-hosts", name: "List Hosts", method: "GET", path: "/fo/asset/host/", queryParams: { "action": "list" } },
    { id: "launch-scan", name: "Launch Vulnerability Scan", method: "POST", path: "/fo/scan/" },
    { id: "get-scan-results", name: "Get Scan Results", method: "GET", path: "/fo/scan/", queryParams: { "action": "list" } },
    { id: "get-compliance", name: "Get Compliance Posture", method: "GET", path: "/fo/compliance/posture/info/" },
  ],
  requiredFields: ["baseUrl", "username", "password"],
  documentationUrl: "https://www.qualys.com/docs/qualys-api-vmpc-user-guide.pdf",
};

const splunkConnector: ConnectorTemplate = {
  id: "splunk",
  name: "Splunk (SIEM & Observability)",
  description: "Splunk Enterprise / Cloud — log search, SIEM alerts, dashboards, and security event correlation.",
  icon: "search",
  category: "security",
  protocol: "rest",
  baseUrl: "https://your-splunk.splunkcloud.com:8089",
  authType: "bearer",
  timeout: 60000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "search", name: "Run Search", method: "POST", path: "/services/search/jobs" },
    { id: "get-results", name: "Get Search Results", method: "GET", path: "/services/search/jobs/:searchId/results" },
    { id: "get-alerts", name: "Get Fired Alerts", method: "GET", path: "/services/alerts/fired_alerts" },
    { id: "submit-event", name: "Submit Event (HEC)", method: "POST", path: "/services/collector/event" },
  ],
  requiredFields: ["baseUrl", "bearerToken"],
  documentationUrl: "https://docs.splunk.com/Documentation/Splunk/latest/RESTREF/RESTprolog",
};

// ─── DevOps Connectors ──────────────────────────────────────────────────────

const githubConnector: ConnectorTemplate = {
  id: "github",
  name: "GitHub",
  description: "Connect to GitHub for repos, issues, PRs, actions, and project management.",
  icon: "github",
  category: "devops",
  protocol: "rest",
  baseUrl: "https://api.github.com",
  authType: "bearer",
  defaultHeaders: { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "list-repos", name: "List Repositories", method: "GET", path: "/orgs/:org/repos" },
    { id: "get-repo", name: "Get Repository", method: "GET", path: "/repos/:owner/:repo" },
    { id: "list-issues", name: "List Issues", method: "GET", path: "/repos/:owner/:repo/issues" },
    { id: "create-issue", name: "Create Issue", method: "POST", path: "/repos/:owner/:repo/issues" },
    { id: "list-prs", name: "List Pull Requests", method: "GET", path: "/repos/:owner/:repo/pulls" },
    { id: "list-workflows", name: "List Workflows", method: "GET", path: "/repos/:owner/:repo/actions/workflows" },
    { id: "trigger-workflow", name: "Trigger Workflow", method: "POST", path: "/repos/:owner/:repo/actions/workflows/:workflowId/dispatches" },
  ],
  healthCheck: { endpoint: "/rate_limit", method: "GET", expectedStatus: 200, intervalMs: 120000 },
  requiredFields: ["bearerToken"],
  documentationUrl: "https://docs.github.com/en/rest",
};

const azureDevOps: ConnectorTemplate = {
  id: "azure-devops",
  name: "Azure DevOps",
  description: "Connect to Azure DevOps for repos, work items, pipelines, and boards.",
  icon: "git-branch",
  category: "devops",
  protocol: "rest",
  baseUrl: "https://dev.azure.com/:organization",
  authType: "basic",
  defaultHeaders: { "Accept": "application/json" },
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "list-projects", name: "List Projects", method: "GET", path: "/_apis/projects", queryParams: { "api-version": "7.0" } },
    { id: "get-work-items", name: "Get Work Items", method: "POST", path: "/:project/_apis/wit/wiql", queryParams: { "api-version": "7.0" } },
    { id: "list-pipelines", name: "List Pipelines", method: "GET", path: "/:project/_apis/pipelines", queryParams: { "api-version": "7.0" } },
    { id: "run-pipeline", name: "Run Pipeline", method: "POST", path: "/:project/_apis/pipelines/:pipelineId/runs", queryParams: { "api-version": "7.0" } },
  ],
  healthCheck: { endpoint: "/_apis/projects?$top=1&api-version=7.0", method: "GET", expectedStatus: 200, intervalMs: 120000 },
  requiredFields: ["baseUrl", "username", "password"],
  documentationUrl: "https://learn.microsoft.com/en-us/rest/api/azure/devops/",
};

// ─── Communication Connectors ────────────────────────────────────────────────

const slackConnector: ConnectorTemplate = {
  id: "slack",
  name: "Slack",
  description: "Connect to Slack for messaging, channels, and workflow automation.",
  icon: "message-square",
  category: "communication",
  protocol: "rest",
  baseUrl: "https://slack.com/api",
  authType: "bearer",
  timeout: 15000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "post-message", name: "Post Message", method: "POST", path: "/chat.postMessage" },
    { id: "list-channels", name: "List Channels", method: "GET", path: "/conversations.list" },
    { id: "list-users", name: "List Users", method: "GET", path: "/users.list" },
    { id: "upload-file", name: "Upload File", method: "POST", path: "/files.upload" },
  ],
  healthCheck: { endpoint: "/auth.test", method: "POST", expectedStatus: 200, intervalMs: 120000 },
  requiredFields: ["bearerToken"],
  documentationUrl: "https://api.slack.com/methods",
};

const teamsConnector: ConnectorTemplate = {
  id: "microsoft-teams",
  name: "Microsoft Teams",
  description: "Connect to Microsoft Teams for messaging, channels, and meeting management.",
  icon: "video",
  category: "communication",
  protocol: "rest",
  baseUrl: "https://graph.microsoft.com/v1.0",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "list-teams", name: "List Teams", method: "GET", path: "/teams" },
    { id: "list-channels", name: "List Channels", method: "GET", path: "/teams/:teamId/channels" },
    { id: "send-message", name: "Send Channel Message", method: "POST", path: "/teams/:teamId/channels/:channelId/messages" },
    { id: "create-meeting", name: "Create Meeting", method: "POST", path: "/users/:userId/onlineMeetings" },
  ],
  healthCheck: { endpoint: "/me", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview",
};

const exchangeOnlineConnector: ConnectorTemplate = {
  id: "microsoft-exchange-online",
  name: "Microsoft Exchange Online",
  description: "Connect Outlook / Exchange Online mailboxes for inbox triage, mail intelligence, and governed email actions.",
  icon: "mail",
  category: "communication",
  protocol: "rest",
  baseUrl: "https://graph.microsoft.com/v1.0",
  authType: "oauth2_authorization_code",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "get-profile", name: "Get Mail Profile", method: "GET", path: "/me" },
    {
      id: "list-inbox-messages",
      name: "List Inbox Messages",
      method: "GET",
      path: "/me/mailFolders/inbox/messages",
      queryParams: {
        "$top": "8",
        "$select": "id,subject,bodyPreview,importance,receivedDateTime,from,isRead,webLink",
        "$orderby": "receivedDateTime desc",
      },
    },
    {
      id: "get-message",
      name: "Get Message",
      method: "GET",
      path: "/me/messages/:messageId",
      queryParams: {
        "$select": "id,subject,bodyPreview,importance,receivedDateTime,from,isRead,body,webLink",
      },
    },
    { id: "send-mail", name: "Send Mail", method: "POST", path: "/me/sendMail" },
  ],
  healthCheck: { endpoint: "/me", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["clientId", "clientSecret", "authorizationUrl", "tokenUrl", "redirectUri"],
  documentationUrl: "https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview",
};

// ─── Power BI / Analytics ────────────────────────────────────────────────────

const powerBI: ConnectorTemplate = {
  id: "power-bi",
  name: "Microsoft Power BI",
  description: "Connect to Power BI for dashboards, datasets, and report embedding.",
  icon: "bar-chart-3",
  category: "analytics",
  protocol: "rest",
  baseUrl: "https://api.powerbi.com/v1.0/myorg",
  authType: "oauth2_client_credentials",
  timeout: 30000,
  retry: defaultRetry,
  circuitBreaker: defaultCircuitBreaker,
  endpoints: [
    { id: "list-dashboards", name: "List Dashboards", method: "GET", path: "/dashboards" },
    { id: "list-datasets", name: "List Datasets", method: "GET", path: "/datasets" },
    { id: "list-reports", name: "List Reports", method: "GET", path: "/reports" },
    { id: "refresh-dataset", name: "Refresh Dataset", method: "POST", path: "/datasets/:datasetId/refreshes" },
    { id: "embed-token", name: "Generate Embed Token", method: "POST", path: "/reports/:reportId/GenerateToken" },
  ],
  healthCheck: { endpoint: "/dashboards", method: "GET", expectedStatus: 200, intervalMs: 300000 },
  requiredFields: ["clientId", "clientSecret", "tokenUrl"],
  documentationUrl: "https://learn.microsoft.com/en-us/rest/api/power-bi/",
};

// ─── Template Registry ──────────────────────────────────────────────────────

export const CONNECTOR_TEMPLATES: ConnectorTemplate[] = [
  // ERP
  sapErp,
  oracleEbs,
  dynamics365,
  aribaProcurement,
  coupaProcurement,
  // ITSM
  serviceNow,
  jiraServiceManagement,
  // CRM
  salesforce,
  hubspot,
  // HR
  workday,
  sapSuccessFactors,
  // Cloud
  awsConnector,
  azureConnector,
  // Government (UAE)
  uaePass,
  tdraConnector,
  mohreConnector,
  icpConnector,
  adgmConnector,
  difcConnector,
  dhaConnector,
  smartDubaiConnector,
  tameenConnector,
  federalTaxConnector,
  dubaiCustomsConnector,
  abuDhabiDigitalConnector,
  // Government (GCC)
  saudiNafathConnector,
  saudiBahrainGateway,
  omanDigitalConnector,
  // DevOps
  githubConnector,
  azureDevOps,
  // Communication
  slackConnector,
  teamsConnector,
  exchangeOnlineConnector,
  // Analytics
  powerBI,
  // Security & Compliance
  qualysConnector,
  splunkConnector,
];

export const CONNECTOR_CATEGORIES = [
  { id: "erp", name: "Enterprise Resource Planning (ERP)", icon: "database", description: "SAP, Oracle, Dynamics, Ariba, Coupa" },
  { id: "itsm", name: "IT Service Management (ITSM)", icon: "ticket", description: "ServiceNow, Jira SM" },
  { id: "crm", name: "Customer Relationship Management (CRM)", icon: "users", description: "Salesforce, HubSpot" },
  { id: "hr", name: "Human Capital Management (HR)", icon: "user-cog", description: "Workday, SuccessFactors" },
  { id: "cloud", name: "Cloud Platforms", icon: "cloud", description: "AWS, Azure, GCP" },
  { id: "government", name: "Government Services", icon: "shield-check", description: "UAE PASS, TDRA, MOHRE, ICP, ADGM, DIFC, DHA, FTA, Smart Dubai, TAMM, Nafath" },
  { id: "devops", name: "DevOps & CI/CD", icon: "git-branch", description: "GitHub, Azure DevOps" },
  { id: "communication", name: "Communication", icon: "message-square", description: "Slack, Teams, Exchange" },
  { id: "analytics", name: "Analytics & BI", icon: "bar-chart-3", description: "Power BI, Tableau" },
  { id: "security", name: "Security & Compliance", icon: "scan", description: "Qualys, Splunk" },
  { id: "custom", name: "Custom Connector", icon: "plug", description: "User-defined API" },
];

export function getTemplateById(id: string): ConnectorTemplate | undefined {
  return CONNECTOR_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: string): ConnectorTemplate[] {
  return CONNECTOR_TEMPLATES.filter(t => t.category === category);
}
