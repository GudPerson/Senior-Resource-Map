import { pgTable, serial, integer, text, varchar, decimal, timestamp, pgEnum, jsonb, boolean, primaryKey, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
  chasCard: varchar('chas_card', { length: 20 }),
  caregiverStatus: varchar('caregiver_status', { length: 10 }),
  gender: varchar('gender', { length: 40 }),
  propertyType: varchar('property_type', { length: 60 }),
  volunteerInterest: varchar('volunteer_interest', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const partnerOrganizations = pgTable('partner_organizations', {
  id: serial('id').primaryKey(),
  legacyPartnerUserId: integer('legacy_partner_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  governanceStatus: varchar('governance_status', { length: 40 }).notNull().default('active'),
  dataContactName: varchar('data_contact_name', { length: 255 }),
  dataContactEmail: varchar('data_contact_email', { length: 255 }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  legacyPartnerUnique: uniqueIndex('partner_organizations_legacy_partner_unique')
    .on(table.legacyPartnerUserId)
    .where(sql`${table.legacyPartnerUserId} IS NOT NULL`),
  legacyPartnerIdx: index('partner_organizations_legacy_partner_idx').on(table.legacyPartnerUserId),
}));

export const partnerStaffMemberships = pgTable('partner_staff_memberships', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  staffRole: varchar('staff_role', { length: 40 }).notNull().default('editor'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserUnique: uniqueIndex('partner_staff_memberships_active_user_unique')
    .on(table.organizationId, table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  activeOwnerUnique: uniqueIndex('partner_staff_memberships_active_owner_unique')
    .on(table.organizationId)
    .where(sql`${table.revokedAt} IS NULL AND ${table.staffRole} = 'owner'`),
  organizationIdx: index('partner_staff_memberships_organization_idx').on(table.organizationId),
  userIdx: index('partner_staff_memberships_user_idx').on(table.userId),
}));

export const partnerStaffEvents = pgTable('partner_staff_events', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  targetUserId: integer('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 80 }).notNull(),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  organizationIdx: index('partner_staff_events_organization_idx').on(table.organizationId),
  actorIdx: index('partner_staff_events_actor_idx').on(table.actorUserId),
  targetIdx: index('partner_staff_events_target_idx').on(table.targetUserId),
}));

export const organizationAccessMemberships = pgTable('organization_access_memberships', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accessRole: varchar('access_role', { length: 40 }).notNull().default('staff'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserUnique: uniqueIndex('organization_access_memberships_active_user_unique')
    .on(table.organizationId, table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  organizationIdx: index('organization_access_memberships_organization_idx').on(table.organizationId),
  userIdx: index('organization_access_memberships_user_idx').on(table.userId),
  roleIdx: index('organization_access_memberships_role_idx').on(table.accessRole),
}));

export const organizationAgreements = pgTable('organization_agreements', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }).notNull(),
  agreementReference: varchar('agreement_reference', { length: 160 }).notNull(),
  agreementType: varchar('agreement_type', { length: 80 }).notNull().default('data_sharing'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  status: varchar('status', { length: 40 }).notNull().default('draft'),
  effectiveAt: timestamp('effective_at'),
  expiresAt: timestamp('expires_at'),
  allowedUses: jsonb('allowed_uses').notNull().default({}),
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedByUserId: integer('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  approvedAt: timestamp('approved_at'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  organizationIdx: index('organization_agreements_organization_idx').on(table.organizationId),
  statusIdx: index('organization_agreements_status_idx').on(table.status),
  expiresIdx: index('organization_agreements_expires_idx').on(table.expiresAt),
}));

export const organizationResourceLinks = pgTable('organization_resource_links', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }).notNull(),
  resourceType: varchar('resource_type', { length: 20 }).notNull(),
  resourceId: integer('resource_id').notNull(),
  linkStatus: varchar('link_status', { length: 40 }).notNull().default('active'),
  agreementCoverageStatus: varchar('agreement_coverage_status', { length: 40 }).notNull().default('unknown'),
  linkedByUserId: integer('linked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  unlinkedByUserId: integer('unlinked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  unlinkedAt: timestamp('unlinked_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeResourceUnique: uniqueIndex('organization_resource_links_active_resource_unique')
    .on(table.organizationId, table.resourceType, table.resourceId)
    .where(sql`${table.unlinkedAt} IS NULL`),
  organizationIdx: index('organization_resource_links_organization_idx').on(table.organizationId),
  resourceIdx: index('organization_resource_links_resource_idx').on(table.resourceType, table.resourceId),
  statusIdx: index('organization_resource_links_status_idx').on(table.linkStatus),
  coverageStatusIdx: index('organization_resource_links_coverage_status_idx').on(table.agreementCoverageStatus),
}));

