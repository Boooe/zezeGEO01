/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { bigint, boolean, date, foreignKey, index, integer, jsonb, numeric, pgSequence, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const geoAiKeyBrandsIdSeq = pgSequence("geo_ai_key_brands_id_seq");

export const geoAiKeysIdSeq = pgSequence("geo_ai_keys_id_seq");

export const geoCreditRequestsIdSeq = pgSequence("geo_credit_requests_id_seq");

export const geoRoles = pgTable("geo_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  /**
   * @type {string[]}
   */
  permissions: jsonb("permissions").notNull().default('[]'),
  isSystem: boolean("is_system").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("geo_roles_code_key").on(table.code),
]);

export const geoOperationLogs = pgTable("geo_operation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: varchar("actor", { length: 100 }).notNull(),
  role: varchar("role", { length: 20 }),
  action: varchar("action", { length: 50 }).notNull(),
  target: varchar("target", { length: 100 }),
  detail: text("detail"),
  ip: varchar("ip", { length: 50 }),
  createdAt: customTimestamptz("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_geo_operation_logs_created_at").on(table.createdAt),
  index("idx_geo_operation_logs_action").on(table.action),
  index("idx_geo_operation_logs_actor").on(table.actor),
]);

export const geoMemberPermissions = pgTable("geo_member_permissions", {
  memberId: uuid("member_id").primaryKey(),
  permissionKey: varchar("permission_key", { length: 50 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.memberId],
    foreignColumns: [geoMembers.id],
    name: "geo_member_permissions_member_id_fkey",
  }).onDelete("cascade"),
]);

export const geoMembers = pgTable("geo_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  role: varchar("role", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  lastLoginAt: customTimestamptz("last_login_at", { precision: 3 }),
  roleId: uuid("role_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_members_username_key").on(table.username),
  foreignKey({
    columns: [table.roleId],
    foreignColumns: [geoRoles.id],
    name: "geo_members_role_id_fkey",
  }),
]);

