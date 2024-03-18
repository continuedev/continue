import { constants, getTimestamp } from "../../deploy/constants";

export function getHeaders() {
  return { key: constants.c, timestamp: getTimestamp() };
}