export const governanceGroups = pgTable('governance_groups', {
  id: serial('id').primaryKey(),
  groupType: varchar('group_type', { length: 20 }).notNull(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coordinationStatus: varchar('coordination_status', { length: 40 }).notNull().default('active'),
  publicLabel: varchar('public_label', { length: 255 }),
  publicSummary: text('public_summary'),
  archivedAt: timestamp('archived_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  typeIdx: index('governance_groups_type_idx').on(table.groupType),
  organizationIdx: index('governance_groups_organization_idx').on(table.organizationId),
  subregionIdx: index('governance_groups_subregion_idx').on(table.subregionId),
  statusIdx: index('governance_groups_status_idx').on(table.coordinationStatus),
}));

export const governanceGroupMemberships = pgTable('governance_group_memberships', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => governanceGroups.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupRole: varchar('group_role', { length: 40 }).notNull().default('staff'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserUnique: uniqueIndex('governance_group_memberships_active_user_unique')
    .on(table.groupId, table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  groupIdx: index('governance_group_memberships_group_idx').on(table.groupId),
  userIdx: index('governance_group_memberships_user_idx').on(table.userId),
  roleIdx: index('governance_group_memberships_role_idx').on(table.groupRole),
}));

export const governanceGroupOrganizations = pgTable('governance_group_organizations', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => governanceGroups.id, { onDelete: 'cascade' }).notNull(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }).notNull(),
  linkStatus: varchar('link_status', { length: 40 }).notNull().default('active'),
  unlinkedAt: timestamp('unlinked_at'),
  linkedByUserId: integer('linked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  unlinkedByUserId: integer('unlinked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeOrganizationUnique: uniqueIndex('governance_group_organizations_active_unique')
    .on(table.groupId, table.organizationId)
    .where(sql`${table.unlinkedAt} IS NULL`),
  groupIdx: index('governance_group_organizations_group_idx').on(table.groupId),
  organizationIdx: index('governance_group_organizations_organization_idx').on(table.organizationId),
}));

export const governanceGroupResourceLinks = pgTable('governance_group_resource_links', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => governanceGroups.id, { onDelete: 'cascade' }).notNull(),
  resourceType: varchar('resource_type', { length: 20 }).notNull(),
  resourceId: integer('resource_id').notNull(),
  linkStatus: varchar('link_status', { length: 40 }).notNull().default('active'),
  unlinkedAt: timestamp('unlinked_at'),
  linkedByUserId: integer('linked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  unlinkedByUserId: integer('unlinked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeResourceUnique: uniqueIndex('governance_group_resource_links_active_resource_unique')
    .on(table.groupId, table.resourceType, table.resourceId)
    .where(sql`${table.unlinkedAt} IS NULL`),
  groupIdx: index('governance_group_resource_links_group_idx').on(table.groupId),
  resourceIdx: index('governance_group_resource_links_resource_idx').on(table.resourceType, table.resourceId),
}));

