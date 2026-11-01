/* eslint-disable max-classes-per-file */
import { env } from "../env.js";

import { logger } from "./logger.js";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown> | string;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
}

export interface ApiError extends Error {
  status: number;
  statusText: string;
  response?: string;
}

/**
 * Authentication error thrown when user is not authenticated
 */
export class AuthenticationRequiredError extends Error {
  constructor(
    message = "Not authenticated. Hub integration has been removed.",
  ) {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

/**
 * API error thrown when the request fails
 */
export class ApiRequestError extends Error implements ApiError {
  status: number;
  statusText: string;
  response?: string;

  constructor(status: number, statusText: string, response?: string) {
    const message = response
      ? `API request failed: ${status} ${statusText} - ${response}`
      : `API request failed: ${status} ${statusText}`;
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.statusText = statusText;
    this.response = response;
  }
}

/**
 * Make an API request to the Continue API.
 * Hub authentication has been removed - requests are made without auth headers.
 */
export async function makeAuthenticatedRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {} } = options;

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    requestOptions.body =
      typeof body === "string" ? body : JSON.stringify(body);
  }

  try {
    const url = new URL(endpoint, env.apiBase);
    logger.debug(`Making ${method} request to: ${url.toString()}`);

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`API request failed: ${response.status} ${errorText}`);
      throw new ApiRequestError(
        response.status,
        response.statusText,
        errorText,
      );
    }

    let data: T;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = (await response.text()) as T;
    }

    logger.debug(`API request successful: ${response.status}`);

    return {
      data,
      status: response.status,
      ok: response.ok,
    };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof ApiRequestError
    ) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Network/request error: ${errorMessage}`);
    throw new Error(`Request failed: ${errorMessage}`);
  }
}

/**
 * Convenience function for GET requests
 */
export async function get<T = any>(
  endpoint: string,
  headers?: Record<string, string>,
): Promise<ApiResponse<T>> {
  return makeAuthenticatedRequest<T>(endpoint, { method: "GET", headers });
}

/**
 * Convenience function for POST requests
 */
export async function post<T = any>(
  endpoint: string,
  body?: Record<string, unknown> | string,
  headers?: Record<string, string>,
): Promise<ApiResponse<T>> {
  return makeAuthenticatedRequest<T>(endpoint, {
    method: "POST",
    body,
    headers,
  });
}

/**
 * Convenience function for PUT requests
 */
export async function put<T = any>(
  endpoint: string,
  body?: Record<string, unknown> | string,
  headers?: Record<string, string>,
): Promise<ApiResponse<T>> {
  return makeAuthenticatedRequest<T>(endpoint, {
    method: "PUT",
    body,
    headers,
  });
}

/**
 * Convenience function for DELETE requests
 */
export async function del<T = any>(
  endpoint: string,
  headers?: Record<string, string>,
): Promise<ApiResponse<T>> {
  return makeAuthenticatedRequest<T>(endpoint, { method: "DELETE", headers });
}
