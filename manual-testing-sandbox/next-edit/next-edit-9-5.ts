// A messy e-commerce product management system with tangled responsibilities
// Difficulty: 5/5

type ProductStatus =
  | "active"
  | "inactive"
  | "discontinued"
  | "out_of_stock"
  | "backorder";
type UserRole = "admin" | "manager" | "staff" | "customer";
let DATABASE: any = {
  products: new Map(),
  users: new Map(),
  cart: new Map(),
  orders: [],
  logs: [],
  sessions: new Map(),
  config: { taxRate: 0.08, discountThreshold: 1000 },
};
let CURRENT_USER: any = null;
let NOTIFICATIONS: any[] = [];

// Global function to generate IDs (mixes concerns and not encapsulated)
function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

// Global function for logging (mixed with business logic)
function log(action: string, data: any) {
  const timestamp = new Date().toISOString();
  DATABASE.logs.push({
    timestamp,
    action,
    data,
    user: CURRENT_USER?.username || "system",
  });
  console.log(`[${timestamp}] ${action}:`, data);
}

class ProductManager {
  // This class does way too much - violates SRP
  static instance: ProductManager;
  private constructor() {}

  // Singleton pattern used incorrectly
  static getInstance() {
    if (!ProductManager.instance) {
      ProductManager.instance = new ProductManager();
    }
    return ProductManager.instance;
  }

  addProduct(
    name: string,
    price: number,
    desc: string,
    img: string,
    category: string,
  ) {
    // Validation mixed with business logic
    if (!name || price <= 0) {
      throw new Error("Invalid product data");
    }

    // Authentication check shouldn't be here
    if (
      !CURRENT_USER ||
      (CURRENT_USER.role !== "admin" && CURRENT_USER.role !== "manager")
    ) {
      throw new Error("Unauthorized access");
    }

    const id = generateId("prod");

    // Direct database manipulation and notification logic mixed together
    DATABASE.products.set(id, {
      id,
      name,
      price,
      description: desc,
      image: img,
      category,
      status: "active",
      created: new Date(),
      createdBy: CURRENT_USER.id,
      stock: 100, // Default hardcoded
      ratings: [],
      tags: category.split(",").map((t: string) => t.trim()),
      lastModified: new Date(),
    });

    // Notification logic should be separated
    NOTIFICATIONS.push({
      type: "product_added",
      message: `New product added: ${name}`,
      timestamp: new Date(),
    });

    // Logging should be a cross-cutting concern
    log("product_added", { id, name, price });

    // UI manipulation mixed with business logic
    if (document) {
      const productList = document.getElementById("product-list");
      if (productList) {
        const productEl = document.createElement("div");
        productEl.innerHTML = `<div class="product">${name} - $${price}</div>`;
        productList.appendChild(productEl);
      }
    }

    // Analytics tracking mixed in with product creation
    if (window) {
      try {
        (window as any).ga("send", "event", "Products", "Create", name);
      } catch (e) {
        console.error("Analytics error", e);
      }
    }

    return id;
  }

  updateProduct(id: string, data: any) {
    if (!DATABASE.products.has(id)) {
      throw new Error("Product not found");
    }

    // Authentication check duplicated
    if (
      !CURRENT_USER ||
      (CURRENT_USER.role !== "admin" && CURRENT_USER.role !== "manager")
    ) {
      throw new Error("Unauthorized access");
    }

    const product = DATABASE.products.get(id);

    // Updating with direct object manipulation
    Object.keys(data).forEach((key) => {
      if (key !== "id" && key !== "created" && key !== "createdBy") {
        product[key] = data[key];
      }
    });

    product.lastModified = new Date();
    product.lastModifiedBy = CURRENT_USER.id;

    DATABASE.products.set(id, product);

    // More mixed responsibilities
    log("product_updated", { id, changes: data });

    // Duplicated notification logic
    NOTIFICATIONS.push({
      type: "product_updated",
      message: `Product updated: ${product.name}`,
      timestamp: new Date(),
    });

    // Email notification logic mixed in
    if (product.status === "discontinued") {
      this.sendEmailToSubscribers(
        product.id,
        "Product Discontinued",
        `The product ${product.name} has been discontinued.`,
      );
    }

    return product;
  }

  deleteProduct(id: string) {
    // More authentication mixed in business logic
    if (!CURRENT_USER || CURRENT_USER.role !== "admin") {
      throw new Error("Only admins can delete products");
    }

    if (!DATABASE.products.has(id)) {
      throw new Error("Product not found");
    }

    const product = DATABASE.products.get(id);

    // Business rules mixed with deletion logic
    if (product.status === "active" && product.stock > 0) {
      throw new Error("Cannot delete active product with stock");
    }

    // More mixed concerns
    log("product_deleted", { id, name: product.name });
    NOTIFICATIONS.push({
      type: "product_deleted",
      message: `Product deleted: ${product.name}`,
      timestamp: new Date(),
    });

    DATABASE.products.delete(id);

    // Cache clearing mixed with business logic
    if (window && (window as any).cache) {
      (window as any).cache.invalidate("products");
    }

    return true;
  }

  // Email functionality mixed in the product manager
  sendEmailToSubscribers(productId: string, subject: string, body: string) {
    const product = DATABASE.products.get(productId);
    if (!product) return;

    // Email sending logic mixed with product management
    console.log(`Sending email about ${product.name} to subscribers`);
    // Imagine API call to email service here
  }

  // Search functionality mixed in the same class
  searchProducts(query: string, filters: any = {}) {
    let results: any[] = [];

    DATABASE.products.forEach((product: any) => {
      let matches =
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase());

      if (!matches) return;

      // Filter logic mixed in search
      if (filters.category && product.category !== filters.category) {
        return;
      }

      if (filters.minPrice && product.price < filters.minPrice) {
        return;
      }

      if (filters.maxPrice && product.price > filters.maxPrice) {
        return;
      }

      if (filters.status && product.status !== filters.status) {
        return;
      }

      results.push({ ...product });
    });

    // Logging mixed with search functionality
    log("product_search", { query, filters, resultCount: results.length });

    return results;
  }

  // Cart functionality shouldn't be in product manager
  addToCart(productId: string, quantity: number = 1) {
    if (!CURRENT_USER) {
      throw new Error("Must be logged in to add to cart");
    }

    const product = DATABASE.products.get(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.status !== "active") {
      throw new Error("Product is not available");
    }

    if (product.stock < quantity) {
      throw new Error("Not enough stock");
    }

    let cart = DATABASE.cart.get(CURRENT_USER.id) || [];
    const existingItem = cart.find((item: any) => item.productId === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        productId,
        quantity,
        price: product.price,
        name: product.name,
        addedAt: new Date(),
      });
    }

    DATABASE.cart.set(CURRENT_USER.id, cart);
    product.stock -= quantity;
    DATABASE.products.set(productId, product);

    log("cart_add", { productId, quantity, userId: CURRENT_USER.id });

    return cart;
  }
}

// Usage would be something like:
// const pm = ProductManager.getInstance();
// pm.addProduct('Gaming Laptop', 1299.99, 'High performance gaming laptop', 'laptop.jpg', 'Electronics,Computers');
// pm.addToCart('prod_1abc123', 2);
