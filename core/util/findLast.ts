export function findLastIndex(
  arr: any[],
  criterion: (item: any) => boolean,
): number {
  let lastIndex = -1;

  for (let i = arr.length - 1; i >= 0; i--) {
    if (criterion(arr[i])) {
      lastIndex = i;
      break;
    }
  }
  return lastIndex;
}
