export function findLastIndex<T = any>(
  arr: T[],
  criterion: (item: T) => boolean,
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

export function findLast<T>(
  arr: T[],
  criterion: (item: T) => any,
): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (criterion(arr[i])) {
      return arr[i];
    }
  }
}
