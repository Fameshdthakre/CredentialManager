import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  platform: text("platform").notNull(),
  accountName: text("account_name"),
  url: text("url"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  accountIdentity: text("account_identity").notNull(),
  accountType: text("account_type").notNull(),
  status: text("status").default("active"),
  specialPin: text("special_pin"),
  recoveryNumber: text("recovery_number"),
  recoveryEmail: text("recovery_email"),
  lastChanged: timestamp("last_changed").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

const accountTypes = [
  "#1-TopPriority",
  "#2-Educational",
  "#3-Digital",
  "#4-Social",
  "#5-Financial",
  "#6-Entertainment"
] as const;

const statusTypes = ["Active", "Inactive", "Suspended", "Archived"] as const;

export const insertCredentialSchema = createInsertSchema(credentials)
  .pick({
    platform: true,
    accountName: true,
    url: true,
    username: true,
    password: true,
    accountIdentity: true,
    accountType: true,
    status: true,
    specialPin: true,
    recoveryNumber: true,
    recoveryEmail: true,
  })
  .extend({
    platform: z.string().min(1, "Platform Name is required"),
    accountName: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    username: z.string().min(1, "Username is required"),
    password: z.string()
      .min(1, "Password is required")
      .refine((password) => {
        const strength = {
          hasLower: /[a-z]/.test(password),
          hasUpper: /[A-Z]/.test(password),
          hasNumber: /\d/.test(password),
          hasSpecial: /[^A-Za-z0-9]/.test(password),
          isLong: password.length >= 8
        };
        return Object.values(strength).filter(Boolean).length;
      }, { message: "Password strength: 0-5 (Weak to Strong)" }),
    accountIdentity: z.string().min(1, "Account Identity is required"),
    accountType: z.enum(accountTypes, {
      errorMap: () => ({ message: "Invalid account type" }),
    }),
    status: z.enum(statusTypes, {
      errorMap: () => ({ message: "Invalid status" }),
    }),
    specialPin: z.string().optional().nullable(),
    recoveryNumber: z.string().optional().nullable(),
    recoveryEmail: z.string().optional().nullable(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;

// Export constants for frontend use
export const ACCOUNT_TYPES = accountTypes;
export const STATUS_TYPES = statusTypes;