export const audienceZones = pgTable('audience_zones', {
  id: serial('id').primaryKey(),
  zoneCode: varchar('zone_code', { length: 80 }).unique(),
  partnerUserId: integer('partner_user_id').references(() => users.id, { onDelete: 'set null' }),
  hardAssetId: integer('hard_asset_id'),
  sharingStatus: varchar('sharing_status', { length: 40 }).notNull().default('approved'),
  approvedByUserId: integer('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at'),
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
  whatsappContact: varchar('whatsapp_contact', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  hours: text('hours'),
  website: text('website'),
  socialLinks: jsonb('social_links').default({}),
  description: text('description'),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  galleryUrls: jsonb('gallery_urls').default('[]'),
  sourceGooglePlaceId: text('source_google_place_id'),
  sourceGoogleMapsUri: text('source_google_maps_uri'),
  lastReviewedAt: timestamp('last_reviewed_at'),
  lastVerifiedByUserId: integer('last_verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  sourceType: varchar('source_type', { length: 80 }),
  verificationStatus: varchar('verification_status', { length: 40 }).notNull().default('unverified'),
  verificationConfidence: varchar('verification_confidence', { length: 40 }),
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
  website: text('website'),
  socialLinks: jsonb('social_links').default({}),
  contactPhone: varchar('contact_phone', { length: 50 }),
  whatsappContact: varchar('whatsapp_contact', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  audienceMode: varchar('audience_mode', { length: 40 }).notNull().default('public'),
  isMemberOnly: boolean('is_member_only').default(false),
  eligibilityRules: jsonb('eligibility_rules'),
  tags: jsonb('tags').default('[]'),
  lastReviewedAt: timestamp('last_reviewed_at'),
  lastVerifiedByUserId: integer('last_verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  sourceType: varchar('source_type', { length: 80 }),
  verificationStatus: varchar('verification_status', { length: 40 }).notNull().default('unverified'),
  verificationConfidence: varchar('verification_confidence', { length: 40 }),
  isDeleted: boolean('is_deleted').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const softAssets = pgTable('soft_assets', {
  id: serial('id').primaryKey(),
  externalKey: varchar('external_key', { length: 160 }).unique(),
  partnerId: integer('partner_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
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
  website: text('website'),
  socialLinks: jsonb('social_links').default({}),
  audienceMode: varchar('audience_mode', { length: 40 }).notNull().default('public'),
  isMemberOnly: boolean('is_member_only').default(false),
  eligibilityRules: jsonb('eligibility_rules'),
  overriddenFields: jsonb('overridden_fields').default('[]'),
  contactPhone: varchar('contact_phone', { length: 50 }),
  whatsappContact: varchar('whatsapp_contact', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  ctaLabel: varchar('cta_label', { length: 255 }),
  ctaUrl: text('cta_url'),
  venueNote: text('venue_note'),
  availabilityEnabled: boolean('availability_enabled').default(false),
  availabilityCount: integer('availability_count').default(0),
  availabilityUnit: text('availability_unit'),
  lastReviewedAt: timestamp('last_reviewed_at'),
  lastVerifiedByUserId: integer('last_verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  sourceType: varchar('source_type', { length: 80 }),
  verificationStatus: varchar('verification_status', { length: 40 }).notNull().default('unverified'),
  verificationConfidence: varchar('verification_confidence', { length: 40 }),
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

export const hardAssetStaffMemberships = pgTable('hard_asset_staff_memberships', {
  id: serial('id').primaryKey(),
  hardAssetId: integer('hard_asset_id').references(() => hardAssets.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  staffRole: varchar('staff_role', { length: 40 }).notNull().default('staff'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserUnique: uniqueIndex('hard_asset_staff_memberships_active_user_unique')
    .on(table.hardAssetId, table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  hardAssetIdx: index('hard_asset_staff_memberships_hard_asset_idx').on(table.hardAssetId),
  userIdx: index('hard_asset_staff_memberships_user_idx').on(table.userId),
  roleIdx: index('hard_asset_staff_memberships_role_idx').on(table.staffRole),
}));

export const softAssetRegionCoverages = pgTable('soft_asset_region_coverages', {
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'cascade' }).notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.softAssetId, table.subregionId] }),
  softAssetIdx: index('soft_asset_region_coverages_soft_asset_idx').on(table.softAssetId),
  subregionIdx: index('soft_asset_region_coverages_subregion_idx').on(table.subregionId),
}));

export const softAssetStaffMemberships = pgTable('soft_asset_staff_memberships', {
  id: serial('id').primaryKey(),
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  staffRole: varchar('staff_role', { length: 40 }).notNull().default('staff'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserUnique: uniqueIndex('soft_asset_staff_memberships_active_user_unique')
    .on(table.softAssetId, table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  softAssetIdx: index('soft_asset_staff_memberships_soft_asset_idx').on(table.softAssetId),
  userIdx: index('soft_asset_staff_memberships_user_idx').on(table.userId),
  roleIdx: index('soft_asset_staff_memberships_role_idx').on(table.staffRole),
}));

export const userPhoneIdentities = pgTable('user_phone_identities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  phoneE164: varchar('phone_e164', { length: 32 }).notNull(),
  countryCode: varchar('country_code', { length: 8 }).notNull().default('+65'),
  nationalNumber: varchar('national_number', { length: 24 }).notNull(),
  status: varchar('status', { length: 40 }).notNull().default('legacy_unverified'),
  source: varchar('source', { length: 40 }).notNull().default('legacy_profile'),
  providerSubject: varchar('provider_subject', { length: 255 }),
  verifiedAt: timestamp('verified_at'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activePhoneUnique: uniqueIndex('user_phone_identities_active_phone_unique')
    .on(table.phoneE164)
    .where(sql`${table.revokedAt} IS NULL`),
  activeUserUnique: uniqueIndex('user_phone_identities_active_user_unique')
    .on(table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  userIdx: index('user_phone_identities_user_idx').on(table.userId),
  phoneIdx: index('user_phone_identities_phone_idx').on(table.phoneE164),
}));

export const phoneVerificationAttempts = pgTable('phone_verification_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 40 }).notNull().default('gudauth'),
  providerChallengeId: varchar('provider_challenge_id', { length: 255 }),
  requestedPhoneE164: varchar('requested_phone_e164', { length: 32 }),
  verifiedPhoneE164: varchar('verified_phone_e164', { length: 32 }),
  status: varchar('status', { length: 40 }).notNull().default('pending'),
  providerStatus: varchar('provider_status', { length: 80 }),
  failureReason: text('failure_reason'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: index('phone_verification_attempts_user_idx').on(table.userId),
  providerChallengeUnique: uniqueIndex('phone_verification_attempts_provider_challenge_unique')
    .on(table.provider, table.providerChallengeId)
    .where(sql`${table.providerChallengeId} IS NOT NULL`),
  statusIdx: index('phone_verification_attempts_status_idx').on(table.status),
}));

export const phoneLoginAttempts = pgTable('phone_login_attempts', {
  id: serial('id').primaryKey(),
  provider: varchar('provider', { length: 40 }).notNull().default('gudauth'),
  providerChallengeId: varchar('provider_challenge_id', { length: 255 }),
  attemptTokenHash: varchar('attempt_token_hash', { length: 128 }),
  requestedPhoneE164: varchar('requested_phone_e164', { length: 32 }),
  verifiedPhoneE164: varchar('verified_phone_e164', { length: 32 }),
  resolvedUserId: integer('resolved_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 40 }).notNull().default('pending'),
  providerStatus: varchar('provider_status', { length: 80 }),
  failureReason: text('failure_reason'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  providerChallengeUnique: uniqueIndex('phone_login_attempts_provider_challenge_unique')
    .on(table.provider, table.providerChallengeId)
    .where(sql`${table.providerChallengeId} IS NOT NULL`),
  statusIdx: index('phone_login_attempts_status_idx').on(table.status),
  requestedPhoneIdx: index('phone_login_attempts_requested_phone_idx').on(table.requestedPhoneE164),
  resolvedUserIdx: index('phone_login_attempts_resolved_user_idx').on(table.resolvedUserId),
}));

export const userConsentRecords = pgTable('user_consent_records', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  consentType: varchar('consent_type', { length: 80 }).notNull(),
  consentVersion: varchar('consent_version', { length: 40 }).notNull(),
  status: varchar('status', { length: 40 }).notNull().default('accepted'),
  sourceSurface: varchar('source_surface', { length: 120 }),
  acceptedAt: timestamp('accepted_at'),
  withdrawnAt: timestamp('withdrawn_at'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: index('user_consent_records_user_idx').on(table.userId),
  userTypeVersionIdx: index('user_consent_records_user_type_version_idx').on(table.userId, table.consentType, table.consentVersion),
  statusIdx: index('user_consent_records_status_idx').on(table.status),
}));

export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  channel: varchar('channel', { length: 40 }).notNull(),
  category: varchar('category', { length: 80 }).notNull().default('general'),
  enabled: boolean('enabled').notNull().default(true),
  deliveryAllowed: boolean('delivery_allowed').notNull().default(false),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userChannelCategoryUnique: uniqueIndex('notification_preferences_user_channel_category_unique').on(table.userId, table.channel, table.category),
  userIdx: index('notification_preferences_user_idx').on(table.userId),
  channelIdx: index('notification_preferences_channel_idx').on(table.channel),
}));

export const userOptOutRecords = pgTable('user_opt_out_records', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  optOutType: varchar('opt_out_type', { length: 80 }).notNull(),
  reason: text('reason'),
  active: boolean('active').notNull().default(true),
  sourceSurface: varchar('source_surface', { length: 120 }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  revokedByUserId: integer('revoked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserTypeUnique: uniqueIndex('user_opt_out_records_active_user_type_unique')
    .on(table.userId, table.optOutType)
    .where(sql`${table.active} = TRUE AND ${table.revokedAt} IS NULL`),
  userIdx: index('user_opt_out_records_user_idx').on(table.userId),
  typeIdx: index('user_opt_out_records_type_idx').on(table.optOutType),
}));

export const sensitiveAuditLogs = pgTable('sensitive_audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  targetUserId: integer('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  actionType: varchar('action_type', { length: 120 }).notNull(),
  entityType: varchar('entity_type', { length: 80 }),
  entityId: integer('entity_id'),
  resourceType: varchar('resource_type', { length: 20 }),
  resourceId: integer('resource_id'),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  actorIdx: index('sensitive_audit_logs_actor_idx').on(table.actorUserId),
  actionIdx: index('sensitive_audit_logs_action_idx').on(table.actionType),
  entityIdx: index('sensitive_audit_logs_entity_idx').on(table.entityType, table.entityId),
  organizationIdx: index('sensitive_audit_logs_organization_idx').on(table.organizationId),
  resourceIdx: index('sensitive_audit_logs_resource_idx').on(table.resourceType, table.resourceId),
  createdIdx: index('sensitive_audit_logs_created_idx').on(table.createdAt),
}));

export const retentionRecords = pgTable('retention_records', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: integer('entity_id').notNull(),
  retentionCategory: varchar('retention_category', { length: 80 }).notNull(),
  retainUntil: timestamp('retain_until'),
  deletionEligible: boolean('deletion_eligible').notNull().default(false),
  deletionStatus: varchar('deletion_status', { length: 40 }).notNull().default('active'),
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  deletedByUserId: integer('deleted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  deletedAt: timestamp('deleted_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  entityCategoryUnique: uniqueIndex('retention_records_entity_category_unique').on(table.entityType, table.entityId, table.retentionCategory),
  statusIdx: index('retention_records_status_idx').on(table.deletionStatus),
  retainUntilIdx: index('retention_records_retain_until_idx').on(table.retainUntil),
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
  shareIncludesHandoffNotes: boolean('share_includes_handoff_notes').notNull().default(false),
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
  privateNote: text('private_note'),
  handoffNote: text('handoff_note'),
  notesUpdatedAt: timestamp('notes_updated_at'),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => ({
  mapResourceUnique: uniqueIndex('my_map_assets_map_resource_unique').on(table.mapId, table.resourceType, table.resourceId),
}));

export const myMapAssetNotes = pgTable('my_map_asset_notes', {
  id: serial('id').primaryKey(),
  mapAssetId: integer('map_asset_id').references(() => myMapAssets.id, { onDelete: 'cascade' }).notNull(),
  noteText: text('note_text').notNull(),
  isShared: boolean('is_shared').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  mapAssetIdx: index('my_map_asset_notes_map_asset_idx').on(table.mapAssetId),
  mapAssetSortIdx: index('my_map_asset_notes_map_asset_sort_idx').on(table.mapAssetId, table.sortOrder),
}));

export const myMapShareSnapshots = pgTable('my_map_share_snapshots', {
  id: serial('id').primaryKey(),
  mapId: integer('map_id').references(() => myMaps.id, { onDelete: 'cascade' }).notNull(),
  shareToken: varchar('share_token', { length: 64 }).notNull(),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  mapUnique: uniqueIndex('my_map_share_snapshots_map_unique').on(table.mapId),
  shareTokenIdx: index('my_map_share_snapshots_share_token_idx').on(table.shareToken),
}));

export const recommendationReviewRecords = pgTable('recommendation_review_records', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewerUserId: integer('reviewer_user_id').references(() => users.id, { onDelete: 'set null' }),
  mapId: integer('map_id').references(() => myMaps.id, { onDelete: 'set null' }),
  resourceType: varchar('resource_type', { length: 20 }),
  resourceId: integer('resource_id'),
  recommendationType: varchar('recommendation_type', { length: 80 }).notNull().default('social_prescribing'),
  decision: varchar('decision', { length: 40 }).notNull().default('pending'),
  status: varchar('status', { length: 40 }).notNull().default('draft'),
  explanationShown: text('explanation_shown'),
  reviewNotes: text('review_notes'),
  metadata: jsonb('metadata').notNull().default({}),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: index('recommendation_review_records_user_idx').on(table.userId),
  reviewerIdx: index('recommendation_review_records_reviewer_idx').on(table.reviewerUserId),
  resourceIdx: index('recommendation_review_records_resource_idx').on(table.resourceType, table.resourceId),
  statusIdx: index('recommendation_review_records_status_idx').on(table.status),
}));

