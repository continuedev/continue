export const capitalizeFirstLetter = (val: string) => {
  if (val.length === 0) {
    return "";
  }
  return val[0].toUpperCase() + val.slice(1);
};
