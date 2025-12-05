import { pgTable, serial, text, timestamp, numeric, integer, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ----------------------------------------------------------------------
// 1. TENANTS (Stores)
// ----------------------------------------------------------------------
export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  storeName: text('store_name').notNull(),
  storeDomain: text('store_domain').notNull().unique(), // e.g., "my-store.myshopify.com"
  accessToken: text('access_token').notNull(), // The 'shpat_' token
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  lastSyncedAt: timestamp('last_synced_at'),
});

// ----------------------------------------------------------------------
// 2. CUSTOMERS
// ----------------------------------------------------------------------
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(), // MULTI-TENANCY KEY
  shopifyId: text('shopify_id').notNull(), // ID from Shopify (e.g., "gid://shopify/Customer/123")
  
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  totalSpent: numeric('total_spent').default('0'), // For "Top 5 customers by spend"
  ordersCount: integer('orders_count').default(0),
  
  createdAt: timestamp('created_at'), // Shopify's creation date
  updatedAt: timestamp('updated_at').defaultNow(), // Our local update date
}, (table) => {
  return {
    // Optimization: Ensure one customer ID exists only once PER STORE
    unq: uniqueIndex('customer_tenant_idx').on(table.shopifyId, table.tenantId),
  };
});

// ----------------------------------------------------------------------
// 3. PRODUCTS
// ----------------------------------------------------------------------
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  shopifyId: text('shopify_id').notNull(),
  
  title: text('title').notNull(),
  bodyHtml: text('body_html'),
  vendor: text('vendor'),
  productType: text('product_type'),
  status: text('status'), // 'active', 'archived', 'draft'
  
  createdAt: timestamp('created_at'),
}, (table) => {
  return {
    unq: uniqueIndex('product_tenant_idx').on(table.shopifyId, table.tenantId),
  };
});

// ----------------------------------------------------------------------
// 4. ORDERS
// ----------------------------------------------------------------------
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id).notNull(),
  shopifyId: text('shopify_id').notNull(),
  
  // Link to our local customer table (Optional but good for SQL joins)
  customerId: integer('customer_id').references(() => customers.id), 
  
  totalPrice: numeric('total_price').notNull(), // For "Revenue" dashboard
  currency: text('currency'),
  financialStatus: text('financial_status'), // 'paid', 'pending', 'refunded'
  fulfillmentStatus: text('fulfillment_status'), 
  
  createdAt: timestamp('created_at'), // Essential for "Orders by Date" chart
}, (table) => {
  return {
    unq: uniqueIndex('order_tenant_idx').on(table.shopifyId, table.tenantId),
  };
});

// ----------------------------------------------------------------------
// 4b. ORDER ITEMS (Linking Orders to Products)
// ----------------------------------------------------------------------
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  productId: integer('product_id').references(() => products.id), // Nullable if product deleted locally
  
  quantity: integer('quantity').default(1),
  price: numeric('price'), // Price at time of purchase
  title: text('title'), // Snapshot of product title
}, (table) => {
  return {
    // Optional: Index for faster lookups
  };
});

// ----------------------------------------------------------------------
// 5. USERS (Dashboard Access)
// ----------------------------------------------------------------------
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id), // Optional: if users are tenant-specific
  name: text('name'),
  email: text('email').notNull().unique(),
  password: text('password'), // Hashed
  role: text('role').default('user'), // 'admin', 'user'
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------------------------
// RELATIONS (For easier Drizzle queries)
// ----------------------------------------------------------------------
export const tenantsRelations = relations(tenants, ({ many }) => ({
  orders: many(orders),
  products: many(products),
  customers: many(customers),
  users: many(users),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));
