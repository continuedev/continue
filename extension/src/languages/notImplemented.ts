export function notImplemented(
  propertyName: string,
  langauge: string
): (...args: any[]) => never {
  return (...args: any[]) => {
    throw new Error(
      `Property ${propertyName} not implemented for language ${langauge}.`
    );
  };
}