export const privateResourceContents = pgTable('private_resource_contents', {
  id: serial('id').primaryKey(),
  resourceType: varchar('resource_type', { length: 20 }).notNull(),
  resourceId: integer('resource_id').notNull(),
  notes: text('notes'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  resourceUnique: uniqueIndex('private_resource_contents_resource_unique').on(table.resourceType, table.resourceId),
  resourceIdx: index('private_resource_contents_resource_idx').on(table.resourceType, table.resourceId),
}));

export const privateResourceContentAccess = pgTable('private_resource_content_access', {
  id: serial('id').primaryKey(),
  contentId: integer('content_id').references(() => privateResourceContents.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  contentUserUnique: uniqueIndex('private_resource_content_access_content_user_unique').on(table.contentId, table.userId),
  userIdx: index('private_resource_content_access_user_idx').on(table.userId),
}));

export const privateResourceContentFiles = pgTable('private_resource_content_files', {
  id: serial('id').primaryKey(),
  contentId: integer('content_id').references(() => privateResourceContents.id, { onDelete: 'cascade' }).notNull(),
  fileName: text('file_name').notNull(),
  mimeType: varchar('mime_type', { length: 160 }).notNull(),
  fileSize: integer('file_size').notNull(),
  fileData: text('file_data').notNull(),
  uploadedByUserId: integer('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  contentIdx: index('private_resource_content_files_content_idx').on(table.contentId),
}));

