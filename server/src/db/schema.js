import { pgTable, serial, integer, text, varchar, decimal, timestamp, pgEnum, jsonb, boolean, primaryKey, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['super_admin', 'regional_admin', 'partner', 'standard', 'guest']);

export const subregions = pgTable('subregions', {
  id: serial('id').primaryKey(),
  subregionCode: varchar('subregion_code', { length: 80 }).unique(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  postalPatterns: text('postal_patterns').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subregionPostalCodes = pgTable('subregion_postal_codes', {
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'cascade' }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.subregionId, table.postalCode] }),
}));

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('standard'),
  managerUserId: integer('manager_user_id').references(() => users.id, { onDelete: 'set null' }),
  phone: varchar('phone', { length: 50 }),
  postalCode: varchar('postal_code', { length: 20 }).notNull().default(''),
  dateOfBirth: text('date_of_birth'),
  gender: varchar('gender', { length: 40 }),
  propertyType: varchar('property_type', { length: 60 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const audienceZones = pgTable('audience_zones', {
  id: serial('id').primaryKey(),
  zoneCode: varchar('zone_code', { length: 80 }).unique(),
  partnerUserId: integer('partner_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const audienceZonePostalCodes = pgTable('audience_zone_postal_codes', {
  audienceZoneId: integer('audience_zone_id').references(() => audienceZones.id, { onDelete: 'cascade' }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.audienceZoneId, table.postalCode] }),
}));


export const hardAssets = pgTable('hard_assets', {
  id: serial('id').primaryKey(),
  externalKey: varchar('external_key', { length: 160 }).unique(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
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

export const softAssetParents = pgTable('soft_asset_parents', {
  id: serial('id').primaryKey(),
  externalKey: varchar('external_key', { length: 160 }).unique(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  bucket: varchar('bucket', { length: 20 }),
  subCategory: varchar('sub_category', { length: 50 }).notNull().default('Programmes'),
  description: text('description'),
  schedule: text('schedule'),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  galleryUrls: jsonb('gallery_urls').default('[]'),
  audienceMode: varchar('audience_mode', { length: 40 }).notNull().default('public'),
  isMemberOnly: boolean('is_member_only').default(false),
  eligibilityRules: jsonb('eligibility_rules'),
  tags: jsonb('tags').default('[]'),
  isDeleted: boolean('is_deleted').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const softAssets = pgTable('soft_assets', {
  id: serial('id').primaryKey(),
  externalKey: varchar('external_key', { length: 160 }).unique(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'set null' }),
  assetMode: varchar('asset_mode', { length: 20 }).notNull().default('standalone'),
  parentSoftAssetId: integer('parent_soft_asset_id').references(() => softAssetParents.id, { onDelete: 'set null' }),
  hostHardAssetId: integer('host_hard_asset_id').references(() => hardAssets.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  bucket: varchar('bucket', { length: 20 }),
  subCategory: varchar('sub_category', { length: 50 }).notNull().default('Programmes'),
  description: text('description'),
  schedule: text('schedule'), // e.g., "Mondays 10am-12pm"
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  galleryUrls: jsonb('gallery_urls').default('[]'),
  audienceMode: varchar('audience_mode', { length: 40 }).notNull().default('public'),
  isMemberOnly: boolean('is_member_only').default(false),
  eligibilityRules: jsonb('eligibility_rules'),
  overriddenFields: jsonb('overridden_fields').default('[]'),
  contactPhone: varchar('contact_phone', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  ctaLabel: varchar('cta_label', { length: 255 }),
  ctaUrl: text('cta_url'),
  venueNote: text('venue_note'),
  availabilityEnabled: boolean('availability_enabled').default(false),
  availabilityCount: integer('availability_count').default(0),
  availabilityUnit: text('availability_unit'),
  isHidden: boolean('is_hidden').default(false),
  hideFrom: timestamp('hide_from'),
  hideUntil: timestamp('hide_until'),
  isDeleted: boolean('is_deleted').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userAssetMemberships = pgTable('user_asset_memberships', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  hardAssetId: integer('hard_asset_id').references(() => hardAssets.id, { onDelete: 'cascade' }).notNull(),
  joinMethod: varchar('join_method', { length: 40 }).notNull(),
  status: varchar('status', { length: 40 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userHardAssetUnique: uniqueIndex('user_asset_memberships_user_hard_asset_unique').on(table.userId, table.hardAssetId),
  userIdx: index('user_asset_memberships_user_idx').on(table.userId),
  hardAssetIdx: index('user_asset_memberships_hard_asset_idx').on(table.hardAssetId),
}));

export const softAssetAudienceZones = pgTable('soft_asset_audience_zones', {
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  audienceZoneId: integer('audience_zone_id').references(() => audienceZones.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.softAssetId, table.audienceZoneId] }),
}));

export const softAssetParentAudienceZones = pgTable('soft_asset_parent_audience_zones', {
  softAssetParentId: integer('soft_asset_parent_id').references(() => softAssetParents.id, { onDelete: 'cascade' }).notNull(),
  audienceZoneId: integer('audience_zone_id').references(() => audienceZones.id, { onDelete: 'cascade' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.softAssetParentId, table.audienceZoneId] }),
}));


export const userFavorites = pgTable('user_favorites', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  resourceType: varchar('resource_type', { length: 20 }).notNull(), // 'hard' or 'soft'
  resourceId: integer('resource_id').notNull(),
  snapshot: jsonb('snapshot'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userResourceUnique: uniqueIndex('user_favorites_user_resource_unique').on(table.userId, table.resourceType, table.resourceId),
}));

export const myMaps = pgTable('my_maps', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isShared: boolean('is_shared').notNull().default(false),
  shareToken: varchar('share_token', { length: 64 }),
  shareUpdatedAt: timestamp('share_updated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: index('my_maps_user_idx').on(table.userId),
  shareTokenUnique: uniqueIndex('my_maps_share_token_unique').on(table.shareToken),
}));

export const myMapAssets = pgTable('my_map_assets', {
  id: serial('id').primaryKey(),
  mapId: integer('map_id').references(() => myMaps.id, { onDelete: 'cascade' }).notNull(),
  resourceType: varchar('resource_type', { length: 20 }).notNull(),
  resourceId: integer('resource_id').notNull(),
  snapshot: jsonb('snapshot'),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => ({
  mapResourceUnique: uniqueIndex('my_map_assets_map_resource_unique').on(table.mapId, table.resourceType, table.resourceId),
}));

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
});

export const subCategories = pgTable('sub_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'hard' or 'soft'
  color: varchar('color', { length: 20 }).default('#3b82f6'), // default to blue-500
  iconUrl: text('icon_url'),
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

export const userSubregions = pgTable('user_subregions', {
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'cascade' }).notNull(),
});

