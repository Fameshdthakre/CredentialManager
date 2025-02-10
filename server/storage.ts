import { users, credentials, type User, type InsertUser, type Credential, type InsertCredential } from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, ilike, or, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createCredential(credential: InsertCredential & { userId: number }): Promise<Credential>;
  updateCredential(id: number, userId: number, credential: Partial<InsertCredential>): Promise<Credential>;
  deleteCredential(id: number, userId: number): Promise<void>;
  checkDuplicateCredential(
    userId: number,
    data: {
      platform: string,
      accountName?: string | null,
      url?: string | null,
      username: string,
      password: string,
      accountIdentity: string,
      accountType: string,
      status: string,
      specialPin?: string | null,
      recoveryNumber?: string | null,
      recoveryEmail?: string | null
    }
  ): Promise<boolean>;
  searchCredentials(userId: number, search: string): Promise<Credential[]>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async checkDuplicateCredential(
    userId: number,
    data: {
      platform: string,
      accountName?: string | null,
      url?: string | null,
      username: string,
      password: string,
      accountIdentity: string,
      accountType: string,
      status: string,
      specialPin?: string | null,
      recoveryNumber?: string | null,
      recoveryEmail?: string | null
    }
  ): Promise<boolean> {
    const conditions = [
      eq(credentials.userId, userId),
      eq(credentials.platform, data.platform),
      eq(credentials.username, data.username),
      eq(credentials.password, data.password),
      eq(credentials.accountIdentity, data.accountIdentity),
      eq(credentials.accountType, data.accountType),
      eq(credentials.status, data.status)
    ];

    // Handle optional fields with null values
    if (data.accountName === null) {
      conditions.push(isNull(credentials.accountName));
    } else if (data.accountName !== undefined) {
      conditions.push(eq(credentials.accountName, data.accountName));
    }

    if (data.url === null) {
      conditions.push(isNull(credentials.url));
    } else if (data.url !== undefined) {
      conditions.push(eq(credentials.url, data.url));
    }

    if (data.specialPin === null) {
      conditions.push(isNull(credentials.specialPin));
    } else if (data.specialPin !== undefined) {
      conditions.push(eq(credentials.specialPin, data.specialPin));
    }

    if (data.recoveryNumber === null) {
      conditions.push(isNull(credentials.recoveryNumber));
    } else if (data.recoveryNumber !== undefined) {
      conditions.push(eq(credentials.recoveryNumber, data.recoveryNumber));
    }

    if (data.recoveryEmail === null) {
      conditions.push(isNull(credentials.recoveryEmail));
    } else if (data.recoveryEmail !== undefined) {
      conditions.push(eq(credentials.recoveryEmail, data.recoveryEmail));
    }

    const [existing] = await db
      .select()
      .from(credentials)
      .where(and(...conditions));

    return !!existing;
  }

  async createCredential(credential: InsertCredential & { userId: number }): Promise<Credential> {
    // Check for duplicates using all fields
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

  async updateCredential(id: number, userId: number, credential: Partial<InsertCredential>): Promise<Credential> {
    // First get the existing credential
    const [existing] = await db
      .select()
      .from(credentials)
      .where(and(eq(credentials.id, id), eq(credentials.userId, userId)));

    if (!existing) {
      throw new Error("Credential not found or you don't have permission to update it");
    }

    // Check if the update would create a duplicate
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

    const [updated] = await db
      .update(credentials)
      .set({ ...credential, lastChanged: new Date() })
      .where(and(eq(credentials.id, id), eq(credentials.userId, userId)))
      .returning();

    return updated;
  }

  async deleteCredential(id: number, userId: number): Promise<void> {
    const [deleted] = await db
      .delete(credentials)
      .where(and(eq(credentials.id, id), eq(credentials.userId, userId)))
      .returning();

    if (!deleted) {
      throw new Error("Credential not found or you don't have permission to delete it");
    }
  }

  async searchCredentials(userId: number, search: string): Promise<Credential[]> {
    const searchTerm = search.toLowerCase();
    return db
      .select()
      .from(credentials)
      .where(and(
        eq(credentials.userId, userId),
        search ? 
          or(
            ilike(credentials.platform, `%${searchTerm}%`),
            ilike(credentials.accountName || '', `%${searchTerm}%`),
            ilike(credentials.username, `%${searchTerm}%`),
            ilike(credentials.accountIdentity, `%${searchTerm}%`),
            ilike(credentials.accountType, `%${searchTerm}%`)
          )
        : undefined
      ))
      .orderBy(desc(credentials.lastChanged));
  }
}

export const storage = new DatabaseStorage();