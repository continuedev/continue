/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface GetPolicy200Response
 */
export interface GetPolicy200Response {
  /**
   * Organization policy configuration
   * @type {object}
   * @memberof GetPolicy200Response
   */
  policy?: object | null;
  /**
   * Slug of the organization that has the policy
   * @type {string}
   * @memberof GetPolicy200Response
   */
  orgSlug?: string | null;
}

/**
 * Check if a given object implements the GetPolicy200Response interface.
 */
export function instanceOfGetPolicy200Response(
  value: object,
): value is GetPolicy200Response {
  return true;
}

export function GetPolicy200ResponseFromJSON(json: any): GetPolicy200Response {
  return GetPolicy200ResponseFromJSONTyped(json, false);
}

export function GetPolicy200ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetPolicy200Response {
  if (json == null) {
    return json;
  }
  return {
    policy: json["policy"] == null ? undefined : json["policy"],
    orgSlug: json["orgSlug"] == null ? undefined : json["orgSlug"],
  };
}

export function GetPolicy200ResponseToJSON(json: any): GetPolicy200Response {
  return GetPolicy200ResponseToJSONTyped(json, false);
}

export function GetPolicy200ResponseToJSONTyped(
  value?: GetPolicy200Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    policy: value["policy"],
    orgSlug: value["orgSlug"],
  };
}
