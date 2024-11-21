import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
  numeric,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `rescrape_${name}`);

export const properties = createTable("properties", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 256 }),
  street: varchar("street", { length: 256 }),
  city: varchar("city", { length: 256 }),
  state: varchar("state", { length: 256 }),
  zip: integer("zip"),
  source: varchar("source", { length: 256 }),
  longitude: numeric("longitude"),
  latitude: numeric("latitude"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const propertyInfo = createTable("property_info", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  key: varchar("key", { length: 256 }),
  value: varchar("value", { length: 256 }),
  propertyId: integer("property_id")
    .notNull()
    .references(() => properties.id),
});

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  propertyInfo: many(propertyInfo), // One property can have many propertyInfo rows
}));

export const propertyInfoRelations = relations(propertyInfo, ({ one }) => ({
  property: one(properties, {
    fields: [propertyInfo.propertyId], // Foreign key in `propertyInfo`
    references: [properties.id], // Primary key in `properties`
  }),
}));

export const states = createTable("state", {
  id: integer("id").primaryKey().notNull(),
  name: varchar("name", { length: 256 }),
});

export const counties = createTable("county", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  countyid: integer("county_id").notNull(),
  name: varchar("name", { length: 256 }),
  stateId: integer("state_id")
    .notNull()
    .references(() => states.id),
});

export const countyStats = createTable("county_stats", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  countyId: integer("county_id")
    .notNull()
    .references(() => counties.id),
  key: varchar("key", { length: 256 }),
  value: varchar("value", { length: 256 }),
});

export const users = createTable("user", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_user_id_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_user_id_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);
