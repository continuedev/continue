/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
/**
 *
 * @export
 * @interface ListAssistantFullSlugs429Response
 */
export interface ListAssistantFullSlugs429Response {
  /**
   *
   * @type {string}
   * @memberof ListAssistantFullSlugs429Response
   */
  message?: string;
}

/**
 * Check if a given object implements the ListAssistantFullSlugs429Response interface.
 */
export function instanceOfListAssistantFullSlugs429Response(
  value: object,
): value is ListAssistantFullSlugs429Response {
  return true;
}

export function ListAssistantFullSlugs429ResponseFromJSON(
  json: any,
): ListAssistantFullSlugs429Response {
  return ListAssistantFullSlugs429ResponseFromJSONTyped(json, false);
}

export function ListAssistantFullSlugs429ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): ListAssistantFullSlugs429Response {
  if (json == null) {
    return json;
  }
  return {
    message: json["message"] == null ? undefined : json["message"],
  };
}

export function ListAssistantFullSlugs429ResponseToJSON(
  json: any,
): ListAssistantFullSlugs429Response {
  return ListAssistantFullSlugs429ResponseToJSONTyped(json, false);
}

export function ListAssistantFullSlugs429ResponseToJSONTyped(
  value?: ListAssistantFullSlugs429Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    message: value["message"],
  };
}
