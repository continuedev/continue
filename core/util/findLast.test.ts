import { findLast, findLastIndex } from "./findLast";

describe("findLastIndex", () => {
  it("should return -1 for an empty array", () => {
    expect(findLastIndex([], () => true)).toBe(-1);
  });

  it("should return -1 when no element matches", () => {
    expect(findLastIndex([1, 2, 3], (x) => x > 10)).toBe(-1);
  });

  it("should return the index of the last matching element", () => {
    expect(findLastIndex([1, 2, 3, 2, 1], (x) => x === 2)).toBe(3);
  });

  it("should return the only matching element index", () => {
    expect(findLastIndex([1, 2, 3], (x) => x === 2)).toBe(1);
  });

  it("should return the last index when all elements match", () => {
    expect(findLastIndex([1, 1, 1], (x) => x === 1)).toBe(2);
  });

  it("should return the first index when only the first element matches", () => {
    expect(findLastIndex([1, 2, 3], (x) => x === 1)).toBe(0);
  });

  it("should return the last index when only the last element matches", () => {
    expect(findLastIndex([1, 2, 3], (x) => x === 3)).toBe(2);
  });

  it("should work with objects", () => {
    const arr = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "a" },
    ];
    expect(findLastIndex(arr, (item) => item.name === "a")).toBe(2);
  });

  it("should work with strings", () => {
    const arr = ["apple", "banana", "cherry", "banana"];
    expect(findLastIndex(arr, (s) => s === "banana")).toBe(3);
  });
});

describe("findLast", () => {
  it("should return undefined for an empty array", () => {
    expect(findLast([], () => true)).toBeUndefined();
  });

  it("should return undefined when no element matches", () => {
    expect(findLast([1, 2, 3], (x) => x > 10)).toBeUndefined();
  });

  it("should return the last matching element", () => {
    expect(findLast([1, 2, 3, 2, 1], (x) => x === 2)).toBe(2);
  });

  it("should return the only matching element", () => {
    expect(findLast([1, 2, 3], (x) => x === 2)).toBe(2);
  });

  it("should return the last element when all elements match", () => {
    expect(findLast([1, 2, 3], (x) => x > 0)).toBe(3);
  });

  it("should return the first element when only the first element matches", () => {
    expect(findLast([1, 2, 3], (x) => x === 1)).toBe(1);
  });

  it("should return the last element when only the last element matches", () => {
    expect(findLast([1, 2, 3], (x) => x === 3)).toBe(3);
  });

  it("should work with objects and return the matching object", () => {
    const obj1 = { id: 1, name: "a" };
    const obj2 = { id: 2, name: "b" };
    const obj3 = { id: 3, name: "a" };
    const arr = [obj1, obj2, obj3];
    expect(findLast(arr, (item) => item.name === "a")).toBe(obj3);
  });

  it("should work with strings", () => {
    const arr = ["apple", "banana", "cherry", "banana"];
    expect(findLast(arr, (s) => s.startsWith("b"))).toBe("banana");
  });

  it("should accept truthy return values from criterion function", () => {
    const arr = [{ value: 0 }, { value: 1 }, { value: 2 }];
    // criterion returns the value itself, which is truthy for 1 and 2
    expect(findLast(arr, (item) => item.value)).toEqual({ value: 2 });
  });
});
