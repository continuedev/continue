/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface GetAssistant404Response
 */
export interface GetAssistant404Response {
  /**
   *
   * @type {string}
   * @memberof GetAssistant404Response
   */
  message?: string;
}

/**
 * Check if a given object implements the GetAssistant404Response interface.
 */
export function instanceOfGetAssistant404Response(
  value: object,
): value is GetAssistant404Response {
  return true;
}

export function GetAssistant404ResponseFromJSON(
  json: any,
): GetAssistant404Response {
  return GetAssistant404ResponseFromJSONTyped(json, false);
}

export function GetAssistant404ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetAssistant404Response {
  if (json == null) {
    return json;
  }
  return {
    message: json["message"] == null ? undefined : json["message"],
  };
}

export function GetAssistant404ResponseToJSON(
  json: any,
): GetAssistant404Response {
  return GetAssistant404ResponseToJSONTyped(json, false);
}

export function GetAssistant404ResponseToJSONTyped(
  value?: GetAssistant404Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    message: value["message"],
  };
}
