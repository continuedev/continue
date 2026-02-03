/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface ListAssistants401Response
 */
export interface ListAssistants401Response {
  /**
   *
   * @type {string}
   * @memberof ListAssistants401Response
   */
  message?: string;
}

/**
 * Check if a given object implements the ListAssistants401Response interface.
 */
export function instanceOfListAssistants401Response(
  value: object,
): value is ListAssistants401Response {
  return true;
}

export function ListAssistants401ResponseFromJSON(
  json: any,
): ListAssistants401Response {
  return ListAssistants401ResponseFromJSONTyped(json, false);
}

export function ListAssistants401ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): ListAssistants401Response {
  if (json == null) {
    return json;
  }
  return {
    message: json["message"] == null ? undefined : json["message"],
  };
}

export function ListAssistants401ResponseToJSON(
  json: any,
): ListAssistants401Response {
  return ListAssistants401ResponseToJSONTyped(json, false);
}

export function ListAssistants401ResponseToJSONTyped(
  value?: ListAssistants401Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    message: value["message"],
  };
}