export const resourceTranslations = pgTable('resource_translations', {
  id: serial('id').primaryKey(),
  resourceType: varchar('resource_type', { length: 30 }).notNull(),
  resourceId: integer('resource_id').notNull(),
  locale: varchar('locale', { length: 12 }).notNull(),
  fields: jsonb('fields').notNull().default('{}'),
  fieldMeta: jsonb('field_meta').notNull().default('{}'),
  reviewedAt: timestamp('reviewed_at'),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  resourceLocaleUnique: uniqueIndex('resource_translations_resource_locale_unique').on(table.resourceType, table.resourceId, table.locale),
  resourceIdx: index('resource_translations_resource_idx').on(table.resourceType, table.resourceId),
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

export const softAssetGroupMembers = pgTable('soft_asset_group_members', {
  id: serial('id').primaryKey(),
  groupSoftAssetId: integer('group_soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  memberResourceType: varchar('member_resource_type', { length: 20 }).notNull(),
  memberResourceId: integer('member_resource_id').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  addedByUserId: integer('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  addedAt: timestamp('added_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueMember: uniqueIndex('soft_asset_group_members_unique_member_idx')
    .on(table.groupSoftAssetId, table.memberResourceType, table.memberResourceId),
  groupIdx: index('soft_asset_group_members_group_idx').on(table.groupSoftAssetId),
  memberIdx: index('soft_asset_group_members_member_idx').on(table.memberResourceType, table.memberResourceId),
}));

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
  phoneIdentities: many(userPhoneIdentities),
  phoneVerificationAttempts: many(phoneVerificationAttempts),
  phoneLoginAttempts: many(phoneLoginAttempts),
  subregions: many(userSubregions),
  partnerPostalCodes: many(partnerPostalCodes),
  hardAssetStaffMemberships: many(hardAssetStaffMemberships),
  softAssetStaffMemberships: many(softAssetStaffMemberships),
  organizationAccessMemberships: many(organizationAccessMemberships),
  governanceGroupMemberships: many(governanceGroupMemberships),
  consentRecords: many(userConsentRecords),
  notificationPreferences: many(notificationPreferences),
  optOutRecords: many(userOptOutRecords),
  ownedAudienceZones: many(audienceZones, { relationName: 'audience_zone_owner' }),
  createdAudienceZones: many(audienceZones, { relationName: 'audience_zone_creator' }),
  privateContentGrants: many(privateResourceContentAccess),
  resourceTranslations: many(resourceTranslations),
}));

