// Refactored shopping cart implementation following SOLID principles

// Types and interfaces
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
}

interface CartItem {
  productId: number;
  quantity: number;
  price: number;
}

interface Discount {
  percentage: number;
  minPurchase: number;
  category?: string;
}

interface UserInfo {
  name: string;
  email: string;
  address?: Address;
}

interface Address {
  street: string;
  city: string;
  zipCode: string;
  country: string;
}

interface CartSummary {
  items: CartItem[];
  total: number;
  discountCode: string | null;
  user: UserInfo | null;
}

// Product catalog
const PRODUCTS: Record<number, Product> = {
  1: {
    id: 1,
    name: "Laptop",
    price: 999.99,
    stock: 10,
    category: "electronics",
  },
  2: {
    id: 2,
    name: "Smartphone",
    price: 699.99,
    stock: 15,
    category: "electronics",
  },
  3: {
    id: 3,
    name: "Headphones",
    price: 149.99,
    stock: 20,
    category: "electronics",
  },
  4: { id: 4, name: "Desk", price: 249.99, stock: 5, category: "furniture" },
  5: { id: 5, name: "Chair", price: 179.99, stock: 8, category: "furniture" },
};

// Discount codes
const DISCOUNT_CODES: Record<string, Discount> = {
  SAVE10: { percentage: 10, minPurchase: 0 },
  SAVE20: { percentage: 20, minPurchase: 500 },
  FURNITURE15: { percentage: 15, minPurchase: 0, category: "furniture" },
};

// Shopping cart class that follows Single Responsibility Principle
class ShoppingCart {
  private items: CartItem[] = [];
  private total: number = 0;
  private discountCode: string | null = null;
  private userInfo: UserInfo | null = null;

  // Add product to cart
  public addToCart(productId: number, quantity: number = 1): boolean {
    // Check if product exists
    if (!PRODUCTS[productId]) {
      console.error("Product not found!");
      return false;
    }

    // Check if enough stock
    if (PRODUCTS[productId].stock < quantity) {
      console.error("Not enough stock!");
      return false;
    }

    // Check if product already in cart
    const existingItemIndex = this.findItemIndex(productId);

    if (existingItemIndex !== -1) {
      // Update quantity if product already in cart
      this.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item if not already in cart
      this.items.push({
        productId,
        quantity,
        price: PRODUCTS[productId].price,
      });
    }

    // Update stock
    PRODUCTS[productId].stock -= quantity;

    // Recalculate cart total
    this.calculateCartTotal();

    return true;
  }

  // Remove product from cart
  public removeFromCart(productId: number, quantity: number = 1): boolean {
    const itemIndex = this.findItemIndex(productId);

    if (itemIndex === -1) {
      console.error("Product not in cart!");
      return false;
    }

    const item = this.items[itemIndex];

    // Determine quantity to remove
    const qtyToRemove = Math.min(item.quantity, quantity);

    // Return stock
    PRODUCTS[productId].stock += qtyToRemove;

    // Update cart item
    item.quantity -= qtyToRemove;

    // Remove item if quantity is 0
    if (item.quantity === 0) {
      this.items.splice(itemIndex, 1);
    }

    // Recalculate cart total
    this.calculateCartTotal();

    return true;
  }

  // Calculate cart total
  public calculateCartTotal(): number {
    let total = this.calculateSubtotal();

    // Apply discount if any
    if (this.discountCode) {
      total = this.applyDiscountToTotal(total);
    }

    this.total = total;
    return this.total;
  }