export const partnerPostalCodes = pgTable('partner_postal_codes', {
  partnerUserId: integer('partner_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.partnerUserId, table.postalCode] }),
}));

// Drizzle ORM Relations Hook-ups
export const userSubregionsRelations = relations(userSubregions, ({ one }) => ({
  user: one(users, {
    fields: [userSubregions.userId],
    references: [users.id],
  }),
  subregion: one(subregions, {
    fields: [userSubregions.subregionId],
    references: [subregions.id],
  }),
}));

export const subregionsRelations = relations(subregions, ({ many }) => ({
  users: many(userSubregions),
  postalCodes: many(subregionPostalCodes),
}));

export const subregionPostalCodesRelations = relations(subregionPostalCodes, ({ one }) => ({
  subregion: one(subregions, {
    fields: [subregionPostalCodes.subregionId],
    references: [subregions.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  manager: one(users, {
    fields: [users.managerUserId],
    references: [users.id],
    relationName: 'user_manager',
  }),
  managedUsers: many(users, { relationName: 'user_manager' }),
  hardAssets: many(hardAssets),
  softAssetParents: many(softAssetParents),
  softAssets: many(softAssets),
  favorites: many(userFavorites),
  myMaps: many(myMaps),
  assetMemberships: many(userAssetMemberships),
  subregions: many(userSubregions),
  partnerPostalCodes: many(partnerPostalCodes),
  ownedAudienceZones: many(audienceZones, { relationName: 'audience_zone_owner' }),
  createdAudienceZones: many(audienceZones, { relationName: 'audience_zone_creator' }),
}));

export const hardAssetsRelations = relations(hardAssets, ({ one, many }) => ({
  partner: one(users, {
    fields: [hardAssets.partnerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [hardAssets.createdByUserId],
    references: [users.id],
  }),
  softAssets: many(softAssetLocations), // Many-to-Many through softAssetLocations
  hostedSoftAssets: many(softAssets, { relationName: 'soft_asset_host' }),
  memberships: many(userAssetMemberships),
  tags: many(hardAssetTags),    // M:N through hard_asset_tags
}));

export const softAssetParentsRelations = relations(softAssetParents, ({ one, many }) => ({
  partner: one(users, {
    fields: [softAssetParents.partnerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [softAssetParents.createdByUserId],
    references: [users.id],
  }),
  children: many(softAssets, { relationName: 'soft_asset_parent' }),
  audienceZones: many(softAssetParentAudienceZones),
}));

export const softAssetsRelations = relations(softAssets, ({ one, many }) => ({
  partner: one(users, {
    fields: [softAssets.partnerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [softAssets.createdByUserId],
    references: [users.id],
  }),
  parent: one(softAssetParents, {
    fields: [softAssets.parentSoftAssetId],
    references: [softAssetParents.id],
    relationName: 'soft_asset_parent',
  }),
  hostHardAsset: one(hardAssets, {
    fields: [softAssets.hostHardAssetId],
    references: [hardAssets.id],
    relationName: 'soft_asset_host',
  }),
  locations: many(softAssetLocations), // Many-to-Many through softAssetLocations
  tags: many(softAssetTags),    // M:N through soft_asset_tags
  audienceZones: many(softAssetAudienceZones),
}));

export const partnerPostalCodesRelations = relations(partnerPostalCodes, ({ one }) => ({
  partner: one(users, {
    fields: [partnerPostalCodes.partnerUserId],
    references: [users.id],
  }),
}));

export const audienceZonesRelations = relations(audienceZones, ({ one, many }) => ({
  ownerPartner: one(users, {
    fields: [audienceZones.partnerUserId],
    references: [users.id],
    relationName: 'audience_zone_owner',
  }),
  creator: one(users, {
    fields: [audienceZones.createdByUserId],
    references: [users.id],
    relationName: 'audience_zone_creator',
  }),
  postalCodes: many(audienceZonePostalCodes),
  softAssets: many(softAssetAudienceZones),
  softAssetParents: many(softAssetParentAudienceZones),
}));

export const audienceZonePostalCodesRelations = relations(audienceZonePostalCodes, ({ one }) => ({
  audienceZone: one(audienceZones, {
    fields: [audienceZonePostalCodes.audienceZoneId],
    references: [audienceZones.id],
  }),
}));

export const softAssetAudienceZonesRelations = relations(softAssetAudienceZones, ({ one }) => ({
  softAsset: one(softAssets, {
    fields: [softAssetAudienceZones.softAssetId],
    references: [softAssets.id],
  }),
  audienceZone: one(audienceZones, {
    fields: [softAssetAudienceZones.audienceZoneId],
    references: [audienceZones.id],
  }),
}));

export const softAssetParentAudienceZonesRelations = relations(softAssetParentAudienceZones, ({ one }) => ({
  softAssetParent: one(softAssetParents, {
    fields: [softAssetParentAudienceZones.softAssetParentId],
    references: [softAssetParents.id],
  }),
  audienceZone: one(audienceZones, {
    fields: [softAssetParentAudienceZones.audienceZoneId],
    references: [audienceZones.id],
  }),
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

export const myMapsRelations = relations(myMaps, ({ one, many }) => ({
  user: one(users, {
    fields: [myMaps.userId],
    references: [users.id],
  }),
  assets: many(myMapAssets),
}));

export const myMapAssetsRelations = relations(myMapAssets, ({ one }) => ({
  map: one(myMaps, {
    fields: [myMapAssets.mapId],
    references: [myMaps.id],
  }),
}));

export const userAssetMembershipsRelations = relations(userAssetMemberships, ({ one }) => ({
  user: one(users, {
    fields: [userAssetMemberships.userId],
    references: [users.id],
  }),
  hardAsset: one(hardAssets, {
    fields: [userAssetMemberships.hardAssetId],
    references: [hardAssets.id],
  }),
}));
