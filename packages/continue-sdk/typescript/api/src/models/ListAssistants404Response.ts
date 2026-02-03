/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface ListAssistants404Response
 */
export interface ListAssistants404Response {
  /**
   *
   * @type {string}
   * @memberof ListAssistants404Response
   */
  message?: string;
}

/**
 * Check if a given object implements the ListAssistants404Response interface.
 */
export function instanceOfListAssistants404Response(
  value: object,
): value is ListAssistants404Response {
  return true;
}

export function ListAssistants404ResponseFromJSON(
  json: any,
): ListAssistants404Response {
  return ListAssistants404ResponseFromJSONTyped(json, false);
}

export function ListAssistants404ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): ListAssistants404Response {
  if (json == null) {
    return json;
  }
  return {
    message: json["message"] == null ? undefined : json["message"],
  };
}

export function ListAssistants404ResponseToJSON(
  json: any,
): ListAssistants404Response {
  return ListAssistants404ResponseToJSONTyped(json, false);
}

export function ListAssistants404ResponseToJSONTyped(
  value?: ListAssistants404Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    message: value["message"],
  };
}
