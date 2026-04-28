/**
 * Shared · Services
 *
 * Cross-cutting service adapters used by all domain modules.
 */

export {
  httpJson,
  get,
  post,
  put,
  patch,
  del,
  httpRaw,
  apiRequest,
  type HttpMethod,
  type HttpError,
  type RequestOptions,
} from "./httpClient";