export const partnerOrganizationsRelations = relations(partnerOrganizations, ({ one, many }) => ({
  legacyPartnerUser: one(users, {
    fields: [partnerOrganizations.legacyPartnerUserId],
    references: [users.id],
  }),
  governanceAccess: many(organizationAccessMemberships),
  agreements: many(organizationAgreements),
  resourceLinks: many(organizationResourceLinks),
  governanceGroups: many(governanceGroups),
  groupLinks: many(governanceGroupOrganizations),
}));

export const organizationAccessMembershipsRelations = relations(organizationAccessMemberships, ({ one }) => ({
  organization: one(partnerOrganizations, {
    fields: [organizationAccessMemberships.organizationId],
    references: [partnerOrganizations.id],
  }),
  user: one(users, {
    fields: [organizationAccessMemberships.userId],
    references: [users.id],
  }),
}));

export const organizationAgreementsRelations = relations(organizationAgreements, ({ one }) => ({
  organization: one(partnerOrganizations, {
    fields: [organizationAgreements.organizationId],
    references: [partnerOrganizations.id],
  }),
  approver: one(users, {
    fields: [organizationAgreements.approvedByUserId],
    references: [users.id],
    relationName: 'organization_agreement_approver',
  }),
}));

export const organizationResourceLinksRelations = relations(organizationResourceLinks, ({ one }) => ({
  organization: one(partnerOrganizations, {
    fields: [organizationResourceLinks.organizationId],
    references: [partnerOrganizations.id],
  }),
}));

