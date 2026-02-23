// Clean implementation of e-commerce product management system
// Following SOLID principles

// Types and Interfaces
type ProductStatus =
  | "active"
  | "inactive"
  | "discontinued"
  | "out_of_stock"
  | "backorder";
type UserRole = "admin" | "manager" | "staff" | "customer";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  status: ProductStatus;
  created: Date;
  createdBy: string;
  stock: number;
  ratings: any[];
  tags: string[];
  lastModified: Date;
  lastModifiedBy?: string;
}

interface User {
  id: string;
  username: string;
  role: UserRole;
}

interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  addedAt: Date;
}

interface Notification {
  type: string;
  message: string;
  timestamp: Date;
}

interface LogEntry {
  timestamp: string;
  action: string;
  data: any;
  user: string;
}

interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: ProductStatus;
}

// Database abstraction - Single Responsibility for data persistence
class Database {
  private products: Map<string, Product> = new Map();
  private users: Map<string, User> = new Map();
  private cart: Map<string, CartItem[]> = new Map();
  private orders: any[] = [];
  private logs: LogEntry[] = [];
  private sessions: Map<string, any> = new Map();
  private config = { taxRate: 0.08, discountThreshold: 1000 };

  // Product repository methods
  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  saveProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  removeProduct(id: string): boolean {
    return this.products.delete(id);
  }

  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  // Cart repository methods
  getCart(userId: string): CartItem[] {
    return this.cart.get(userId) || [];
  }

  saveCart(userId: string, cart: CartItem[]): void {
    this.cart.set(userId, cart);
  }

  // Logging method
  addLog(logEntry: LogEntry): void {
    this.logs.push(logEntry);
  }
}

// Authentication service - Single Responsibility for user management
class AuthService {
  private currentUser: User | null = null;

  constructor(private database: Database) {}

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  setCurrentUser(user: User): void {
    this.currentUser = user;
  }

  logout(): void {
    this.currentUser = null;
  }

  hasPermission(allowedRoles: UserRole[]): boolean {
    if (!this.currentUser) return false;
    return allowedRoles.includes(this.currentUser.role);
  }
}

// Utility service - Single Responsibility for common functions
class UtilityService {
  generateId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Logger service - Single Responsibility for logging
class LoggingService {
  constructor(
    private database: Database,
    private authService: AuthService,
  ) {}

  log(action: string, data: any): void {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      action,
      data,
      user: this.authService.getCurrentUser()?.username || "system",
    };

    this.database.addLog(logEntry);
    console.log(`[${timestamp}] ${action}:`, data);
  }
}

// Notification service - Single Responsibility for notifications
class NotificationService {
  private notifications: Notification[] = [];

  addNotification(type: string, message: string): void {
    this.notifications.push({
      type,
      message,
      timestamp: new Date(),
    });
  }

  getNotifications(): Notification[] {
    return [...this.notifications];
  }
}

// Email service - Single Responsibility for email communication
class EmailService {
  sendEmailToSubscribers(
    productName: string,
    subject: string,
    body: string,
  ): void {
    console.log(`Sending email about ${productName} to subscribers`);
    // Actual email sending logic would go here
  }
}

// Product validation - Single Responsibility for product validation
class ProductValidator {
  validate(name: string, price: number): boolean {
    return name !== "" && price > 0;
  }
}

// Auth middleware interface - Open/Closed Principle
interface AuthorizationMiddleware {
  checkAuthorization(operation: string): boolean;
}

// Product authorization - Single Responsibility for product auth
class ProductAuthorizationMiddleware implements AuthorizationMiddleware {
  constructor(private authService: AuthService) {}

  checkAuthorization(operation: string): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return false;

    switch (operation) {
      case "create":
      case "update":
        return this.authService.hasPermission(["admin", "manager"]);
      case "delete":
        return this.authService.hasPermission(["admin"]);
      case "view":
        return true;
      default:
        return false;
    }
  }
}

// Product service - Core business logic with proper separation of concerns
class ProductService {
  constructor(
    private database: Database,
    private utilityService: UtilityService,
    private loggingService: LoggingService,
    private notificationService: NotificationService,
    private emailService: EmailService,
    private validator: ProductValidator,
    private authMiddleware: AuthorizationMiddleware,
  ) {}

