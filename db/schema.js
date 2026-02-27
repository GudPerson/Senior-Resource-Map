import { pgTable, serial, integer, text, varchar, decimal, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['admin', 'partner']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('partner'),
  phone: varchar('phone', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const hardAssets = pgTable('hard_assets', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  address: text('address').notNull(),
  country: varchar('country', { length: 2 }).notNull().default('US'),
  postalCode: varchar('postal_code', { length: 20 }).notNull().default(''),
  phone: varchar('phone', { length: 50 }),
  hours: text('hours'),
  description: text('description'),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  galleryUrls: jsonb('gallery_urls').default('[]'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const softAssets = pgTable('soft_assets', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  locationId: integer('location_id').references(() => hardAssets.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  schedule: text('schedule'), // e.g., "Mondays 10am-12pm"
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  galleryUrls: jsonb('gallery_urls').default('[]'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
});

export const hardAssetTags = pgTable('hard_asset_tags', {
  hardAssetId: integer('hard_asset_id').references(() => hardAssets.id, { onDelete: 'cascade' }).notNull(),
  tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
});

export const softAssetTags = pgTable('soft_asset_tags', {
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
});

// Drizzle ORM Relations Hook-ups
export const usersRelations = relations(users, ({ many }) => ({
  hardAssets: many(hardAssets),
  softAssets: many(softAssets),
}));

export const hardAssetsRelations = relations(hardAssets, ({ one, many }) => ({
  partner: one(users, {
    fields: [hardAssets.partnerId],
    references: [users.id],
  }),
  softAssets: many(softAssets), // One HardAsset -> Many SoftAssets
  tags: many(hardAssetTags),    // M:N through hard_asset_tags
}));

export const softAssetsRelations = relations(softAssets, ({ one, many }) => ({
  partner: one(users, {
    fields: [softAssets.partnerId],
    references: [users.id],
  }),
  location: one(hardAssets, { // Many SoftAssets -> One HardAsset location
    fields: [softAssets.locationId],
    references: [hardAssets.id],
  }),
  tags: many(softAssetTags),    // M:N through soft_asset_tags
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  hardAssets: many(hardAssetTags),
  softAssets: many(softAssetTags),
}));

export const hardAssetTagsRelations = relations(hardAssetTags, ({ one }) => ({
  hardAsset: one(hardAssets, {
    fields: [hardAssetTags.hardAssetId],
    references: [hardAssets.id],
  }),
  tag: one(tags, {
    fields: [hardAssetTags.tagId],
    references: [tags.id],
  }),
}));

export const softAssetTagsRelations = relations(softAssetTags, ({ one }) => ({
  softAsset: one(softAssets, {
    fields: [softAssetTags.softAssetId],
    references: [softAssets.id],
  }),
  tag: one(tags, {
    fields: [softAssetTags.tagId],
    references: [tags.id],
  }),
}));
