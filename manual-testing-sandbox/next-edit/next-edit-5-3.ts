// A disorganized shopping cart implementation
// Difficulty: 3 - Moderate refactoring needed

// Product catalog
const PRODUCTS = {
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
const DISCOUNT_CODES = {
  SAVE10: { percentage: 10, minPurchase: 0 },
  SAVE20: { percentage: 20, minPurchase: 500 },
  FURNITURE15: { percentage: 15, minPurchase: 0, category: "furniture" },
};

// Cart state
let cartItems: { productId: number; quantity: number; price: number }[] = [];
let cartTotal = 0;
let appliedDiscountCode: string | null = null;

// User info
let userInfo: {
  name: string;
  email: string;
  address?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
} | null = null;

// Add product to cart
function addToCart(productId: number, quantity: number = 1) {
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
  let existingItem = false;
  for (let i = 0; i < cartItems.length; i++) {
    if (cartItems[i].productId === productId) {
      // Update quantity
      cartItems[i].quantity += quantity;
      existingItem = true;
      break;
    }
  }

  // Add new item if not already in cart
  if (!existingItem) {
    cartItems.push({
      productId,
      quantity,
      price: PRODUCTS[productId].price,
    });
  }

  // Update stock
  PRODUCTS[productId].stock -= quantity;

  // Recalculate cart total
  calculateCartTotal();

  return true;
}

// Remove product from cart
function removeFromCart(productId: number, quantity: number = 1) {
  for (let i = 0; i < cartItems.length; i++) {
    if (cartItems[i].productId === productId) {
      // Determine quantity to remove
      const qtyToRemove = Math.min(cartItems[i].quantity, quantity);

      // Return stock
      PRODUCTS[productId].stock += qtyToRemove;

      // Update cart item
      cartItems[i].quantity -= qtyToRemove;

      // Remove item if quantity is 0
      if (cartItems[i].quantity === 0) {
        cartItems.splice(i, 1);
      }

      // Recalculate cart total
      calculateCartTotal();

      return true;
    }
  }

  console.error("Product not in cart!");
  return false;
}

// Calculate cart total
function calculateCartTotal() {
  let total = 0;

  // Sum all items
  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];
    total += item.price * item.quantity;
  }

  // Apply discount if any
  if (appliedDiscountCode) {
    const discount = DISCOUNT_CODES[appliedDiscountCode];

    // Check if discount applies to specific category
    if (discount.category) {
      let categoryTotal = 0;
      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (PRODUCTS[item.productId].category === discount.category) {
          categoryTotal += item.price * item.quantity;
        }
      }

      // Apply discount to category total
      const discountAmount = categoryTotal * (discount.percentage / 100);
      total -= discountAmount;
    } else {
      // Apply discount to entire cart
      const discountAmount = total * (discount.percentage / 100);
      total -= discountAmount;
    }
  }

  cartTotal = total;
  return cartTotal;
}

// Apply discount code
function applyDiscountCode(code: string) {
  // Check if discount code exists
  if (!DISCOUNT_CODES[code]) {
    console.error("Invalid discount code!");
    return false;
  }

  const discount = DISCOUNT_CODES[code];

  // Check minimum purchase requirement
  if (cartTotal < discount.minPurchase) {
    console.error(
      `Minimum purchase of $${discount.minPurchase} required for this code!`,
    );
    return false;
  }

  // Apply discount code
  appliedDiscountCode = code;

  // Recalculate total
  calculateCartTotal();

  return true;
}

// Set user information
function setUserInfo(
  name: string,
  email: string,
  address?: { street: string; city: string; zipCode: string; country: string },
) {
  userInfo = { name, email, address };
  return true;
}

// Checkout
function checkout() {
  // Validate cart
  if (cartItems.length === 0) {
    console.error("Cart is empty!");
    return false;
  }

  // Validate user info
  if (!userInfo || !userInfo.name || !userInfo.email) {
    console.error("User information incomplete!");
    return false;
  }

  // Process payment (simplified)
  console.log("Processing payment for $" + cartTotal);
  console.log("Items:", cartItems);
  console.log("User:", userInfo);

  // Clear cart after successful checkout
  cartItems = [];
  cartTotal = 0;
  appliedDiscountCode = null;

  return true;
}

// Get cart summary
function getCartSummary() {
  return {
    items: cartItems,
    total: cartTotal,
    discountCode: appliedDiscountCode,
    user: userInfo,
  };
}

// Example usage
addToCart(1, 2); // Add 2 laptops
addToCart(3, 1); // Add 1 headphones
applyDiscountCode("SAVE10");
setUserInfo("John Doe", "john@example.com", {
  street: "123 Main St",
  city: "Anytown",
  zipCode: "12345",
  country: "USA",
});

console.log(getCartSummary());

export {
  addToCart,
  applyDiscountCode,
  calculateCartTotal,
  checkout,
  DISCOUNT_CODES,
  getCartSummary,
  PRODUCTS,
  removeFromCart,
  setUserInfo,
};