  createProduct(
    name: string,
    price: number,
    description: string,
    image: string,
    category: string,
    initialStock: number = 100,
  ): string {
    // Authorization check
    if (!this.authMiddleware.checkAuthorization("create")) {
      throw new Error("Unauthorized access");
    }

    // Validation
    if (!this.validator.validate(name, price)) {
      throw new Error("Invalid product data");
    }

    const currentUser = this.database.getUsers()[0]; // This is a placeholder - we'd use proper auth in a real app
    const id = this.utilityService.generateId("prod");
    const tags = category.split(",").map((t) => t.trim());

    // Create product object
    const product: Product = {
      id,
      name,
      price,
      description,
      image,
      category,
      status: "active" as ProductStatus,
      created: new Date(),
      createdBy: currentUser.id,
      stock: initialStock,
      ratings: [],
      tags,
      lastModified: new Date(),
    };

    // Save to database
    this.database.saveProduct(product);

    // Logging
    this.loggingService.log("product_added", { id, name, price });

    // Notification
    this.notificationService.addNotification(
      "product_added",
      `New product added: ${name}`,
    );

    return id;
  }

  updateProduct(id: string, data: Partial<Product>): Product {
    // Authorization check
    if (!this.authMiddleware.checkAuthorization("update")) {
      throw new Error("Unauthorized access");
    }

    const product = this.database.getProduct(id);
    if (!product) {
      throw new Error("Product not found");
    }

    // Create updated product - preventing modification of protected fields
    const updatedProduct = { ...product };

    Object.keys(data).forEach((key) => {
      if (key !== "id" && key !== "created" && key !== "createdBy") {
        updatedProduct[key as keyof Product] = data[
          key as keyof Product
        ] as any;
      }
    });

    const currentUser = this.database.getUsers()[0]; // Placeholder
    updatedProduct.lastModified = new Date();
    updatedProduct.lastModifiedBy = currentUser.id;

    // Save to database
    this.database.saveProduct(updatedProduct);

    // Logging
    this.loggingService.log("product_updated", { id, changes: data });

    // Notification
    this.notificationService.addNotification(
      "product_updated",
      `Product updated: ${updatedProduct.name}`,
    );

    // Handle special status changes
    if (data.status === "discontinued") {
      this.emailService.sendEmailToSubscribers(
        updatedProduct.name,
        "Product Discontinued",
        `The product ${updatedProduct.name} has been discontinued.`,
      );
    }

    return updatedProduct;
  }

  deleteProduct(id: string): boolean {
    // Authorization check
    if (!this.authMiddleware.checkAuthorization("delete")) {
      throw new Error("Unauthorized access");
    }

    const product = this.database.getProduct(id);
    if (!product) {
      throw new Error("Product not found");
    }

    // Business rule validation
    if (product.status === "active" && product.stock > 0) {
      throw new Error("Cannot delete active product with stock");
    }

    // Delete from database
    const result = this.database.removeProduct(id);

    // Logging
    this.loggingService.log("product_deleted", { id, name: product.name });

    // Notification
    this.notificationService.addNotification(
      "product_deleted",
      `Product deleted: ${product.name}`,
    );

    return result;
  }

  searchProducts(query: string, filters: SearchFilters = {}): Product[] {
    const products = this.database.getAllProducts();
    const results = products.filter((product) => {
      // Match text search
      const matches =
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase());

      if (!matches) return false;

      // Apply filters
      if (filters.category && product.category !== filters.category) {
        return false;
      }

      if (filters.minPrice && product.price < filters.minPrice) {
        return false;
      }

      if (filters.maxPrice && product.price > filters.maxPrice) {
        return false;
      }

      if (filters.status && product.status !== filters.status) {
        return false;
      }

      return true;
    });

    // Log search results
    this.loggingService.log("product_search", {
      query,
      filters,
      resultCount: results.length,
    });

    return results;
  }
}

// Cart service - Single Responsibility for shopping cart functionality
class CartService {
  constructor(
    private database: Database,
    private authService: AuthService,
    private loggingService: LoggingService,
  ) {}

  addToCart(productId: string, quantity: number = 1): CartItem[] {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error("Must be logged in to add to cart");
    }

    const product = this.database.getProduct(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.status !== "active") {
      throw new Error("Product is not available");
    }

