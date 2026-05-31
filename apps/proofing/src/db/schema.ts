import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// Preview-link service. No accounts, no reactions — anyone with the URL can
// view, and the matching revoke_token (held by whoever created the link)
// can revoke. That's the whole product.

export const proofingLinks = sqliteTable("proofing_links", {
  token: text("token").primaryKey(),
  /** Secret returned only at creation. The holder may delete the link. */
  revokeToken: text("revoke_token").notNull(),
  name: text("name").notNull(),
  metaJson: text("meta_json").notNull(),
  createdAt: integer("created_at").notNull(),
  finalizedAt: integer("finalized_at"),
  revoked: integer("revoked").notNull().default(0),
});

export const spreadImages = sqliteTable(
  "spread_images",
  {
    linkToken: text("link_token").notNull().references(() => proofingLinks.token, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    r2Key: text("r2_key").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.linkToken, t.idx] }),
  }),
);
