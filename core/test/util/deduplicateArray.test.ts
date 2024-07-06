import { deduplicateArray } from "../../util";

describe("deduplicateArray", () => {
  it("should return an empty array when given an empty array", () => {
    const result = deduplicateArray([], (a, b) => a === b);
    expect(result).toEqual([]);
  });

  it("should return the same array when there are no duplicates", () => {
    const input = [1, 2, 3, 4, 5];
    const result = deduplicateArray(input, (a, b) => a === b);
    expect(result).toEqual(input);
  });

  it("should remove duplicates based on the equality function", () => {
    const input = [1, 2, 2, 3, 4, 4, 5];
    const result = deduplicateArray(input, (a, b) => a === b);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("should work with objects using custom equality function", () => {
    const input = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 1, name: "Alice" },
      { id: 3, name: "Charlie" },
    ];
    const result = deduplicateArray(input, (a, b) => a.id === b.id);
    expect(result).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ]);
  });

  it("should preserve the order of items", () => {
    const input = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    const result = deduplicateArray(input, (a, b) => a === b);
    expect(result).toEqual([3, 1, 4, 5, 9, 2, 6]);
  });

  it("should work with strings", () => {
    const input = ["apple", "banana", "apple", "cherry", "banana", "date"];
    const result = deduplicateArray(input, (a, b) => a === b);
    expect(result).toEqual(["apple", "banana", "cherry", "date"]);
  });

  it("should handle arrays with all duplicate elements", () => {
    const input = [1, 1, 1, 1, 1];
    const result = deduplicateArray(input, (a, b) => a === b);
    expect(result).toEqual([1]);
  });

  it("should work with custom equality function for complex objects", () => {
    const input = [
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];
    const result = deduplicateArray(
      input,
      (a, b) => a.x === b.x && a.y === b.y,
    );
    expect(result).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 4 },
    ]);
  });

  it("should handle large arrays efficiently", () => {
    const input = Array(10000)
      .fill(0)
      .map((_, i) => i % 100);
    const start = performance.now();
    const result = deduplicateArray(input, (a, b) => a === b);
    const end = performance.now();
    expect(result).toHaveLength(100);
    expect(end - start).toBeLessThan(1000); // Ensure it completes in less than 1 second
  });
});
