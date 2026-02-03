/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface GetAssistant403Response
 */
export interface GetAssistant403Response {
  /**
   *
   * @type {string}
   * @memberof GetAssistant403Response
   */
  message?: string;
}

/**
 * Check if a given object implements the GetAssistant403Response interface.
 */
export function instanceOfGetAssistant403Response(
  value: object,
): value is GetAssistant403Response {
  return true;
}

export function GetAssistant403ResponseFromJSON(
  json: any,
): GetAssistant403Response {
  return GetAssistant403ResponseFromJSONTyped(json, false);
}

export function GetAssistant403ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetAssistant403Response {
  if (json == null) {
    return json;
  }
  return {
    message: json["message"] == null ? undefined : json["message"],
  };
}

export function GetAssistant403ResponseToJSON(
  json: any,
): GetAssistant403Response {
  return GetAssistant403ResponseToJSONTyped(json, false);
}

export function GetAssistant403ResponseToJSONTyped(
  value?: GetAssistant403Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    message: value["message"],
  };
}
