import { pgTable, serial, integer, text, varchar, decimal, timestamp, pgEnum, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['super_admin', 'regional_admin', 'partner', 'standard', 'guest']);

export const subregions = pgTable('subregions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('standard'),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'set null' }),
  phone: varchar('phone', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});


export const hardAssets = pgTable('hard_assets', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  subCategory: varchar('sub_category', { length: 50 }).notNull().default('Active Ageing Centres'),
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
  isHidden: boolean('is_hidden').default(false),
  hideFrom: timestamp('hide_from'),
  hideUntil: timestamp('hide_until'),
  isDeleted: boolean('is_deleted').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const softAssets = pgTable('soft_assets', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  subCategory: varchar('sub_category', { length: 50 }).notNull().default('Programmes'),
  description: text('description'),
  schedule: text('schedule'), // e.g., "Mondays 10am-12pm"
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  galleryUrls: jsonb('gallery_urls').default('[]'),
  isMemberOnly: boolean('is_member_only').default(false),
  isHidden: boolean('is_hidden').default(false),
  hideFrom: timestamp('hide_from'),
  hideUntil: timestamp('hide_until'),
  isDeleted: boolean('is_deleted').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});


export const userFavorites = pgTable('user_favorites', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  resourceType: varchar('resource_type', { length: 20 }).notNull(), // 'hard' or 'soft'
  resourceId: integer('resource_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
});

export const subCategories = pgTable('sub_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'hard' or 'soft'
  color: varchar('color', { length: 20 }).default('#3b82f6'), // default to blue-500
});

export const hardAssetTags = pgTable('hard_asset_tags', {
  hardAssetId: integer('hard_asset_id').references(() => hardAssets.id, { onDelete: 'cascade' }).notNull(),
  tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
});

export const softAssetTags = pgTable('soft_asset_tags', {
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
});

export const softAssetLocations = pgTable('soft_asset_locations', {
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  hardAssetId: integer('hard_asset_id').references(() => hardAssets.id, { onDelete: 'cascade' }).notNull(),
});

// Drizzle ORM Relations Hook-ups
export const usersRelations = relations(users, ({ many }) => ({
  hardAssets: many(hardAssets),
  softAssets: many(softAssets),
  favorites: many(userFavorites),
}));

export const hardAssetsRelations = relations(hardAssets, ({ one, many }) => ({
  partner: one(users, {
    fields: [hardAssets.partnerId],
    references: [users.id],
  }),
  softAssets: many(softAssetLocations), // Many-to-Many through softAssetLocations
  tags: many(hardAssetTags),    // M:N through hard_asset_tags
}));

export const softAssetsRelations = relations(softAssets, ({ one, many }) => ({
  partner: one(users, {
    fields: [softAssets.partnerId],
    references: [users.id],
  }),
  locations: many(softAssetLocations), // Many-to-Many through softAssetLocations
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

export const softAssetLocationsRelations = relations(softAssetLocations, ({ one }) => ({
  softAsset: one(softAssets, {
    fields: [softAssetLocations.softAssetId],
    references: [softAssets.id],
  }),
  hardAsset: one(hardAssets, {
    fields: [softAssetLocations.hardAssetId],
    references: [hardAssets.id],
  }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userId],
    references: [users.id],
  }),
}));
