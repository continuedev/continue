/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface GetModelsAddOnCheckoutUrl500Response
 */
export interface GetModelsAddOnCheckoutUrl500Response {
  /**
   *
   * @type {string}
   * @memberof GetModelsAddOnCheckoutUrl500Response
   */
  message?: string;
}

/**
 * Check if a given object implements the GetModelsAddOnCheckoutUrl500Response interface.
 */
export function instanceOfGetModelsAddOnCheckoutUrl500Response(
  value: object,
): value is GetModelsAddOnCheckoutUrl500Response {
  return true;
}

export function GetModelsAddOnCheckoutUrl500ResponseFromJSON(
  json: any,
): GetModelsAddOnCheckoutUrl500Response {
  return GetModelsAddOnCheckoutUrl500ResponseFromJSONTyped(json, false);
}

export function GetModelsAddOnCheckoutUrl500ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetModelsAddOnCheckoutUrl500Response {
  if (json == null) {
    return json;
  }
  return {
    message: json["message"] == null ? undefined : json["message"],
  };
}

export function GetModelsAddOnCheckoutUrl500ResponseToJSON(
  json: any,
): GetModelsAddOnCheckoutUrl500Response {
  return GetModelsAddOnCheckoutUrl500ResponseToJSONTyped(json, false);
}

export function GetModelsAddOnCheckoutUrl500ResponseToJSONTyped(
  value?: GetModelsAddOnCheckoutUrl500Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    message: value["message"],
  };
}
