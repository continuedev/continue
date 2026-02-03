/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface SyncSecretsRequest
 */
export interface SyncSecretsRequest {
  /**
   * Array of Fully Qualified Secret Names to resolve
   * @type {Array<object>}
   * @memberof SyncSecretsRequest
   */
  fqsns: Array<object>;
  /**
   * Organization ID to scope secret resolution to
   * @type {string}
   * @memberof SyncSecretsRequest
   */
  orgScopeId?: string | null;
  /**
   * Organization slug to scope secret resolution to
   * @type {string}
   * @memberof SyncSecretsRequest
   */
  orgScopeSlug?: string | null;
}

/**
 * Check if a given object implements the SyncSecretsRequest interface.
 */
export function instanceOfSyncSecretsRequest(
  value: object,
): value is SyncSecretsRequest {
  if (!("fqsns" in value) || value["fqsns"] === undefined) return false;
  return true;
}

export function SyncSecretsRequestFromJSON(json: any): SyncSecretsRequest {
  return SyncSecretsRequestFromJSONTyped(json, false);
}

export function SyncSecretsRequestFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): SyncSecretsRequest {
  if (json == null) {
    return json;
  }
  return {
    fqsns: json["fqsns"],
    orgScopeId: json["orgScopeId"] == null ? undefined : json["orgScopeId"],
    orgScopeSlug:
      json["orgScopeSlug"] == null ? undefined : json["orgScopeSlug"],
  };
}

export function SyncSecretsRequestToJSON(json: any): SyncSecretsRequest {
  return SyncSecretsRequestToJSONTyped(json, false);
}

export function SyncSecretsRequestToJSONTyped(
  value?: SyncSecretsRequest | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    fqsns: value["fqsns"],
    orgScopeId: value["orgScopeId"],
    orgScopeSlug: value["orgScopeSlug"],
  };
}