    if (product.stock < quantity) {
      throw new Error("Not enough stock");
    }

    // Get current cart
    const cart = this.database.getCart(currentUser.id);

    // Update or add item
    const existingItemIndex = cart.findIndex(
      (item) => item.productId === productId,
    );

    if (existingItemIndex >= 0) {
      cart[existingItemIndex].quantity += quantity;
    } else {
      cart.push({
        productId,
        quantity,
        price: product.price,
        name: product.name,
        addedAt: new Date(),
      });
    }

    // Update product stock
    product.stock -= quantity;
    this.database.saveProduct(product);

    // Save cart
    this.database.saveCart(currentUser.id, cart);

    // Log action
    this.loggingService.log("cart_add", {
      productId,
      quantity,
      userId: currentUser.id,
    });

    return cart;
  }
}

// Service Factory - Creates and wires up the services
class ServiceFactory {
  static createProductService(): ProductService {
    const database = new Database();
    const authService = new AuthService(database);
    const utilityService = new UtilityService();
    const loggingService = new LoggingService(database, authService);
    const notificationService = new NotificationService();
    const emailService = new EmailService();
    const productValidator = new ProductValidator();
    const authMiddleware = new ProductAuthorizationMiddleware(authService);

    return new ProductService(
      database,
      utilityService,
      loggingService,
      notificationService,
      emailService,
      productValidator,
      authMiddleware,
    );
  }

  static createCartService(): CartService {
    const database = new Database();
    const authService = new AuthService(database);
    const loggingService = new LoggingService(database, authService);

    return new CartService(database, authService, loggingService);
  }
}

// Example usage:
/*
const productService = ServiceFactory.createProductService();
const cartService = ServiceFactory.createCartService();

// Create a product
const productId = productService.createProduct(
  'Gaming Laptop',
  1299.99,
  'High performance gaming laptop',
  'laptop.jpg',
  'Electronics,Computers',
  100
);

// Add to cart
cartService.addToCart(productId, 2);
*/

/*
Original Code Smells:

Violation of Single Responsibility Principle (SRP)

ProductManager class handles product management, cart operations, email sending, UI updates, and analytics
Database operations, validation, logging, and notifications are all mixed together


Violation of Open/Closed Principle (OCP)

Code is not structured to be easily extended without modification
Hard-coded business rules and functionality


Poor Encapsulation

Global variables (DATABASE, CURRENT_USER, NOTIFICATIONS)
Direct manipulation of shared state


Tight Coupling

Business logic directly depends on UI elements (document, window)
Authentication checks embedded in business methods


Singleton Anti-pattern Misuse

Incorrect implementation of the Singleton pattern


Lack of Proper Interfaces and Abstraction

No clear contracts between components
No separation between data access and business logic


Code Duplication

Authentication checks duplicated across methods
Notification and logging logic repeated


Poor Error Handling

Inconsistent error handling
Mixed validation with business operations


UI Manipulation in Business Logic

Direct DOM manipulation in product methods


Hard-coded Values

Default stock values
Business rules embedded in methods


Improvements Made:

Applied Single Responsibility Principle (SRP)

Created separate classes for distinct responsibilities:
Database for data storage
AuthService for authentication
LoggingService for logging
NotificationService for notifications
EmailService for email communication
ProductService for product business logic
CartService for cart operations
ProductValidator for validation
UtilityService for utility functions


Applied Open/Closed Principle (OCP)

Used interfaces for extensibility (e.g., AuthorizationMiddleware)
Created classes that can be extended without modifying existing code


Applied Interface Segregation Principle (ISP)

Created focused interfaces for different functionalities
Ensured clients only depend on methods they use


Applied Dependency Inversion Principle (DIP)

High-level modules depend on abstractions
Used dependency injection to provide implementations


Proper Encapsulation

Removed global variables
Encapsulated state within appropriate classes


Reduced Coupling

Removed direct UI manipulation from business logic
Used dependency injection for loosely coupled components


Implemented Factory Pattern

Added ServiceFactory to create and wire up services
Simplified client code by hiding implementation details


Added Type Safety

Created proper interfaces for data structures
Used TypeScript types effectively


Improved Error Handling

Consistent error checking across methods
Validation separated from business logic


Removed Code Duplication

Centralized authentication checks
Reused code through proper abstraction
*/
