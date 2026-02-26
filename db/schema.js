import { pgTable, serial, text, varchar, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'partner']);
export const categoryEnum = pgEnum('category', ['Healthcare', 'Fitness', 'Social', 'Promotions']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('partner'),
  phone: varchar('phone', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const resources = pgTable('resources', {
  id: serial('id').primaryKey(),
  partnerId: serial('partner_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  category: categoryEnum('category').notNull(),
  country: varchar('country', { length: 2 }).notNull().default('US'),
  postalCode: varchar('postal_code', { length: 20 }).notNull().default(''),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 50 }),
  hours: text('hours'),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow(),
});
