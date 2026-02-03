/* tslint:disable */
/* eslint-disable */
/* Documentation unavailable in air-gapped mode */

import { mapValues } from "../runtime";
import type { ListOrganizations200ResponseOrganizationsInner } from "./ListOrganizations200ResponseOrganizationsInner";
import {
  ListOrganizations200ResponseOrganizationsInnerFromJSON,
  ListOrganizations200ResponseOrganizationsInnerFromJSONTyped,
  ListOrganizations200ResponseOrganizationsInnerToJSON,
  ListOrganizations200ResponseOrganizationsInnerToJSONTyped,
} from "./ListOrganizations200ResponseOrganizationsInner";

/**
 *
 * @export
 * @interface ListOrganizations200Response
 */
export interface ListOrganizations200Response {
  /**
   *
   * @type {Array<ListOrganizations200ResponseOrganizationsInner>}
   * @memberof ListOrganizations200Response
   */
  organizations: Array<ListOrganizations200ResponseOrganizationsInner>;
}

/**
 * Check if a given object implements the ListOrganizations200Response interface.
 */
export function instanceOfListOrganizations200Response(
  value: object,
): value is ListOrganizations200Response {
  if (!("organizations" in value) || value["organizations"] === undefined)
    return false;
  return true;
}

export function ListOrganizations200ResponseFromJSON(
  json: any,
): ListOrganizations200Response {
  return ListOrganizations200ResponseFromJSONTyped(json, false);
}

export function ListOrganizations200ResponseFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): ListOrganizations200Response {
  if (json == null) {
    return json;
  }
  return {
    organizations: (json["organizations"] as Array<any>).map(
      ListOrganizations200ResponseOrganizationsInnerFromJSON,
    ),
  };
}

export function ListOrganizations200ResponseToJSON(
  json: any,
): ListOrganizations200Response {
  return ListOrganizations200ResponseToJSONTyped(json, false);
}

export function ListOrganizations200ResponseToJSONTyped(
  value?: ListOrganizations200Response | null,
  ignoreDiscriminator: boolean = false,
): any {
  if (value == null) {
    return value;
  }

  return {
    organizations: (value["organizations"] as Array<any>).map(
      ListOrganizations200ResponseOrganizationsInnerToJSON,
    ),
  };
}