export const governanceGroupsRelations = relations(governanceGroups, ({ one, many }) => ({
  organization: one(partnerOrganizations, {
    fields: [governanceGroups.organizationId],
    references: [partnerOrganizations.id],
  }),
  subregion: one(subregions, {
    fields: [governanceGroups.subregionId],
    references: [subregions.id],
  }),
  memberships: many(governanceGroupMemberships),
  organizations: many(governanceGroupOrganizations),
  resources: many(governanceGroupResourceLinks),
}));

export const governanceGroupMembershipsRelations = relations(governanceGroupMemberships, ({ one }) => ({
  group: one(governanceGroups, {
    fields: [governanceGroupMemberships.groupId],
    references: [governanceGroups.id],
  }),
  user: one(users, {
    fields: [governanceGroupMemberships.userId],
    references: [users.id],
  }),
}));

export const governanceGroupOrganizationsRelations = relations(governanceGroupOrganizations, ({ one }) => ({
  group: one(governanceGroups, {
    fields: [governanceGroupOrganizations.groupId],
    references: [governanceGroups.id],
  }),
  organization: one(partnerOrganizations, {
    fields: [governanceGroupOrganizations.organizationId],
    references: [partnerOrganizations.id],
  }),
}));

export const governanceGroupResourceLinksRelations = relations(governanceGroupResourceLinks, ({ one }) => ({
  group: one(governanceGroups, {
    fields: [governanceGroupResourceLinks.groupId],
    references: [governanceGroups.id],
  }),
}));

export const privateResourceContentsRelations = relations(privateResourceContents, ({ one, many }) => ({
  creator: one(users, {
    fields: [privateResourceContents.createdByUserId],
    references: [users.id],
    relationName: 'private_resource_content_creator',
  }),
  updater: one(users, {
    fields: [privateResourceContents.updatedByUserId],
    references: [users.id],
    relationName: 'private_resource_content_updater',
  }),
  accessGrants: many(privateResourceContentAccess),
  files: many(privateResourceContentFiles),
}));