export const geoPlacementRecords = pgTable("geo_placement_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  orderNo: varchar("order_no", { length: 64 }).notNull(),
  channelId: uuid("channel_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  articleId: uuid("article_id"),
  articleTitle: varchar("article_title", { length: 500 }),
  mediaName: varchar("media_name", { length: 255 }),
  region: varchar("region", { length: 100 }),
  amountCents: integer("amount_cents").notNull().default(0),
  publishedUrl: text("published_url"),
  publishedAt: customTimestamptz("published_at", { precision: 6 }),
  indexStatus: varchar("index_status", { length: 20 }).notNull().default('pending'),
  createdAt: customTimestamptz("created_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz("updated_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_placement_records_order_channel_unique").on(table.orderId, table.channelId),
  index("idx_geo_placement_records_brand_id").on(table.brandId),
  index("idx_geo_placement_records_created_at").on(table.createdAt),
  index("idx_geo_placement_records_index_status").on(table.indexStatus),
]);

export const geoIndexChecks = pgTable("geo_index_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  searchEngine: varchar("search_engine", { length: 20 }).notNull(),
  submittedAt: date("submitted_at").notNull(),
  indexed: varchar("indexed", { length: 10 }).notNull().default('unknown'),
  checkedAt: date("checked_at"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_index_checks_brand").on(table.brandId),
]);

export const geoPageChecks = pgTable("geo_page_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  pageUrl: varchar("page_url", { length: 500 }).notNull(),
  hasJsonld: boolean("has_jsonld").default(false),
  hasFaq: boolean("has_faq").default(false),
  hasAnswerBlock: boolean("has_answer_block").default(false),
  hLevelOk: boolean("h_level_ok").default(false),
  internalLinkCount: integer("internal_link_count").default(0),
  score: integer("score"),
  /**
   * @type { json }
   */
  suggestions: jsonb("suggestions").default('{}'),
  checkedAt: customTimestamptz("checked_at", { precision: 3 }),
  note: text("note"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_page_checks_brand").on(table.brandId),
]);

export const geoExternalLinks = pgTable("geo_external_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  resourceName: varchar("resource_name", { length: 255 }).notNull(),
  resourceType: varchar("resource_type", { length: 20 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  domainWeight: varchar("domain_weight", { length: 10 }),
  linkUrl: varchar("link_url", { length: 500 }),
  submittedAt: date("submitted_at"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  note: text("note"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_external_links_brand").on(table.brandId),
]);

export const geoInternalLinks = pgTable("geo_internal_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  fromUrl: varchar("from_url", { length: 500 }),
  toUrl: varchar("to_url", { length: 500 }),
  anchorText: varchar("anchor_text", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default('planned'),
  note: text("note"),
  fromTitle: varchar("from_title", { length: 255 }),
  toTitle: varchar("to_title", { length: 255 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_internal_links_brand").on(table.brandId),
]);

export const geoDispatchPlans = pgTable("geo_dispatch_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  planDate: date("plan_date").notNull(),
  channelId: uuid("channel_id"),
  articleId: uuid("article_id"),
  status: varchar("status", { length: 20 }).notNull().default('planned'),
  orderId: varchar("order_id", { length: 100 }),
  channelName: varchar("channel_name", { length: 255 }),
  weightTier: varchar("weight_tier", { length: 10 }),
  title: varchar("title", { length: 500 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_dispatch_plans_brand_date").on(table.brandId, table.planDate),
  index("idx_dispatch_plans_status").on(table.status),
]);

export const geoPlatformWeights = pgTable("geo_platform_weights", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id"),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  weightTier: varchar("weight_tier", { length: 10 }).notNull().default('B'),
  indexRate: numeric("index_rate"),
  citationRate: numeric("citation_rate"),
  aiPlatforms: text("ai_platforms").array().default([]),
  collectedAt: date("collected_at"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_platform_weights_domain").on(table.domain),
]);

export const geoActionItems = pgTable("geo_action_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  source: varchar("source", { length: 20 }).notNull().default('auto'),
  title: varchar("title", { length: 200 }).notNull(),
  itemType: varchar("item_type", { length: 20 }).notNull().default('content'),
  priority: varchar("priority", { length: 20 }).notNull().default('medium'),
  ownerUserId: varchar("owner_user_id", { length: 100 }),
  dueDate: date("due_date"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  relatedGapId: uuid("related_gap_id"),
  relatedCheckId: uuid("related_check_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_action_items_brand_id").on(table.brandId),
  index("idx_geo_action_items_priority").on(table.brandId, table.priority),
  index("idx_geo_action_items_status").on(table.status),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_action_items_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoContentGaps = pgTable("geo_content_gaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  keyword: varchar("keyword", { length: 200 }).notNull(),
  ourCited: boolean("our_cited").notNull().default(false),
  ourSourceDomain: varchar("our_source_domain", { length: 200 }),
  competitorName: varchar("competitor_name", { length: 100 }).notNull(),
  competitorDomain: varchar("competitor_domain", { length: 200 }),
  gapType: varchar("gap_type", { length: 50 }).notNull().default('citation'),
  priority: varchar("priority", { length: 20 }).notNull().default('medium'),
  status: varchar("status", { length: 20 }).notNull().default('open'),
  articleId: uuid("article_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_content_gaps_brand_id").on(table.brandId),
  index("idx_geo_content_gaps_keyword").on(table.brandId, table.keyword),
  index("idx_geo_content_gaps_priority").on(table.brandId, table.priority),
  index("idx_geo_content_gaps_status").on(table.status),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_content_gaps_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoContentChecks = pgTable("geo_content_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id").notNull().unique(),
  overallScore: integer("overall_score").notNull().default(0),
  /**
   * @type { title_score: number; intro_score: number; heading_score: number; faq_score: number; citation_score: number; internal_link_score: number; word_count_score: number }
   */
  detail: jsonb("detail").notNull().default('{}'),
  /**
   * @type { items: { type: string; text: string }[] }
   */
  suggestions: jsonb("suggestions").notNull().default('{}'),
  checkedAt: customTimestamptz("checked_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_geo_content_checks_article_id").on(table.articleId),
  index("idx_geo_content_checks_score").on(table.overallScore),
]);

export const geoContentPillars = pgTable("geo_content_pillars", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  pillarTopic: varchar("pillar_topic", { length: 100 }).notNull(),
  subTopic: varchar("sub_topic", { length: 100 }).notNull(),
  coverKeywords: text("cover_keywords").array().notNull().default([]),
  targetQuestion: varchar("target_question", { length: 200 }),
  contentType: varchar("content_type", { length: 50 }).notNull().default('article'),
  status: varchar("status", { length: 20 }).notNull().default('planned'),
  articleId: uuid("article_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_content_pillars_brand_id").on(table.brandId),
  index("idx_geo_content_pillars_pillar").on(table.brandId, table.pillarTopic),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_content_pillars_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoBrandProfiles = pgTable("geo_brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().unique(),
  positioningTagline: varchar("positioning_tagline", { length: 200 }),
  industry: varchar("industry", { length: 100 }),
  targetAudience: text("target_audience"),
  sellingPoints: text("selling_points").array().notNull().default([]),
  forbiddenPhrases: text("forbidden_phrases"),
  topQuestions: text("top_questions").array().notNull().default([]),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_geo_brand_profiles_brand_id").on(table.brandId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_brand_profiles_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoRechargeApplications = pgTable("geo_recharge_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  applyAmountCents: bigint("apply_amount_cents", { mode: 'number' }).notNull(),
  actualAmountCents: bigint("actual_amount_cents", { mode: 'number' }),
  status: varchar("status", { length: 32 }).notNull().default('pending'),
  rejectReason: varchar("reject_reason", { length: 500 }),
  remark: varchar("remark", { length: 500 }),
  auditorId: userProfile("auditor_id"),
  auditedAt: customTimestamptz("audited_at", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_recharge_brand").on(table.brandId),
  index("idx_recharge_status").on(table.status),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_recharge_applications_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoMediaOrders = pgTable("geo_media_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNo: varchar("order_no", { length: 64 }).notNull().unique(),
  brandId: uuid("brand_id").notNull(),
  channelId: uuid("channel_id").notNull(),
  supplierId: uuid("supplier_id"),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  contentUrl: varchar("content_url", { length: 1000 }),
  /**
   * @type { string[] }
   */
  imageUrls: jsonb("image_urls").default('[]'),
  priceCents: integer("price_cents").notNull().default(0),
  costPriceCents: integer("cost_price_cents").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default('pending_payment'),
  supplierOrderNo: varchar("supplier_order_no", { length: 200 }),
  publishedUrl: varchar("published_url", { length: 1000 }),
  rejectReason: varchar("reject_reason", { length: 500 }),
  remark: varchar("remark", { length: 500 }),
  /**
   * @type { {status: string, time: string, operatorId?: string, note?: string}[] }
   */
  timeline: jsonb("timeline").default('[]'),
  articleId: uuid("article_id"),
  source: varchar("source", { length: 32 }).notNull().default('manual'),
  taskId: uuid("task_id"),
  frozenAmountCents: integer("frozen_amount_cents").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_media_orders_order_no_key").on(table.orderNo),
  index("idx_orders_brand").on(table.brandId),
  index("idx_orders_status").on(table.status),
  index("idx_orders_created").on(table.createdAt),
  index("idx_orders_channel").on(table.channelId),
  index("idx_orders_article").on(table.articleId),
  index("idx_orders_task").on(table.taskId),
  index("idx_orders_source").on(table.source),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_media_orders_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.channelId],
    foreignColumns: [geoSubmissionChannels.id],
    name: "geo_media_orders_channel_id_fkey",
  }),
]);

export const geoWalletTransactions = pgTable("geo_wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  amountCents: bigint("amount_cents", { mode: 'number' }).notNull(),
  balanceAfterCents: bigint("balance_after_cents", { mode: 'number' }).notNull(),
  orderId: uuid("order_id"),
  rechargeId: uuid("recharge_id"),
  note: varchar("note", { length: 500 }),
  operatorId: userProfile("operator_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_wallet_tx_wallet").on(table.walletId),
  index("idx_wallet_tx_created").on(table.createdAt),
  foreignKey({
    columns: [table.walletId],
    foreignColumns: [geoCustomerWallets.id],
    name: "geo_wallet_transactions_wallet_id_fkey",
  }).onDelete("cascade"),
]);

export const geoCustomerWallets = pgTable("geo_customer_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().unique(),
  balanceCents: bigint("balance_cents", { mode: 'number' }).notNull().default(0),
  frozenCents: bigint("frozen_cents", { mode: 'number' }).notNull().default(0),
  totalRechargedCents: bigint("total_recharged_cents", { mode: 'number' }).notNull().default(0),
  totalSpentCents: bigint("total_spent_cents", { mode: 'number' }).notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_customer_wallets_brand_id_key").on(table.brandId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_customer_wallets_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoMediaSuppliers = pgTable("geo_media_suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  contact: varchar("contact", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  settlementCycle: varchar("settlement_cycle", { length: 50 }),
  apiBase: varchar("api_base", { length: 500 }),
  apiKey: varchar("api_key", { length: 500 }),
  status: varchar("status", { length: 32 }).default('active'),
  markupRate: numeric("markup_rate").default('0.2'),
  note: text("note"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const geoSourceDomainMap = pgTable("geo_source_domain_map", {
  keyword: text("keyword").primaryKey(),
  domain: text("domain").notNull(),
  priority: integer("priority").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const geoSourceUrlLogs = pgTable("geo_source_url_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  operatorId: uuid("operator_id").notNull(),
  operatorName: varchar("operator_name", { length: 100 }).notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  unmatchedCount: integer("unmatched_count").notNull().default(0),
  ambiguousCount: integer("ambiguous_count").notNull().default(0),
  unmatchedItems: jsonb("unmatched_items").notNull().default('[]'),
  mode: varchar("mode", { length: 50 }).notNull().default('manual'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_source_url_logs_created_at").on(table.createdAt),
]);

export const geoSourceTagLogs = pgTable("geo_source_tag_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  operatorId: uuid("operator_id").notNull(),
  operatorName: varchar("operator_name", { length: 100 }).notNull(),
  scope: varchar("scope", { length: 20 }).notNull().default('selection'),
  targetCount: integer("target_count").notNull().default(0),
  platforms: text("platforms").array().notNull().default([]),
  mediaType: varchar("media_type", { length: 30 }),
  imagePrice: numeric("image_price"),
  videoPrice: numeric("video_price"),
  quotaTotal: integer("quota_total"),
  followers: bigint("followers", { mode: 'number' }),
  likes: bigint("likes", { mode: 'number' }),
  mode: varchar("mode", { length: 20 }).notNull().default('append'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_source_tag_logs_created_at").on(table.createdAt),
]);

export const geoCitationProbeResults = pgTable("geo_citation_probe_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id"),
  brandId: uuid("brand_id").notNull(),
  question: text("question").notNull(),
  platform: varchar("platform", { length: 30 }).notNull(),
  isMentioned: boolean("is_mentioned").notNull().default(false),
  mentionPosition: integer("mention_position"),
  sourceUrls: text("source_urls").array().notNull().default([]),
  rawAnswer: text("raw_answer"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  error: text("error"),
  executedAt: customTimestamptz("executed_at", { precision: 3 }),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_geo_citation_probe_results_task").on(table.taskId),
  index("idx_geo_citation_probe_results_brand").on(table.brandId),
  index("idx_geo_citation_probe_results_platform").on(table.platform),
  index("idx_geo_citation_probe_results_status").on(table.status),
]);

export const geoCitationProbeTasks = pgTable("geo_citation_probe_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  brandName: varchar("brand_name", { length: 200 }).notNull(),
  brandAliases: text("brand_aliases").array().notNull().default([]),
  keywordIds: uuid("keyword_ids").array().notNull().default([]),
  keywords: text("keywords").array().notNull().default([]),
  platforms: text("platforms").array().notNull().default([]),
  questions: text("questions").array().notNull().default([]),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  totalCount: integer("total_count").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  error: text("error"),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_geo_citation_probe_tasks_brand").on(table.brandId),
  index("idx_geo_citation_probe_tasks_status").on(table.status),
  index("idx_geo_citation_probe_tasks_created").on(table.createdAt),
]);

export const geoAiKeyBrands = pgTable("geo_ai_key_brands", {
  id: integer("id").primaryKey().default(sql`nextval('geo_ai_key_brands_id_seq'::regclass)`),
  brandId: text("brand_id").notNull(),
  vendor: text("vendor").notNull(),
  model: text("model"),
  baseUrl: text("base_url"),
  apiKey: text("api_key"),
  isDefault: boolean("is_default").default(false),
  status: text("status").default('unconfigured'),
  lastTestedAt: customTimestamptz("last_tested_at", { precision: 6 }),
  lastTestError: text("last_test_error"),
  createdAt: customTimestamptz("created_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz("updated_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_geo_ai_key_brands_brand_vendor").on(table.brandId, table.vendor),
  index("idx_geo_ai_key_brands_brand").on(table.brandId),
]);

export const geoAccountAuths = pgTable("geo_account_auths", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  accountName: varchar("account_name", { length: 200 }).notNull(),
  accountIdentifier: varchar("account_identifier", { length: 200 }),
  authMethod: varchar("auth_method", { length: 30 }).notNull().default('qr_code'),
  authStatus: varchar("auth_status", { length: 20 }).notNull().default('unauthorized'),
  lastAuthAt: customTimestamptz("last_auth_at", { precision: 3 }),
  lastHeartbeatAt: customTimestamptz("last_heartbeat_at", { precision: 3 }),
  authCode: varchar("auth_code", { length: 10 }),
  authCodeExpiresAt: customTimestamptz("auth_code_expires_at", { precision: 3 }),
  clientVersion: varchar("client_version", { length: 50 }),
  remark: text("remark"),
  clientToken: varchar("client_token", { length: 255 }),
  authMode: varchar("auth_mode", { length: 20 }).notNull().default('qr'),
  sessionState: varchar("session_state", { length: 20 }).notNull().default('valid'),
  sessionExpiresAt: customTimestamptz("session_expires_at", { precision: 3 }),
  sessionHash: varchar("session_hash", { length: 255 }),
  authCodePlain: varchar("auth_code_plain", { length: 12 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_geo_account_auths_brand").on(table.brandId),
  index("idx_geo_account_auths_platform").on(table.platform),
  index("idx_geo_account_auths_status").on(table.authStatus),
  index("idx_geo_account_auths_code").on(table.authCode),
  index("idx_geo_account_auths_client_token").on(table.clientToken),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_account_auths_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoLongtailConfigs = pgTable("geo_longtail_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  groupId: uuid("group_id"),
  configType: varchar("config_type", { length: 20 }).notNull().default('prefix'),
  words: text("words").array().notNull().default([]),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX idx_geo_longtail_configs_brand_group_type ON geo_longtail_configs USING btree (brand_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), config_type),
  index("idx_geo_longtail_configs_brand").on(table.brandId),
]);

export const geoAutoPublishTasks = pgTable("geo_auto_publish_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  taskName: varchar("task_name", { length: 200 }).notNull(),
  libraryType: varchar("library_type", { length: 20 }).notNull().default('public_private'),
  channelIds: uuid("channel_ids").array().notNull().default([]),
  articleIds: uuid("article_ids").array().notNull().default([]),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  dailyLimit: integer("daily_limit").notNull().default(10),
  status: varchar("status", { length: 20 }).notNull().default('running'),
  publishedCount: integer("published_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  error: text("error"),
  creatorId: uuid("creator_id").notNull(),
  /**
   * @type { platforms: string[]; region: string; industry: string; mediaType: string; budgetMax: number }
   */
  sourceRule: jsonb("source_rule").default('{}'),
  sourceSelectionMode: varchar("source_selection_mode", { length: 20 }).notNull().default('manual'),
  channelSource: varchar("channel_source", { length: 20 }).notNull().default('self_media'),
  marketChannelIds: uuid("market_channel_ids").array().notNull().default([]),
  budgetCents: integer("budget_cents").notNull().default(0),
  publishIntervalMinutes: integer("publish_interval_minutes").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_auto_publish_tasks_brand").on(table.brandId),
  index("idx_geo_auto_publish_tasks_status").on(table.status),
  index("idx_geo_auto_publish_tasks_creator").on(table.creatorId),
]);

export const geoKeywordIndexLogs = pgTable("geo_keyword_index_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  keywordId: uuid("keyword_id").notNull(),
  keywordText: varchar("keyword_text", { length: 200 }).notNull(),
  source: varchar("source", { length: 20 }).notNull(),
  value: integer("value").notNull(),
  period: varchar("period", { length: 10 }).notNull().default('30d'),
  collectedAt: date("collected_at").notNull().default('CURRENT_DATE'),
  screenshotUrl: text("screenshot_url").notNull(),
  ocrText: text("ocr_text"),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_keyword_index_logs_keyword").on(table.keywordId),
  index("idx_geo_keyword_index_logs_keyword_source").on(table.keywordId, table.source),
]);

export const geoAiDetectResults = pgTable("geo_ai_detect_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  keyword: varchar("keyword", { length: 200 }).notNull(),
  platform: varchar("platform", { length: 30 }).notNull(),
  modelName: varchar("model_name", { length: 100 }).notNull(),
  question: text("question").notNull(),
  rawAnswer: text("raw_answer"),
  isMentioned: boolean("is_mentioned").notNull().default(false),
  mentionRank: integer("mention_rank"),
  mentionPosition: varchar("mention_position", { length: 50 }),
  competitorBrands: varchar("competitor_brands", { length: 200 }).array().notNull().default([]),
  sourceDomains: varchar("source_domains", { length: 200 }).array().notNull().default([]),
  latencyMs: integer("latency_ms"),
  httpStatus: integer("http_status"),
  errorMessage: text("error_message"),
  executedAt: customTimestamptz("executed_at", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_ai_detect_results_task").on(table.taskId),
  index("idx_geo_ai_detect_results_brand").on(table.brandId),
  index("idx_geo_ai_detect_results_keyword").on(table.keyword),
  index("idx_geo_ai_detect_results_platform").on(table.platform),
  foreignKey({
    columns: [table.taskId],
    foreignColumns: [geoAiDetectTasks.id],
    name: "geo_ai_detect_results_task_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_ai_detect_results_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoAiDetectTasks = pgTable("geo_ai_detect_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  brandName: varchar("brand_name", { length: 200 }).notNull(),
  keywords: text("keywords").array().notNull().default([]),
  platforms: varchar("platforms", { length: 30 }).array().notNull().default([]),
  concurrency: integer("concurrency").notNull().default(3),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  totalCount: integer("total_count").notNull().default(0),
  doneCount: integer("done_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  error: text("error"),
  creatorId: uuid("creator_id").notNull(),
  startedAt: customTimestamptz("started_at", { precision: 3 }),
  completedAt: customTimestamptz("completed_at", { precision: 3 }),
  hitWords: varchar("hit_words", { length: 100 }).array().notNull().default(sql`{}'::character varying(100)[]`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_ai_detect_tasks_brand").on(table.brandId),
  index("idx_geo_ai_detect_tasks_status").on(table.status),
  index("idx_geo_ai_detect_tasks_creator").on(table.creatorId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_ai_detect_tasks_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_ai_detect_tasks_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoCreditRequests = pgTable("geo_credit_requests", {
  id: integer("id").primaryKey().default(sql`nextval('geo_credit_requests_id_seq'::regclass)`),
  brandId: uuid("brand_id"),
  package: text("package"),
  amount: integer("amount"),
  status: text("status").default('pending'),
  createdAt: customTimestamptz("created_at", { precision: 6 }).default(sql`now()`),
  processedAt: customTimestamptz("processed_at", { precision: 6 }),
  processedBy: text("processed_by"),
  rejectReason: varchar("reject_reason", { length: 500 }),
}, (table) => [
  index("idx_geo_credit_requests_status").on(table.status),
  index("idx_geo_credit_requests_brand").on(table.brandId),
]);

export const geoAiKeys = pgTable("geo_ai_keys", {
  id: integer("id").primaryKey().default(sql`nextval('geo_ai_keys_id_seq'::regclass)`),
  ownerType: text("owner_type").notNull().default('client'),
  ownerId: text("owner_id"),
  vendor: text("vendor").notNull(),
  model: text("model"),
  baseUrl: text("base_url"),
  apiKey: text("api_key"),
  isDefault: boolean("is_default").default(false),
  status: text("status").default('unconfigured'),
  lastTestedAt: customTimestamptz("last_tested_at", { precision: 6 }),
  createdAt: customTimestamptz("created_at", { precision: 6 }).default(sql`now()`),
  updatedAt: customTimestamptz("updated_at", { precision: 6 }).default(sql`now()`),
  lastTestError: text("last_test_error"),
}, (table) => [
  index("idx_geo_ai_keys_owner").on(table.ownerType, table.ownerId),
  uniqueIndex("idx_geo_ai_keys_owner_vendor").on(table.ownerType, table.ownerId, table.vendor),
]);

export const geoAiPlatformStats = pgTable("geo_ai_platform_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  platformName: varchar("platform_name", { length: 100 }).notNull(),
  dauMillion: numeric("dau_million").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_ai_platform_stats_sort").on(table.sortOrder, table.createdAt),
]);

export const geoIndustryNews = pgTable("geo_industry_news", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  summary: text("summary").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  newsDate: date("news_date").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  publishDate: date("publish_date"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_industry_news_sort").on(table.sortOrder, table.createdAt),
  index("idx_geo_industry_news_publish_date").on(table.publishDate, table.sortOrder),
]);

export const geoComplianceChecks = pgTable("geo_compliance_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id"),
  articleId: uuid("article_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default('pass'),
  /**
   * @type { word: string, category: string, suggestion: string, position: number, level?: string }[]
   */
  hits: jsonb("hits").notNull().default('[]'),
  totalHits: integer("total_hits").notNull().default(0),
  checkedAt: customTimestamptz("checked_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_compliance_checks_brand").on(table.brandId),
  index("idx_geo_compliance_checks_article").on(table.articleId),
  index("idx_geo_compliance_checks_creator").on(table.creatorId),
  index("idx_geo_compliance_checks_risk").on(table.riskLevel),
]);

export const geoSubmissionQueue = pgTable("geo_submission_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  articleId: uuid("article_id"),
  channelId: uuid("channel_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content"),
  tags: text("tags").array().notNull().default([]),
  coverUrl: text("cover_url"),
  wordCount: integer("word_count").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default('pending'),
  submitUrl: text("submit_url"),
  indexedUrl: text("indexed_url"),
  indexedAt: customTimestamptz("indexed_at", { precision: 6 }),
  rejectReason: text("reject_reason"),
  rejectCategory: varchar("reject_category", { length: 30 }),
  screenshotUrl: text("screenshot_url"),
  errorMessage: text("error_message"),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_submission_queue_brand").on(table.brandId),
  index("idx_submission_queue_status").on(table.status),
  index("idx_submission_queue_channel").on(table.channelId),
  index("idx_submission_queue_created").on(table.createdAt),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_submission_queue_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.channelId],
    foreignColumns: [geoSubmissionChannels.id],
    name: "geo_submission_queue_channel_id_fkey",
  }).onDelete("cascade"),
]);

export const geoSubmissionChannels = pgTable("geo_submission_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id"),
  name: varchar("name", { length: 100 }).notNull(),
  channelType: varchar("channel_type", { length: 30 }).notNull().default('public'),
  submitUrl: text("submit_url"),
  needAccount: boolean("need_account").notNull().default(false),
  costPerArticle: numeric("cost_per_article").notNull().default('0'),
  dailyLimit: integer("daily_limit").notNull().default(3),
  reviewHours: integer("review_hours").notNull().default(24),
  industries: text("industries").array().notNull().default([]),
  requiredFields: text("required_fields").array().notNull().default([]),
  aiSources: text("ai_sources").array().notNull().default([]),
  accountName: varchar("account_name", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  submittedCount: integer("submitted_count").notNull().default(0),
  indexedCount: integer("indexed_count").notNull().default(0),
  remark: text("remark"),
  ownerType: varchar("owner_type", { length: 20 }).notNull().default('brand'),
  ownerId: uuid("owner_id"),
  usageType: varchar("usage_type", { length: 50 }),
  source: varchar("source", { length: 32 }).notNull().default('manual'),
  platformCoverage: text("platform_coverage").array().notNull().default([]),
  indexRate: integer("index_rate").notNull().default(0),
  citeRate: integer("cite_rate").notNull().default(0),
  lastCiteAt: customTimestamptz("last_cite_at", { precision: 3 }),
  citeSnapshots: integer("cite_snapshots").notNull().default(0),
  tier: varchar("tier", { length: 10 }).notNull().default('C'),
  indexStatus: varchar("index_status", { length: 20 }).notNull().default('pending'),
  libraryType: varchar("library_type", { length: 30 }).notNull().default('public'),
  region: varchar("region", { length: 50 }).notNull().default('全国'),
  aiPlatforms: text("ai_platforms").array().notNull().default([]),
  mediaType: varchar("media_type", { length: 20 }).notNull().default('image_text'),
  quotaTotal: integer("quota_total"),
  quotaUsed: integer("quota_used").notNull().default(0),
  followers: bigint("followers", { mode: 'number' }),
  likes: bigint("likes", { mode: 'number' }),
  imagePrice: numeric("image_price"),
  videoPrice: numeric("video_price"),
  description: text("description"),
  supplierId: uuid("supplier_id"),
  costPriceCents: integer("cost_price_cents").default(0),
  salePriceCents: integer("sale_price_cents").default(0),
  priceUnit: varchar("price_unit", { length: 32 }).default('article'),
  stock: integer("stock").default(0),
  turnaroundHours: integer("turnaround_hours").default(0),
  priceUpdatedAt: customTimestamptz("price_updated_at", { precision: 3 }),
  sellable: boolean("sellable").default(false),
  salePriceOverridden: boolean("sale_price_overridden").default(false),
  sourceType: varchar("source_type", { length: 20 }).notNull().default('supplier'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_submission_channels_brand").on(table.brandId),
  index("idx_submission_channels_status").on(table.status),
  index("idx_submission_channels_type").on(table.channelType),
  index("idx_submission_channels_owner").on(table.ownerType, table.ownerId),
  index("idx_submission_channels_library_type").on(table.libraryType),
  index("idx_submission_channels_region").on(table.region),
  index("idx_submission_channels_media_type").on(table.mediaType),
  index("idx_geo_submission_channels_source_type").on(table.sourceType),
]);

export const geoPublishQueue = pgTable("geo_publish_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  articleId: uuid("article_id"),
  channelId: uuid("channel_id"),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  coverUrl: text("cover_url"),
  tags: text("tags").array().default([]),
  mode: varchar("mode", { length: 30 }).notNull().default('local_auto'),
  status: varchar("status", { length: 30 }).notNull().default('pending'),
  publishUrl: text("publish_url"),
  publishedAt: customTimestamptz("published_at", { precision: 3 }),
  error: text("error"),
  screenshotUrl: text("screenshot_url"),
  wordCount: integer("word_count").default(0),
  source: varchar("source", { length: 30 }).default('queue_auto'),
  taskId: uuid("task_id"),
  accountId: uuid("account_id"),
  clientClaimedAt: customTimestamptz("client_claimed_at", { precision: 3 }),
  scheduledDate: date("scheduled_date"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_publish_queue_brand").on(table.brandId),
  index("idx_geo_publish_queue_status").on(table.status),
  index("idx_geo_publish_queue_channel").on(table.channelId),
  index("idx_geo_publish_queue_created").on(table.createdAt),
  index("idx_geo_publish_queue_account").on(table.accountId),
  index("idx_geo_publish_queue_scheduled_date").on(table.scheduledDate),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_publish_queue_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.articleId],
    foreignColumns: [geoArticles.id],
    name: "geo_publish_queue_article_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.channelId],
    foreignColumns: [geoSubmissionChannels.id],
    name: "geo_publish_queue_channel_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.accountId],
    foreignColumns: [geoAccountAuths.id],
    name: "geo_publish_queue_account_id_fkey",
  }).onDelete("set null"),
]);

export const geoChannels = pgTable("geo_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  accountName: varchar("account_name", { length: 200 }).notNull(),
  publishMode: varchar("publish_mode", { length: 30 }).notNull().default('local_auto'),
  dailyLimit: integer("daily_limit").notNull().default(3),
  todayPublished: integer("today_published").notNull().default(0),
  bindStatus: varchar("bind_status", { length: 20 }).notNull().default('unbound'),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  lastPublishedAt: customTimestamptz("last_published_at", { precision: 3 }),
  config: jsonb("config").default('{}'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_channels_brand").on(table.brandId),
  index("idx_geo_channels_platform").on(table.platform),
  index("idx_geo_channels_status").on(table.status),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_channels_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoDiagnosisResults = pgTable("geo_diagnosis_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  reportId: uuid("report_id"),
  question: text("question").notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  isMentioned: boolean("is_mentioned").notNull().default(false),
  mentionPosition: varchar("mention_position", { length: 20 }),
  sentiment: varchar("sentiment", { length: 20 }).default('neutral'),
  otherBrands: text("other_brands").array().default([]),
  rawAnswer: text("raw_answer"),
  answerSummary: text("answer_summary"),
  error: text("error"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  creatorId: uuid("creator_id").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_diagnosis_results_task").on(table.taskId),
  index("idx_geo_diagnosis_results_report").on(table.reportId),
  index("idx_geo_diagnosis_results_platform").on(table.platform),
  foreignKey({
    columns: [table.taskId],
    foreignColumns: [geoDiagnosisTasks.id],
    name: "geo_diagnosis_results_task_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.reportId],
    foreignColumns: [geoDiagnosisReports.id],
    name: "geo_diagnosis_results_report_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_diagnosis_results_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoAccountProfiles = pgTable("geo_account_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  companyName: varchar("company_name", { length: 200 }),
  industry: varchar("industry", { length: 100 }),
  region: varchar("region", { length: 100 }),
  contactName: varchar("contact_name", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_account_profiles_user_id_key").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [geoUsers.id],
    name: "geo_account_profiles_user_id_fkey",
  }).onDelete("cascade"),
]);

export const geoSiteNetwork = pgTable("geo_site_network", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  siteName: varchar("site_name", { length: 200 }).notNull(),
  domain: varchar("domain", { length: 500 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  cmsType: varchar("cms_type", { length: 50 }),
  notes: text("notes"),
  creatorId: uuid("creator_id").notNull(),
  siteType: varchar("site_type", { length: 20 }).notNull().default('enterprise'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_site_network_brand").on(table.brandId),
  index("idx_geo_site_network_status").on(table.status),
  index("idx_geo_site_network_type").on(table.siteType),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_site_network_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_site_network_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoTdkTemplates = pgTable("geo_tdk_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  titleTemplate: text("title_template").notNull(),
  descriptionTemplate: text("description_template").notNull(),
  keywordsTemplate: text("keywords_template").notNull(),
  pageType: varchar("page_type", { length: 50 }),
  isDefault: boolean("is_default").default(false),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_tdk_templates_brand").on(table.brandId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_tdk_templates_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_tdk_templates_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoWebsiteSettings = pgTable("geo_website_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().unique(),
  domain: varchar("domain", { length: 500 }),
  siteName: varchar("site_name", { length: 200 }),
  siteDescription: text("site_description"),
  /**
   * @type { phone: string, email: string, address: string }
   */
  contactInfo: jsonb("contact_info").default('{}'),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("geo_website_settings_brand_id_key").on(table.brandId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_website_settings_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_website_settings_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoKnowledgeBase = pgTable("geo_knowledge_base", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id"),
  category: varchar("category", { length: 100 }).default('general'),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  tags: text("tags").array().default([]),
  isActive: boolean("is_active").default(true),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_knowledge_base_brand").on(table.brandId),
  index("idx_geo_knowledge_base_category").on(table.category),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_knowledge_base_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_knowledge_base_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoPublishRecords = pgTable("geo_publish_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  taskId: uuid("task_id"),
  contentType: varchar("content_type", { length: 20 }).notNull().default('article'),
  title: varchar("title", { length: 200 }),
  externalUrl: varchar("external_url", { length: 500 }),
  platform: varchar("platform", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  publishDate: customTimestamptz("publish_date", { precision: 3 }),
  notes: text("notes"),
  creatorId: uuid("creator_id").notNull(),
  accountId: uuid("account_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_publish_records_brand").on(table.brandId),
  index("idx_geo_publish_records_status").on(table.status),
  index("idx_geo_publish_records_account").on(table.accountId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_publish_records_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.taskId],
    foreignColumns: [geoCreationTasks.id],
    name: "geo_publish_records_task_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_publish_records_creator_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.accountId],
    foreignColumns: [geoAccountAuths.id],
    name: "geo_publish_records_account_id_fkey",
  }).onDelete("set null"),
]);

export const geoKeywordPool = pgTable("geo_keyword_pool", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  keyword: varchar("keyword", { length: 100 }).notNull(),
  keywordType: varchar("keyword_type", { length: 20 }).notNull().default('longtail'),
  groupId: uuid("group_id"),
  source: varchar("source", { length: 50 }).default('manual'),
  searchVolume: integer("search_volume"),
  competition: numeric("competition"),
  addedAt: customTimestamptz("added_at", { precision: 3 }),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_keyword_pool_brand").on(table.brandId),
  index("idx_geo_keyword_pool_keyword").on(table.keyword),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_keyword_pool_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.groupId],
    foreignColumns: [geoKeywordGroups.id],
    name: "geo_keyword_pool_group_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_keyword_pool_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoDiagnosisReports = pgTable("geo_diagnosis_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  overallScore: integer("overall_score").default(0),
  seoScore: integer("seo_score").default(0),
  contentScore: integer("content_score").default(0),
  keywordScore: integer("keyword_score").default(0),
  /**
   * @type { summary: string, visibility: { hitQuestions: number, totalQuestions: number, hitRate: number }, ranking: { avgPosition: string, firstCount: number, top3Count: number }, coverage: { coveredTypes: string[], totalTypes: number, typeDetails: { type: string, label: string, hitCount: number, totalCount: number }[] }, citation: { citedSources: string[], sourceCount: number }, recommendations: { title: string, detail: string, priority: string }[] }
   */
  reportData: jsonb("report_data").notNull().default('{}'),
  shareToken: varchar("share_token", { length: 100 }).unique(),
  shareExpiresAt: customTimestamptz("share_expires_at", { precision: 3 }),
  creatorId: uuid("creator_id").notNull(),
  visibilityScore: integer("visibility_score").default(0),
  rankingScore: integer("ranking_score").default(0),
  coverageScore: integer("coverage_score").default(0),
  citationScore: integer("citation_score").default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_diagnosis_reports_brand").on(table.brandId),
  index("idx_geo_diagnosis_reports_task").on(table.taskId),
  uniqueIndex("idx_geo_diagnosis_reports_share").on(table.shareToken),
  foreignKey({
    columns: [table.taskId],
    foreignColumns: [geoDiagnosisTasks.id],
    name: "geo_diagnosis_reports_task_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_diagnosis_reports_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_diagnosis_reports_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoDiagnosisTasks = pgTable("geo_diagnosis_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id"),
  brandName: varchar("brand_name", { length: 200 }).notNull(),
  website: varchar("website", { length: 500 }),
  industry: varchar("industry", { length: 100 }),
  coreKeywords: text("core_keywords").array().default([]),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  reportId: uuid("report_id"),
  error: text("error"),
  creatorId: uuid("creator_id").notNull(),
  city: varchar("city", { length: 100 }),
  category: varchar("category", { length: 100 }),
  platforms: text("platforms").array().default([]),
  competitors: text("competitors").array().default([]),
  questions: text("questions").array().default([]),
  brandAliases: text("brand_aliases").array().notNull().default([]),
  brandIntro: text("brand_intro"),
  /**
   * @type { name: string }[]
   */
  products: jsonb("products").notNull().default('[]'),
  totalCount: integer("total_count").default(0),
  completedCount: integer("completed_count").default(0),
  failedCount: integer("failed_count").default(0),
  skippedCount: integer("skipped_count").default(0),
  startedAt: customTimestamptz("started_at", { precision: 6 }),
  finishedAt: customTimestamptz("finished_at", { precision: 6 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_diagnosis_tasks_brand").on(table.brandId),
  index("idx_geo_diagnosis_tasks_status").on(table.status),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_diagnosis_tasks_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_diagnosis_tasks_creator_id_fkey",
  }).onDelete("cascade"),
]);

export const geoCreationTasks = pgTable("geo_creation_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  creatorId: uuid("creator_id").notNull(),
  taskType: varchar("task_type", { length: 20 }).notNull().default('image'),
  taskName: varchar("task_name", { length: 200 }).notNull(),
  title: varchar("title", { length: 200 }),
  content: text("content"),
  keywords: text("keywords").array().default([]),
  longtailKeywords: text("longtail_keywords").array().default([]),
  groupId: uuid("group_id"),
  tags: text("tags").array().default([]),
  ratio: varchar("ratio", { length: 20 }).default('1:1'),
  duration: varchar("duration", { length: 20 }),
  resolution: varchar("resolution", { length: 20 }).default('hd'),
  subtitleEnabled: boolean("subtitle_enabled").default(false),
  subtitleStyle: varchar("subtitle_style", { length: 50 }),
  bgmUrl: text("bgm_url"),
  bgmVolume: integer("bgm_volume").default(50),
  voiceId: varchar("voice_id", { length: 100 }),
  voiceName: varchar("voice_name", { length: 100 }),
  originalAudioEnabled: boolean("original_audio_enabled").default(true),
  imageMode: varchar("image_mode", { length: 20 }).default('ai_generate'),
  imagePrompt: text("image_prompt"),
  imageCount: integer("image_count").default(1),
  referenceImages: text("reference_images").array().default([]),
  materialImageIds: uuid("material_image_ids").array().default([]),
  uploadedImageUrls: text("uploaded_image_urls").array().default([]),
  videoPrompt: text("video_prompt"),
  videoReferenceImages: text("video_reference_images").array().default([]),
  videoMaterialId: uuid("video_material_id"),
  resultImages: text("result_images").array().default([]),
  resultVideoUrl: text("result_video_url"),
  resultCoverUrl: text("result_cover_url"),
  externalTaskId: varchar("external_task_id", { length: 200 }),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  error: text("error"),
  costCredits: integer("cost_credits").notNull().default(0),
  durationMs: integer("duration_ms"),
  startedAt: customTimestamptz("started_at", { precision: 3 }),
  completedAt: customTimestamptz("completed_at", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_creation_tasks_brand").on(table.brandId),
  index("idx_geo_creation_tasks_type").on(table.taskType),
  index("idx_geo_creation_tasks_status").on(table.status),
  index("idx_geo_creation_tasks_creator").on(table.creatorId),
  index("idx_geo_creation_tasks_created").on(table.createdAt),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_creation_tasks_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_creation_tasks_creator_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.groupId],
    foreignColumns: [geoKeywordGroups.id],
    name: "geo_creation_tasks_group_id_fkey",
  }).onDelete("set null"),
]);

export const geoKeywordGroups = pgTable("geo_keyword_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_keyword_groups_brand").on(table.brandId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_keyword_groups_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoCommitmentSignatures = pgTable("geo_commitment_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  versionId: uuid("version_id").notNull(),
  versionCode: varchar("version_code", { length: 20 }).notNull(),
  signMethod: varchar("sign_method", { length: 20 }).notNull().default('checkbox'),
  clientIp: varchar("client_ip", { length: 50 }),
  userAgent: text("user_agent"),
  signedAt: customTimestamptz("signed_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  needsResign: boolean("needs_resign").notNull().default(false),
  lastRemindedAt: customTimestamptz("last_reminded_at", { precision: 3 }),
  remindCount: integer("remind_count").notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_geo_commitment_signatures_user").on(table.userId),
  index("idx_geo_commitment_signatures_brand").on(table.brandId),
  index("idx_geo_commitment_signatures_version").on(table.versionId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [geoUsers.id],
    name: "geo_commitment_signatures_user_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_commitment_signatures_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.versionId],
    foreignColumns: [geoCommitmentVersions.id],
    name: "geo_commitment_signatures_version_id_fkey",
  }),
]);

export const geoCommitmentVersions = pgTable("geo_commitment_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionCode: varchar("version_code", { length: 20 }).notNull().unique(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("idx_geo_commitment_versions_code").on(table.versionCode),
]);

export const geoCreditPlans = pgTable("geo_credit_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  planName: varchar("plan_name", { length: 100 }).notNull(),
  planCode: varchar("plan_code", { length: 50 }).notNull().unique(),
  price: numeric("price").notNull().default('0'),
  creditAmount: numeric("credit_amount").notNull().default('0'),
  description: varchar("description", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  validityMonths: integer("validity_months").notNull().default(12),
  unitPrice: numeric("unit_price").notNull().default('0'),
  dailyPublishLimit: integer("daily_publish_limit").notNull().default(10),
  dailyDiagnosisRecommendLimit: integer("daily_diagnosis_recommend_limit").notNull().default(20),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("geo_credit_plans_plan_code_key").on(table.planCode),
  index("idx_geo_credit_plans_active").on(table.isActive),
  index("idx_geo_credit_plans_sort").on(table.sortOrder),
]);

export const geoPublicationRecords = pgTable("geo_publication_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: varchar("content_type", { length: 20 }).notNull(),
  contentId: uuid("content_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  mediaLibrary: varchar("media_library", { length: 100 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  scheduledAt: customTimestamptz("scheduled_at", { precision: 6 }),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  publishUrl: text("publish_url"),
  remark: text("remark"),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_geo_publication_records_brand_id").on(table.brandId),
  index("idx_geo_publication_records_content_type").on(table.contentType),
  index("idx_geo_publication_records_status").on(table.status),
  index("idx_geo_publication_records_platform").on(table.platform),
  index("idx_geo_publication_records_created_at").on(table.createdAt),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_publication_records_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoImageServiceConfig = pgTable("geo_image_service_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiUrl: varchar("api_url", { length: 500 }).notNull(),
  apiKey: varchar("api_key", { length: 200 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const geoVideoServiceConfig = pgTable("geo_video_service_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiUrl: varchar("api_url", { length: 500 }).notNull(),
  apiKey: varchar("api_key", { length: 200 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  callbackUrl: varchar("callback_url", { length: 500 }),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const geoVideoTasks = pgTable("geo_video_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  taskName: varchar("task_name", { length: 200 }).notNull(),
  topic: text("topic").notNull(),
  duration: varchar("duration", { length: 20 }).notNull().default('30s'),
  ratio: varchar("ratio", { length: 20 }).notNull().default('9:16'),
  coverImage: text("cover_image"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  externalTaskId: varchar("external_task_id", { length: 100 }),
  videoUrl: text("video_url"),
  videoCoverUrl: text("video_cover_url"),
  costCredits: numeric("cost_credits").notNull().default('0'),
  error: text("error"),
  creatorId: uuid("creator_id").notNull(),
  purpose: varchar("purpose", { length: 50 }).notNull().default('store_intro'),
  style: varchar("style", { length: 50 }),
  scriptText: text("script_text"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_video_tasks_brand").on(table.brandId),
  index("idx_geo_video_tasks_status").on(table.status),
  index("idx_geo_video_tasks_creator").on(table.creatorId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_video_tasks_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_video_tasks_creator_id_fkey",
  }),
]);

export const geoCreditTransactions = pgTable("geo_credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  changeAmount: numeric("change_amount").notNull(),
  balanceAfter: numeric("balance_after").notNull(),
  transactionType: varchar("transaction_type", { length: 30 }).notNull(),
  relatedType: varchar("related_type", { length: 30 }),
  relatedId: uuid("related_id"),
  description: varchar("description", { length: 500 }),
  operatorId: uuid("operator_id"),
  planId: uuid("plan_id"),
  paymentAmount: numeric("payment_amount"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_credit_tx_brand").on(table.brandId),
  index("idx_geo_credit_tx_type").on(table.transactionType),
  index("idx_geo_credit_tx_related").on(table.relatedType, table.relatedId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_credit_transactions_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.operatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_credit_transactions_operator_id_fkey",
  }),
]);

export const geoCreditAccounts = pgTable("geo_credit_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().unique(),
  balance: numeric("balance").notNull().default('0'),
  totalUsed: numeric("total_used").notNull().default('0'),
  currentPlanId: uuid("current_plan_id"),
  planExpiresAt: customTimestamptz("plan_expires_at", { precision: 3 }),
  totalRecharged: numeric("total_recharged").notNull().default('0'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_credit_accounts_brand_id_key").on(table.brandId),
  index("idx_geo_credit_accounts_brand").on(table.brandId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_credit_accounts_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoMaterialGroups = pgTable("geo_material_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  groupType: varchar("group_type", { length: 20 }).notNull().default('image'),
  creatorId: uuid("creator_id").notNull(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_material_groups_brand").on(table.brandId),
  index("idx_geo_material_groups_type").on(table.groupType),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_material_groups_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_material_groups_creator_id_fkey",
  }),
]);

export const geoMaterials = pgTable("geo_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id"),
  groupId: uuid("group_id"),
  materialType: varchar("material_type", { length: 20 }).notNull().default('image'),
  name: varchar("name", { length: 200 }).notNull(),
  filePath: text("file_path"),
  bucketId: varchar("bucket_id", { length: 100 }),
  fileSize: bigint("file_size", { mode: 'number' }).notNull().default(0),
  mimeType: varchar("mime_type", { length: 100 }),
  width: integer("width"),
  height: integer("height"),
  source: varchar("source", { length: 20 }).notNull().default('upload'),
  sourceId: uuid("source_id"),
  creatorId: uuid("creator_id").notNull(),
  purpose: varchar("purpose", { length: 50 }),
  imageStyle: varchar("image_style", { length: 50 }),
  promptText: text("prompt_text"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_materials_brand").on(table.brandId),
  index("idx_geo_materials_type").on(table.materialType),
  index("idx_geo_materials_group").on(table.groupId),
  index("idx_geo_materials_creator").on(table.creatorId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_materials_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_materials_creator_id_fkey",
  }),
]);

export const geoArticleBatches = pgTable("geo_article_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  batchName: varchar("batch_name", { length: 200 }).notNull(),
  articleType: varchar("article_type", { length: 30 }).notNull().default('recommendation'),
  targetWordCount: integer("target_word_count").notNull().default(1200),
  totalCount: integer("total_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  totalCost: numeric("total_cost").notNull().default('0'),
  keywords: text("keywords").array().notNull().default([]),
  creatorId: uuid("creator_id").notNull(),
  error: text("error"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_article_batches_brand").on(table.brandId),
  index("idx_geo_article_batches_status").on(table.status),
  index("idx_geo_article_batches_creator").on(table.creatorId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_article_batches_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_article_batches_creator_id_fkey",
  }),
]);

export const geoArticles = pgTable("geo_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  articleType: varchar("article_type", { length: 30 }).notNull().default('recommendation'),
  wordCount: integer("word_count").notNull().default(0),
  keywords: text("keywords").array().notNull().default([]),
  longtailKeywords: text("longtail_keywords").array().notNull().default([]),
  status: varchar("status", { length: 20 }).notNull().default('draft'),
  batchId: uuid("batch_id"),
  coverImage: text("cover_image"),
  costCredits: numeric("cost_credits").notNull().default('0'),
  creatorId: uuid("creator_id").notNull(),
  error: text("error"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_articles_brand").on(table.brandId),
  index("idx_geo_articles_status").on(table.status),
  index("idx_geo_articles_creator").on(table.creatorId),
  index("idx_geo_articles_batch").on(table.batchId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_articles_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.creatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_articles_creator_id_fkey",
  }),
]);

export const geoAutoTokens = pgTable("geo_auto_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  lastUsedAt: customTimestamptz("last_used_at", { precision: 3 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("geo_auto_tokens_token_key").on(table.token),
]);

export const geoKeywordResults = pgTable("geo_keyword_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().unique(),
  keywordId: uuid("keyword_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  platform: varchar("platform", { length: 30 }).notNull(),
  city: varchar("city", { length: 50 }),
  isHit: boolean("is_hit").notNull().default(false),
  position: integer("position"),
  snippet: text("snippet"),
  url: text("url"),
  error: text("error"),
  detectedAt: customTimestamptz("detected_at", { precision: 3 }),
  isExample: boolean("is_example").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_keyword_results_task_id_key").on(table.taskId),
  index("idx_geo_keyword_results_task").on(table.taskId),
  index("idx_geo_keyword_results_brand").on(table.brandId),
  foreignKey({
    columns: [table.taskId],
    foreignColumns: [geoKeywordTasks.id],
    name: "geo_keyword_results_task_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.keywordId],
    foreignColumns: [geoKeywords.id],
    name: "geo_keyword_results_keyword_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_keyword_results_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoKeywordTasks = pgTable("geo_keyword_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  keywordId: uuid("keyword_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  platform: varchar("platform", { length: 30 }).notNull(),
  city: varchar("city", { length: 50 }),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  isExample: boolean("is_example").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_geo_keyword_tasks_status").on(table.status),
  foreignKey({
    columns: [table.keywordId],
    foreignColumns: [geoKeywords.id],
    name: "geo_keyword_tasks_keyword_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_keyword_tasks_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoKeywords = pgTable("geo_keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  keyword: varchar("keyword", { length: 100 }).notNull(),
  keywordType: varchar("keyword_type", { length: 20 }).notNull().default('longtail'),
  isExample: boolean("is_example").notNull().default(false),
  groupId: uuid("group_id"),
  parentKeywordId: uuid("parent_keyword_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_keywords_brand").on(table.brandId),
  index("idx_geo_keywords_group").on(table.groupId),
  index("idx_geo_keywords_parent").on(table.parentKeywordId),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_keywords_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.groupId],
    foreignColumns: [geoKeywordGroups.id],
    name: "geo_keywords_group_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.parentKeywordId],
    foreignColumns: [geoKeywords.id],
    name: "geo_keywords_parent_keyword_id_fkey",
  }).onDelete("set null"),
]);

export const geoMonthlyReports = pgTable("geo_monthly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  reportMonth: varchar("report_month", { length: 7 }).notNull(),
  includedCount: integer("included_count").default(0),
  prevIncludedCount: integer("prev_included_count").default(0),
  improvementCount: integer("improvement_count").default(0),
  contentOutput: integer("content_output").default(0),
  notes: text("notes"),
  isSent: boolean("is_sent").notNull().default(false),
  sentAt: customTimestamptz("sent_at", { precision: 3 }),
  monthlyCreditUsed: numeric("monthly_credit_used").notNull().default('0'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("geo_monthly_reports_brand_id_report_month_key").on(table.brandId, table.reportMonth),
  index("idx_geo_reports_brand_month").on(table.brandId, table.reportMonth),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_monthly_reports_brand_id_fkey",
  }).onDelete("cascade"),
]);

export const geoPayments = pgTable("geo_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull(),
  amount: numeric("amount").notNull(),
  paymentDate: date("payment_date"),
  paymentMethod: varchar("payment_method", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  foreignKey({
    columns: [table.contractId],
    foreignColumns: [geoContracts.id],
    name: "geo_payments_contract_id_fkey",
  }).onDelete("cascade"),
]);

export const geoContracts = pgTable("geo_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  industry: varchar("industry", { length: 50 }),
  contactPerson: varchar("contact_person", { length: 50 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  packageType: varchar("package_type", { length: 20 }).notNull().default('basic'),
  contractAmount: numeric("contract_amount").notNull().default('0'),
  signDate: date("sign_date"),
  serviceStart: date("service_start"),
  serviceEnd: date("service_end"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default('unpaid'),
  ownerId: uuid("owner_id"),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_contracts_brand").on(table.brandId),
  index("idx_geo_contracts_service_end").on(table.serviceEnd),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_contracts_brand_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.ownerId],
    foreignColumns: [geoUsers.id],
    name: "geo_contracts_owner_id_fkey",
  }),
]);

export const geoLeadFollowups = pgTable("geo_lead_followups", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").notNull(),
  content: text("content").notNull(),
  followupType: varchar("followup_type", { length: 20 }).default('call'),
  operatorId: uuid("operator_id"),
  nextFollowupDate: date("next_followup_date"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.leadId],
    foreignColumns: [geoLeads.id],
    name: "geo_lead_followups_lead_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.operatorId],
    foreignColumns: [geoUsers.id],
    name: "geo_lead_followups_operator_id_fkey",
  }),
]);

export const geoLeads = pgTable("geo_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantName: varchar("merchant_name", { length: 100 }).notNull(),
  industry: varchar("industry", { length: 50 }),
  region: varchar("region", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  source: varchar("source", { length: 50 }),
  intentLevel: varchar("intent_level", { length: 20 }).default('medium'),
  stage: varchar("stage", { length: 20 }).notNull().default('pending'),
  ownerId: uuid("owner_id"),
  brandId: uuid("brand_id"),
  nextFollowupDate: date("next_followup_date"),
  remark: text("remark"),
  isDemo: boolean("is_demo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_geo_leads_stage").on(table.stage),
  index("idx_geo_leads_owner").on(table.ownerId),
  foreignKey({
    columns: [table.ownerId],
    foreignColumns: [geoUsers.id],
    name: "geo_leads_owner_id_fkey",
  }),
  foreignKey({
    columns: [table.brandId],
    foreignColumns: [geoBrands.id],
    name: "geo_leads_brand_id_fkey",
  }),
]);

export const geoBrands = pgTable("geo_brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  industry: varchar("industry", { length: 50 }),
  city: varchar("city", { length: 50 }),
  address: text("address"),
  contactPerson: varchar("contact_person", { length: 50 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  remark: text("remark"),
  companyName: varchar("company_name", { length: 200 }),
  domain: varchar("domain", { length: 500 }),
  hitWords: varchar("hit_words", { length: 100 }).array().notNull().default(sql`{}'::character varying(100)[]`),
  isDemo: boolean("is_demo").notNull().default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const geoSessions = pgTable("geo_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: varchar("session_token", { length: 64 }).notNull().unique(),
  userId: uuid("user_id").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  expiresAt: customTimestamptz("expires_at", { precision: 3 }).notNull(),
  lastActivityAt: customTimestamptz("last_activity_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("geo_sessions_session_token_key").on(table.sessionToken),
  index("idx_geo_sessions_token").on(table.sessionToken),
  index("idx_geo_sessions_user").on(table.userId),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [geoUsers.id],
    name: "geo_sessions_user_id_fkey",
  }).onDelete("cascade"),
]);

export const geoUsers = pgTable("geo_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default('client'),
  displayName: varchar("display_name", { length: 100 }),
  brandId: uuid("brand_id"),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  lastLoginAt: customTimestamptz("last_login_at", { precision: 3 }),
  roleId: uuid("role_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("geo_users_username_key").on(table.username),
  foreignKey({
    columns: [table.roleId],
    foreignColumns: [geoRoles.id],
    name: "geo_users_role_id_fkey",
  }),
]);

// table aliases
export const geoAccountAuthsTable = geoAccountAuths;
export const geoAccountProfilesTable = geoAccountProfiles;
export const geoActionItemsTable = geoActionItems;
export const geoAiDetectResultsTable = geoAiDetectResults;
export const geoAiDetectTasksTable = geoAiDetectTasks;
export const geoAiKeyBrandsTable = geoAiKeyBrands;
export const geoAiKeysTable = geoAiKeys;
export const geoAiPlatformStatsTable = geoAiPlatformStats;
export const geoArticleBatchesTable = geoArticleBatches;
export const geoArticlesTable = geoArticles;
export const geoAutoPublishTasksTable = geoAutoPublishTasks;
export const geoAutoTokensTable = geoAutoTokens;
export const geoBrandProfilesTable = geoBrandProfiles;
export const geoBrandsTable = geoBrands;
export const geoChannelsTable = geoChannels;
export const geoCitationProbeResultsTable = geoCitationProbeResults;
export const geoCitationProbeTasksTable = geoCitationProbeTasks;
export const geoCommitmentSignaturesTable = geoCommitmentSignatures;
export const geoCommitmentVersionsTable = geoCommitmentVersions;
export const geoComplianceChecksTable = geoComplianceChecks;
export const geoContentChecksTable = geoContentChecks;
export const geoContentGapsTable = geoContentGaps;
export const geoContentPillarsTable = geoContentPillars;
export const geoContractsTable = geoContracts;
export const geoCreationTasksTable = geoCreationTasks;
export const geoCreditAccountsTable = geoCreditAccounts;
export const geoCreditPlansTable = geoCreditPlans;
export const geoCreditRequestsTable = geoCreditRequests;
export const geoCreditTransactionsTable = geoCreditTransactions;
export const geoCustomerWalletsTable = geoCustomerWallets;
export const geoDiagnosisReportsTable = geoDiagnosisReports;
export const geoDiagnosisResultsTable = geoDiagnosisResults;
export const geoDiagnosisTasksTable = geoDiagnosisTasks;
export const geoDispatchPlansTable = geoDispatchPlans;
export const geoExternalLinksTable = geoExternalLinks;
export const geoImageServiceConfigTable = geoImageServiceConfig;
export const geoIndexChecksTable = geoIndexChecks;
export const geoIndustryNewsTable = geoIndustryNews;
export const geoInternalLinksTable = geoInternalLinks;
export const geoKeywordGroupsTable = geoKeywordGroups;
export const geoKeywordIndexLogsTable = geoKeywordIndexLogs;
export const geoKeywordPoolTable = geoKeywordPool;
export const geoKeywordResultsTable = geoKeywordResults;
export const geoKeywordTasksTable = geoKeywordTasks;
export const geoKeywordsTable = geoKeywords;
export const geoKnowledgeBaseTable = geoKnowledgeBase;
export const geoLeadFollowupsTable = geoLeadFollowups;
export const geoLeadsTable = geoLeads;
export const geoLongtailConfigsTable = geoLongtailConfigs;
export const geoMaterialGroupsTable = geoMaterialGroups;
export const geoMaterialsTable = geoMaterials;
export const geoMediaOrdersTable = geoMediaOrders;
export const geoMediaSuppliersTable = geoMediaSuppliers;
export const geoMemberPermissionsTable = geoMemberPermissions;
export const geoMembersTable = geoMembers;
export const geoMonthlyReportsTable = geoMonthlyReports;
export const geoOperationLogsTable = geoOperationLogs;
export const geoPageChecksTable = geoPageChecks;
export const geoPaymentsTable = geoPayments;
export const geoPlacementRecordsTable = geoPlacementRecords;
export const geoPlatformWeightsTable = geoPlatformWeights;
export const geoPublicationRecordsTable = geoPublicationRecords;
export const geoPublishQueueTable = geoPublishQueue;
export const geoPublishRecordsTable = geoPublishRecords;
export const geoRechargeApplicationsTable = geoRechargeApplications;
export const geoRolesTable = geoRoles;
export const geoSessionsTable = geoSessions;
export const geoSiteNetworkTable = geoSiteNetwork;
export const geoSourceDomainMapTable = geoSourceDomainMap;
export const geoSourceTagLogsTable = geoSourceTagLogs;
export const geoSourceUrlLogsTable = geoSourceUrlLogs;
export const geoSubmissionChannelsTable = geoSubmissionChannels;
export const geoSubmissionQueueTable = geoSubmissionQueue;
export const geoTdkTemplatesTable = geoTdkTemplates;
export const geoUsersTable = geoUsers;
export const geoVideoServiceConfigTable = geoVideoServiceConfig;
export const geoVideoTasksTable = geoVideoTasks;
export const geoWalletTransactionsTable = geoWalletTransactions;
export const geoWebsiteSettingsTable = geoWebsiteSettings;