  // Calculate subtotal without discounts
  private calculateSubtotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  }

  // Apply discount to total
  private applyDiscountToTotal(total: number): number {
    if (!this.discountCode) return total;

    const discount = DISCOUNT_CODES[this.discountCode];

    // Check if discount applies to specific category
    if (discount.category) {
      return this.applyCategoryDiscount(total, discount);
    } else {
      // Apply discount to entire cart
      const discountAmount = total * (discount.percentage / 100);
      return total - discountAmount;
    }
  }

  // Apply category-specific discount
  private applyCategoryDiscount(total: number, discount: Discount): number {
    let categoryTotal = 0;

    for (const item of this.items) {
      if (PRODUCTS[item.productId].category === discount.category) {
        categoryTotal += item.price * item.quantity;
      }
    }

    // Apply discount to category total
    const discountAmount = categoryTotal * (discount.percentage / 100);
    return total - discountAmount;
  }

  // Apply discount code
  public applyDiscountCode(code: string): boolean {
    // Check if discount code exists
    if (!DISCOUNT_CODES[code]) {
      console.error("Invalid discount code!");
      return false;
    }

    const discount = DISCOUNT_CODES[code];

    // Check minimum purchase requirement
    if (this.total < discount.minPurchase) {
      console.error(
        `Minimum purchase of $${discount.minPurchase} required for this code!`,
      );
      return false;
    }

    // Apply discount code
    this.discountCode = code;

    // Recalculate total
    this.calculateCartTotal();

    return true;
  }

  // Set user information
  public setUserInfo(name: string, email: string, address?: Address): boolean {
    this.userInfo = { name, email, address };
    return true;
  }

  // Find item index in cart
  private findItemIndex(productId: number): number {
    return this.items.findIndex((item) => item.productId === productId);
  }

  // Checkout
  public checkout(): boolean {
    // Validate cart
    if (this.items.length === 0) {
      console.error("Cart is empty!");
      return false;
    }

    // Validate user info
    if (!this.userInfo || !this.userInfo.name || !this.userInfo.email) {
      console.error("User information incomplete!");
      return false;
    }

    // Process payment (simplified)
    console.log("Processing payment for $" + this.total);
    console.log("Items:", this.items);
    console.log("User:", this.userInfo);

    // Clear cart after successful checkout
    this.clearCart();

    return true;
  }

  // Clear cart
  private clearCart(): void {
    this.items = [];
    this.total = 0;
    this.discountCode = null;
  }

  // Get cart summary
  public getCartSummary(): CartSummary {
    return {
      items: [...this.items], // Return a copy to prevent direct mutation
      total: this.total,
      discountCode: this.discountCode,
      user: this.userInfo,
    };
  }
}

// Create cart instance
const cart = new ShoppingCart();

// Example usage
cart.addToCart(1, 2); // Add 2 laptops
cart.addToCart(3, 1); // Add 1 headphones
cart.applyDiscountCode("SAVE10");
cart.setUserInfo("John Doe", "john@example.com", {
  street: "123 Main St",
  city: "Anytown",
  zipCode: "12345",
  country: "USA",
});

console.log(cart.getCartSummary());

// Export for module usage
export {
  Address,
  cart,
  CartItem,
  CartSummary,
  Discount,
  DISCOUNT_CODES,
  Product,
  PRODUCTS,
  ShoppingCart,
  UserInfo,
};

/*
Code Smells in the Original File
Global State: The code uses global variables for cart state, making it difficult to track changes and prone to side effects.

Lack of Encapsulation: Data and functions are not properly encapsulated, allowing direct manipulation of state from anywhere.

No Type Definitions: Lack of proper TypeScript interfaces for the domain entities.

Procedural Code: Functions operating on global state rather than object-oriented approach.

Poor Data Structure Access: Using for loops with indexes instead of more expressive array methods.

Mixed Responsibilities: Functions are handling multiple concerns (validation, business logic, data modification).

Duplicated Logic: Same validation and calculation logic repeated in multiple places.

No Clear Separation of Concerns: Business logic mixed with presentation logic (console logs).

No Protection Against Direct Mutation: The cart data can be modified directly.


Improvements Made

Created a Class-Based Design: Encapsulated cart functionality in a ShoppingCart class

Added Strong Typing: Defined interfaces for all domain entities (Product, CartItem, Discount, UserInfo, Address, CartSummary)

Single Responsibility Principle: Separated methods for different concerns (e.g., split discount calculation into multiple methods)

Encapsulation: Made cart items and state private, only accessible through methods

Immutability: Return copies of data structures to prevent external modification

Modern JavaScript/TypeScript Patterns:

Used array methods like reduce, findIndex instead of for loops
Used parameter defaults, array spread operators


Better Method Organization:

Split large methods into smaller, focused ones
Created private helper methods for internal operations


Improved Validation: Centralized validation logic in appropriate methods

Better Error Handling: Consistent error reporting approach

Code Reusability: Extracted reusable logic into dedicated methods

Defensive Programming: Added checks to prevent invalid operations

Cleaner API Design: Created a clear public interface for the cart functionality
*/
