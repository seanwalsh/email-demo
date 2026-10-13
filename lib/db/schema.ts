import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export type ShipmentStatus = "shipped" | "out_for_delivery" | "delivered";

export const shipments = sqliteTable(
  "shipments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    trackingNumber: text("tracking_number").notNull(),
    carrier: text("carrier").notNull(),
    sender: text("sender").notNull(),
    status: text("status").$type<ShipmentStatus>().notNull(),
    eta: text("eta"), // YYYY-MM-DD
    threadId: text("thread_id").notNull(),
    latestMessageId: text("latest_message_id").notNull(),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("shipments_account_tracking").on(t.accountId, t.trackingNumber)],
);

export const processedMessages = sqliteTable(
  "processed_messages",
  {
    accountId: text("account_id").notNull(),
    messageId: text("message_id").notNull(),
    automationId: text("automation_id").notNull(),
    ignored: integer("ignored", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("processed_unique").on(t.accountId, t.messageId, t.automationId)],
);

export const actionLog = sqliteTable(
  "action_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    automationId: text("automation_id").notNull(),
    messageId: text("message_id").notNull(),
    threadId: text("thread_id").notNull(),
    summary: text("summary").notNull(),
    addedLabelIds: text("added_label_ids", { mode: "json" }).$type<string[]>().notNull(),
    removedLabelIds: text("removed_label_ids", { mode: "json" }).$type<string[]>().notNull(),
    undoneAt: integer("undone_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("action_log_account").on(t.accountId, t.createdAt)],
);

// Key/value per account: shipments label id, last scan time, etc.
export const settings = sqliteTable(
  "settings",
  {
    accountId: text("account_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("settings_unique").on(t.accountId, t.key)],
);
