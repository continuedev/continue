// A clean implementation of the price calculation utility
// Solution for: next-edit-1-1.ts

/**
 * Interface for a purchasable item
 */
interface PricedItem {
  name: string;
  price: number;
}

/**
 * Calculates the total price of items with an optional discount
 *
 * @param items - Array of priced items
 * @param discountPercentage - Optional discount to apply (percentage)
 * @returns The final price after discount
 */
function calculateTotalPrice(
  items: PricedItem[],
  discountPercentage = 0,
): number {
  // Calculate total price
  const subtotal = items.reduce((total, item) => total + item.price, 0);

  // Apply discount
  const discount = (subtotal * discountPercentage) / 100;
  const finalPrice = subtotal - discount;

  return finalPrice;
}

// Example usage
const cart: PricedItem[] = [
  { name: "Shirt", price: 25 },
  { name: "Pants", price: 50 },
  { name: "Shoes", price: 100 },
];

// Calculate price with 10% discount
const finalPrice = calculateTotalPrice(cart, 10);
console.log(`Final price: $${finalPrice}`);

// Export function
export default calculateTotalPrice;

/*
Single Responsibility Principle:

The function now has a clearer, more descriptive name: calculateTotalPrice instead of calc_price
Used proper camelCase naming convention for JavaScript/TypeScript functions


Type Safety:

Created a proper PricedItem interface instead of using any[]
Added proper type annotations throughout the code


Code Quality Improvements:

Replaced the for loop with a more functional reduce() approach
Used const instead of let where variables aren't reassigned
Used default parameter syntax instead of conditional checking
Improved variable naming for clarity
Added JSDoc comments for better documentation
Used template literals instead of string concatenation


Fixed Potential Issues:

Replaced loose inequality check (!=) with default parameter
Changed var to const in the loop to avoid scope issues
Made intermediate calculations more explicit with named variables


Maintainability:

Added proper documentation with JSDoc comments
Used more explicit and descriptive variable names
*/
