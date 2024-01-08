function mergeSortAlgorithm(arr) {
  // If the length of the array is less than or equal to one, return the original array
  if (arr.length <= 1) {
    return arr;
  }

  // Find the middle index of the array
  const mid = Math.floor(arr.length / 2);

  // Split the array into two halves: left and right
  const left = arr.slice(0, mid);
  const right = arr.slice(mid);

  // Recursively sort the left and right arrays
  return merge(mergeSortAlgorithm(left), mergeSortAlgorithm(right));
}

function merge(left, right) {
  let result = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] < right[rightIndex]) {
      result.push(left[leftIndex]);
      leftIndex++;
    } else {
      result.push(right[rightIndex]);
      rightIndex++;
    }
  }
  return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}
