var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  ACCOUNT_TYPES: () => ACCOUNT_TYPES,
  STATUS_TYPES: () => STATUS_TYPES,
  accountTypes: () => accountTypes,
  credentials: () => credentials,
  insertCredentialSchema: () => insertCredentialSchema,
  insertUserSchema: () => insertUserSchema,
  statusTypes: () => statusTypes,
  updateUserProfileSchema: () => updateUserProfileSchema,
  users: () => users
});
import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var credentials = pgTable(
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
    lastChanged: timestamp("last_changed").defaultNow()
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
        table.recoveryEmail
      ]
    }
  })
);
var accountTypes = [
  "#1-TopPriority",
  "#2-Educational",
  "#3-Digital",
  "#4-Social",
  "#5-Financial",
  "#6-Entertainment"
];
var statusTypes = ["Active", "Inactive", "Suspended", "Archived"];
var insertCredentialSchema = createInsertSchema(credentials).pick({
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
  recoveryEmail: true
}).extend({
  platform: z.string().min(1, "Platform Name is required"),
  accountName: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required").refine((password) => {
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
    errorMap: () => ({ message: "Invalid account type" })
  }),
  status: z.enum(statusTypes, {
    errorMap: () => ({ message: "Invalid status" })
  }),
  specialPin: z.string().optional().nullable(),
  recoveryNumber: z.string().optional().nullable(),
  recoveryEmail: z.string().optional().nullable()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
}).extend({
  username: z.string().email("Must be a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[0-9]/, "Password must contain at least one number").regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
});
var updateUserProfileSchema = z.object({
  username: z.string().email("Must be a valid email address").optional(),
  currentPassword: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[0-9]/, "Password must contain at least one number").regex(/[^A-Za-z0-9]/, "Password must contain at least one special character").optional()
});
var ACCOUNT_TYPES = accountTypes;
var STATUS_TYPES = statusTypes;

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, and, isNull, ilike, or, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
var PostgresSessionStore = connectPg(session);
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async checkDuplicateCredential(userId, data) {
    const conditions = [
      eq(credentials.userId, userId),
      eq(credentials.platform, data.platform),
      eq(credentials.username, data.username),
      eq(credentials.password, data.password),
      eq(credentials.accountIdentity, data.accountIdentity),
      eq(credentials.accountType, data.accountType),
      eq(credentials.status, data.status)
    ];
    if (data.accountName === null) {
      conditions.push(isNull(credentials.accountName));
    } else if (data.accountName !== void 0) {
      conditions.push(eq(credentials.accountName, data.accountName));
    }
    if (data.url === null) {
      conditions.push(isNull(credentials.url));
    } else if (data.url !== void 0) {
      conditions.push(eq(credentials.url, data.url));
    }
    if (data.specialPin === null) {
      conditions.push(isNull(credentials.specialPin));
    } else if (data.specialPin !== void 0) {
      conditions.push(eq(credentials.specialPin, data.specialPin));
    }
    if (data.recoveryNumber === null) {
      conditions.push(isNull(credentials.recoveryNumber));
    } else if (data.recoveryNumber !== void 0) {
      conditions.push(eq(credentials.recoveryNumber, data.recoveryNumber));
    }
    if (data.recoveryEmail === null) {
      conditions.push(isNull(credentials.recoveryEmail));
    } else if (data.recoveryEmail !== void 0) {
      conditions.push(eq(credentials.recoveryEmail, data.recoveryEmail));
    }
    const [existing] = await db.select().from(credentials).where(and(...conditions));
    return !!existing;
  }
  async createCredential(credential) {
    const isDuplicate = await this.checkDuplicateCredential(
      credential.userId,
      {
        platform: credential.platform,
        accountName: credential.accountName,
        url: credential.url,
        username: credential.username,
        password: credential.password,
        accountIdentity: credential.accountIdentity,
        accountType: credential.accountType,
        status: credential.status,
        specialPin: credential.specialPin,
        recoveryNumber: credential.recoveryNumber,
        recoveryEmail: credential.recoveryEmail
      }
    );
    if (isDuplicate) {
      throw new Error("A credential with these details already exists");
    }
    const [created] = await db.insert(credentials).values(credential).returning();
    return created;
  }
  async updateCredential(id, userId, credential) {
    const [existing] = await db.select().from(credentials).where(and(eq(credentials.id, id), eq(credentials.userId, userId)));
    if (!existing) {
      throw new Error("Credential not found or you don't have permission to update it");
    }
    const isDuplicate = await this.checkDuplicateCredential(
      userId,
      {
        platform: credential.platform ?? existing.platform,
        accountName: credential.accountName ?? existing.accountName,
        url: credential.url ?? existing.url,
        username: credential.username ?? existing.username,
        password: credential.password ?? existing.password,
        accountIdentity: credential.accountIdentity ?? existing.accountIdentity,
        accountType: credential.accountType ?? existing.accountType,
        status: credential.status ?? existing.status,
        specialPin: credential.specialPin ?? existing.specialPin,
        recoveryNumber: credential.recoveryNumber ?? existing.recoveryNumber,
        recoveryEmail: credential.recoveryEmail ?? existing.recoveryEmail
      }
    );
    if (isDuplicate) {
      throw new Error("These changes would create a duplicate credential");
    }
    const [updated] = await db.update(credentials).set({ ...credential, lastChanged: /* @__PURE__ */ new Date() }).where(and(eq(credentials.id, id), eq(credentials.userId, userId))).returning();
    return updated;
  }
  async deleteCredential(id, userId) {
    const [deleted] = await db.delete(credentials).where(and(eq(credentials.id, id), eq(credentials.userId, userId))).returning();
    if (!deleted) {
      throw new Error("Credential not found or you don't have permission to delete it");
    }
  }
  async searchCredentials(userId, search) {
    const searchTerm = search.toLowerCase();
    return db.select().from(credentials).where(and(
      eq(credentials.userId, userId),
      search ? or(
        ilike(credentials.platform, `%${searchTerm}%`),
        ilike(credentials.accountName || "", `%${searchTerm}%`),
        ilike(credentials.username, `%${searchTerm}%`),
        ilike(credentials.accountIdentity, `%${searchTerm}%`),
        ilike(credentials.accountType, `%${searchTerm}%`)
      ) : void 0
    )).orderBy(desc(credentials.lastChanged));
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.REPL_ID,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore
  };
  if (app2.get("env") === "production") {
    app2.set("trust proxy", 1);
  }
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !await comparePasswords(password, user.password)) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });
  app2.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }
    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password)
    });
    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });
  app2.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

