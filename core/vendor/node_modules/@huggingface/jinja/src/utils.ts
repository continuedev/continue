/**
 * Function that mimics Python's array slicing.
 * @param array The array to slice.
 * @param start The start index of the slice. Defaults to 0.
 * @param stop The last index of the slice. Defaults to `array.length`.
 * @param step The step value of the slice. Defaults to 1.
 * @returns The sliced array.
 */
export function slice<T>(array: T[], start?: number, stop?: number, step = 1): T[] {
	const direction = Math.sign(step);

	if (direction >= 0) {
		start = (start ??= 0) < 0 ? Math.max(array.length + start, 0) : Math.min(start, array.length);
		stop = (stop ??= array.length) < 0 ? Math.max(array.length + stop, 0) : Math.min(stop, array.length);
	} else {
		start = (start ??= array.length - 1) < 0 ? Math.max(array.length + start, -1) : Math.min(start, array.length - 1);
		stop = (stop ??= -1) < -1 ? Math.max(array.length + stop, -1) : Math.min(stop, array.length - 1);
	}

	const result: T[] = [];
	for (let i = start; direction * i < direction * stop; i += step) {
		result.push(array[i]);
	}
	return result;
}
