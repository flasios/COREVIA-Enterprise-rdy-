export const DOCUMENT_CATEGORIES = {
  strategic: { label: "Strategic", description: "Strategic planning and vision documents" },
  operational: { label: "Operational", description: "Day-to-day operational documents" },
  technical: { label: "Technical", description: "Technical specifications and documentation" },
  regulatory: { label: "Regulatory", description: "Compliance and regulatory documents" },
  research: { label: "Research", description: "Research papers and analysis" },
  business: { label: "Business", description: "Business cases and proposals" },
  financial: { label: "Financial", description: "Financial reports and budgets" },
  legal: { label: "Legal", description: "Legal documents and contracts" },
  hr: { label: "Human Resources", description: "HR policies and procedures" },
  it: { label: "Information Technology", description: "IT systems and infrastructure" },
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;

export const DOCUMENT_CATEGORY_LIST = Object.entries(DOCUMENT_CATEGORIES).map(([key, value]) => ({
  id: key as DocumentCategory,
  ...value,
}));