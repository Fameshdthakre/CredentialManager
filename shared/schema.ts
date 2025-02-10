import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const credentials = pgTable(
  "credentials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    platform: text("platform").notNull(),
    accountName: text("account_name"),
    url: text("url"),
    username: text("username").notNull(),
    password: text("password").notNull(),
    accountIdentity: text("account_identity").notNull(),
    accountType: text("account_type").notNull(),
    status: text("status").default("Active"),
    specialPin: text("special_pin"),
    recoveryNumber: text("recovery_number"),
    recoveryEmail: text("recovery_email"),
    lastChanged: timestamp("last_changed").defaultNow(),
  },
  (table) => ({
    uniqueCredential: {
      name: "unique_credential",
      columns: [
        table.userId,
        table.platform,
        table.accountName,
        table.url,
        table.username,
        table.password,
        table.accountIdentity,
        table.accountType,
        table.status,
        table.specialPin,
        table.recoveryNumber,
        table.recoveryEmail,
      ],
    },
  }),
);

export const accountTypes = [
  "#1-TopPriority",
  "#2-Educational",
  "#3-Digital",
  "#4-Social",
  "#5-Financial",
  "#6-Entertainment",
] as const;

export const statusTypes = ["Active", "Inactive", "Suspended", "Archived"] as const;

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
          isLong: password.length >= 8,
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  username: z.string().email("Must be a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const updateUserProfileSchema = z.object({
  username: z.string().email("Must be a valid email address").optional(),
  currentPassword: z.string(),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
    .optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export const ACCOUNT_TYPES = accountTypes;
export const STATUS_TYPES = statusTypes;