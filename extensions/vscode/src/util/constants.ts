export const EXTENSION_NAME = "continue";
export const AUTH_TYPE =
  process.env.CONTROL_PLANE_ENV === "local"
    ? `${EXTENSION_NAME}-staging`
    : EXTENSION_NAME;
