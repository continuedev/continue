import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class values and merges Tailwind CSS classes.
 *
 * This utility function combines the functionality of clsx (for conditional class names)
 * and tailwind-merge (for intelligently merging Tailwind CSS classes, removing duplicates
 * and conflicts).
 *
 * @param inputs - Class values that can be strings, objects, arrays, or conditional expressions
 * @returns A merged string of class names with Tailwind conflicts resolved
 *
 * @example
 * cn('px-2 py-1', 'px-4') // Returns 'py-1 px-4' (px-2 is overridden by px-4)
 * cn('text-red-500', { 'text-blue-500': isActive }) // Conditionally applies classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