export const privateResourceContentAccessRelations = relations(privateResourceContentAccess, ({ one }) => ({
  content: one(privateResourceContents, {
    fields: [privateResourceContentAccess.contentId],
    references: [privateResourceContents.id],
  }),
  user: one(users, {
    fields: [privateResourceContentAccess.userId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [privateResourceContentAccess.createdByUserId],
    references: [users.id],
    relationName: 'private_resource_content_access_creator',
  }),
}));

export const privateResourceContentFilesRelations = relations(privateResourceContentFiles, ({ one }) => ({
  content: one(privateResourceContents, {
    fields: [privateResourceContentFiles.contentId],
    references: [privateResourceContents.id],
  }),
  uploader: one(users, {
    fields: [privateResourceContentFiles.uploadedByUserId],
    references: [users.id],
    relationName: 'private_resource_content_file_uploader',
  }),
}));

export const resourceTranslationsRelations = relations(resourceTranslations, ({ one }) => ({
  updatedBy: one(users, {
    fields: [resourceTranslations.updatedByUserId],
    references: [users.id],
    relationName: 'resource_translation_updater',
  }),
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
  staffMemberships: many(hardAssetStaffMemberships),
  tags: many(hardAssetTags),    // M:N through hard_asset_tags
}));

export const hardAssetStaffMembershipsRelations = relations(hardAssetStaffMemberships, ({ one }) => ({
  hardAsset: one(hardAssets, {
    fields: [hardAssetStaffMemberships.hardAssetId],
    references: [hardAssets.id],
  }),
  user: one(users, {
    fields: [hardAssetStaffMemberships.userId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [hardAssetStaffMemberships.createdByUserId],
    references: [users.id],
    relationName: 'hard_asset_staff_creator',
  }),
  updater: one(users, {
    fields: [hardAssetStaffMemberships.updatedByUserId],
    references: [users.id],
    relationName: 'hard_asset_staff_updater',
  }),
}));

export const softAssetRegionCoveragesRelations = relations(softAssetRegionCoverages, ({ one }) => ({
  softAsset: one(softAssets, {
    fields: [softAssetRegionCoverages.softAssetId],
    references: [softAssets.id],
  }),
  subregion: one(subregions, {
    fields: [softAssetRegionCoverages.subregionId],
    references: [subregions.id],
  }),
  creator: one(users, {
    fields: [softAssetRegionCoverages.createdByUserId],
    references: [users.id],
    relationName: 'soft_asset_region_coverage_creator',
  }),
}));

export const softAssetStaffMembershipsRelations = relations(softAssetStaffMemberships, ({ one }) => ({
  softAsset: one(softAssets, {
    fields: [softAssetStaffMemberships.softAssetId],
    references: [softAssets.id],
  }),
  user: one(users, {
    fields: [softAssetStaffMemberships.userId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [softAssetStaffMemberships.createdByUserId],
    references: [users.id],
    relationName: 'soft_asset_staff_creator',
  }),
  updater: one(users, {
    fields: [softAssetStaffMemberships.updatedByUserId],
    references: [users.id],
    relationName: 'soft_asset_staff_updater',
  }),
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
  updater: one(users, {
    fields: [softAssets.updatedByUserId],
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
  regionCoverages: many(softAssetRegionCoverages),
  staffMemberships: many(softAssetStaffMemberships),
  groupMembers: many(softAssetGroupMembers, { relationName: 'soft_asset_group_members_group' }),
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
  approvedBy: one(users, {
    fields: [audienceZones.approvedByUserId],
    references: [users.id],
    relationName: 'audience_zone_approver',
  }),
  hardAsset: one(hardAssets, {
    fields: [audienceZones.hardAssetId],
    references: [hardAssets.id],
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

export const softAssetGroupMembersRelations = relations(softAssetGroupMembers, ({ one }) => ({
  groupSoftAsset: one(softAssets, {
    fields: [softAssetGroupMembers.groupSoftAssetId],
    references: [softAssets.id],
    relationName: 'soft_asset_group_members_group',
  }),
  hardAsset: one(hardAssets, {
    fields: [softAssetGroupMembers.memberResourceId],
    references: [hardAssets.id],
    relationName: 'soft_asset_group_members_hard_member',
  }),
  softAsset: one(softAssets, {
    fields: [softAssetGroupMembers.memberResourceId],
    references: [softAssets.id],
    relationName: 'soft_asset_group_members_soft_member',
  }),
  addedBy: one(users, {
    fields: [softAssetGroupMembers.addedByUserId],
    references: [users.id],
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
  shareSnapshot: one(myMapShareSnapshots, {
    fields: [myMaps.id],
    references: [myMapShareSnapshots.mapId],
  }),
}));

export const myMapAssetsRelations = relations(myMapAssets, ({ one, many }) => ({
  map: one(myMaps, {
    fields: [myMapAssets.mapId],
    references: [myMaps.id],
  }),
  notes: many(myMapAssetNotes),
}));

export const myMapAssetNotesRelations = relations(myMapAssetNotes, ({ one }) => ({
  mapAsset: one(myMapAssets, {
    fields: [myMapAssetNotes.mapAssetId],
    references: [myMapAssets.id],
  }),
}));

export const myMapShareSnapshotsRelations = relations(myMapShareSnapshots, ({ one }) => ({
  map: one(myMaps, {
    fields: [myMapShareSnapshots.mapId],
    references: [myMaps.id],
  }),
}));

export const recommendationReviewRecordsRelations = relations(recommendationReviewRecords, ({ one }) => ({
  user: one(users, {
    fields: [recommendationReviewRecords.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [recommendationReviewRecords.reviewerUserId],
    references: [users.id],
    relationName: 'recommendation_reviewer',
  }),
  map: one(myMaps, {
    fields: [recommendationReviewRecords.mapId],
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

export const userPhoneIdentitiesRelations = relations(userPhoneIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userPhoneIdentities.userId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [userPhoneIdentities.createdByUserId],
    references: [users.id],
    relationName: 'user_phone_identity_creator',
  }),
}));

export const phoneVerificationAttemptsRelations = relations(phoneVerificationAttempts, ({ one }) => ({
  user: one(users, {
    fields: [phoneVerificationAttempts.userId],
    references: [users.id],
  }),
}));

export const phoneLoginAttemptsRelations = relations(phoneLoginAttempts, ({ one }) => ({
  resolvedUser: one(users, {
    fields: [phoneLoginAttempts.resolvedUserId],
    references: [users.id],
  }),
}));

export const userConsentRecordsRelations = relations(userConsentRecords, ({ one }) => ({
  user: one(users, {
    fields: [userConsentRecords.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const userOptOutRecordsRelations = relations(userOptOutRecords, ({ one }) => ({
  user: one(users, {
    fields: [userOptOutRecords.userId],
    references: [users.id],
  }),
}));
