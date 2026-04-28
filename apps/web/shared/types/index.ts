/**
 * Shared · Types
 *
 * Cross-cutting TypeScript types used by multiple frontend modules.
 * Domain-specific types belong in `modules/<domain>/types/`.
 */

/** Pagination metadata returned by API list endpoints */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Paginated API response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** Standard API error shape */
export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, unknown>;
}

/** Select option used in dropdowns */
export interface SelectOption<V = string> {
  label: string;
  value: V;
  description?: string;
  disabled?: boolean;
}

/** Breadcrumb entry */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Sort descriptor */
export interface SortDescriptor {
  field: string;
  direction: SortDirection;
}