// server/routes.ts
import multer from "multer";
import { parse } from "csv-parse";
import { Readable } from "stream";
import { stringify } from "csv-stringify/sync";
var upload = multer({ storage: multer.memoryStorage() });
function registerRoutes(app2) {
  setupAuth(app2);
  app2.post("/api/credentials", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const result = insertCredentialSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }
    const isDuplicate = await storage.checkDuplicateCredential(
      req.user.id,
      {
        platform: result.data.platform,
        accountName: result.data.accountName || null,
        url: result.data.url || null,
        username: result.data.username,
        password: result.data.password,
        accountIdentity: result.data.accountIdentity,
        accountType: result.data.accountType,
        status: result.data.status,
        specialPin: result.data.specialPin || null,
        recoveryNumber: result.data.recoveryNumber || null,
        recoveryEmail: result.data.recoveryEmail || null
      }
    );
    if (isDuplicate) {
      return res.status(400).json({
        message: "This credential already exists (exact duplicate with all fields matching)"
      });
    }
    const credential = await storage.createCredential({
      ...result.data,
      userId: req.user.id
    });
    res.status(201).json(credential);
  });
  app2.patch("/api/credentials/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid credential ID" });
    }
    const result = insertCredentialSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }
    try {
      const credential = await storage.updateCredential(id, req.user.id, result.data);
      res.json(credential);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  });
  app2.post("/api/credentials/csv", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const results = [];
    const errors = [];
    let rowIndex = 0;
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);
    try {
      const records = bufferStream.pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      }));
      for await (const record of records) {
        rowIndex++;
        try {
          const result = insertCredentialSchema.safeParse({
            platform: record.platform || "",
            accountName: record.accountName || null,
            url: record.url || null,
            username: record.username || "",
            password: record.password || "",
            accountIdentity: record.accountIdentity || "",
            accountType: record.accountType || "#1-TopPriority",
            status: record.status || "Active",
            specialPin: record.specialPin || null,
            recoveryNumber: record.recoveryNumber || null,
            recoveryEmail: record.recoveryEmail || null
          });
          if (result.success) {
            const isDuplicate = await storage.checkDuplicateCredential(
              req.user.id,
              result.data
            );
            if (isDuplicate) {
              errors.push({
                row: rowIndex,
                platform: record.platform || "unknown",
                details: "Exact duplicate: A credential with identical values for all fields already exists"
              });
            } else {
              const credential = await storage.createCredential({
                ...result.data,
                userId: req.user.id
              });
              results.push({ row: rowIndex, platform: record.platform });
            }
          } else {
            const formattedErrors = result.error.errors.map(
              (err) => `Field '${err.path.join(".")}': ${err.message}`
            ).join("; ");
            errors.push({
              row: rowIndex,
              platform: record.platform || "unknown",
              details: formattedErrors
            });
          }
        } catch (error) {
          errors.push({
            row: rowIndex,
            platform: record.platform || "unknown",
            details: error.message
          });
        }
      }
      const errorReport = errors.length > 0 ? `CSV Import Summary Report
Total Records Processed: ${rowIndex}
Successfully Imported: ${results.length}
Failed to Import: ${errors.length}
Failure Rate: ${(errors.length / rowIndex * 100).toFixed(1)}%

Detailed Import Failures:
Detailed Errors:
` + errors.map(
        (err) => `Row ${err.row} (${err.platform}):
${err.details}`
      ).join("\n\n") : "";
      res.json({
        success: errors.length === 0,
        created: results.length,
        errors,
        errorReport
      });
    } catch (error) {
      const errorReport = `CSV Processing Error

${error.message}`;
      res.status(400).json({
        success: false,
        message: "Failed to process CSV file",
        error: error.message,
        errorReport
      });
    }
  });
  app2.get("/api/credentials/export", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const credentials2 = await storage.searchCredentials(req.user.id, "");
      const csvData = stringify(credentials2.map((cred) => ({
        platform: cred.platform,
        accountName: cred.accountName,
        url: cred.url,
        username: cred.username,
        password: cred.password,
        accountIdentity: cred.accountIdentity,
        accountType: cred.accountType,
        status: cred.status,
        specialPin: cred.specialPin,
        recoveryNumber: cred.recoveryNumber,
        recoveryEmail: cred.recoveryEmail
      })), {
        header: true,
        columns: [
          "platform",
          "accountName",
          "url",
          "username",
          "password",
          "accountIdentity",
          "accountType",
          "status",
          "specialPin",
          "recoveryNumber",
          "recoveryEmail"
        ]
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=credentials.csv");
      res.send(csvData);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to export credentials",
        error: error.message
      });
    }
  });
  app2.delete("/api/credentials/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid credential ID" });
    }
    try {
      await storage.deleteCredential(id, req.user.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  });
  app2.get("/api/credentials", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const search = req.query.q?.toString().toLowerCase() || "";
    const credentials2 = await storage.searchCredentials(req.user.id, search);
    res.json(credentials2);
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    log(`Error: ${message}`);
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = process.env.PORT || 5e3;
  server.listen(port, "0.0.0.0", () => {
    log(`Server is running on port ${port}`);
  });
  server.on("error", (error) => {
    log(`Server error: ${error.message}`);
    process.exit(1);
  });
})().catch((error) => {
  log(`Failed to start server: ${error.message}`);
  process.exit(1);
});
