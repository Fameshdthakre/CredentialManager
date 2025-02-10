import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertCredentialSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { parse } from 'csv-parse';
import { Readable } from "stream";
import { stringify } from 'csv-stringify/sync';

// Set up multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Extend Request type to include file from multer
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  app.post("/api/credentials", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertCredentialSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    // Check for exact duplicate across all 11 fields
    const isDuplicate = await storage.checkDuplicateCredential(
      req.user!.id,
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
      userId: req.user!.id,
    });
    res.status(201).json(credential);
  });

  app.patch("/api/credentials/:id", async (req, res) => {
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
      const credential = await storage.updateCredential(id, req.user!.id, result.data);
      res.json(credential);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  });

  app.post("/api/credentials/csv", upload.single('file'), async (req: MulterRequest, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const results = [];
    const errors = [];
    let rowIndex = 0;

    // Create a readable stream from the buffer
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
            platform: record.platform || '',
            accountName: record.accountName || null,
            url: record.url || null,
            username: record.username || '',
            password: record.password || '',
            accountIdentity: record.accountIdentity || '',
            accountType: record.accountType || '#1-TopPriority',
            status: record.status || 'Active',
            specialPin: record.specialPin || null,
            recoveryNumber: record.recoveryNumber || null,
            recoveryEmail: record.recoveryEmail || null
          });

          if (result.success) {
            // Check for exact duplicate (ignoring lastChanged)
            const isDuplicate = await storage.checkDuplicateCredential(
              req.user!.id,
              result.data
            );

            if (isDuplicate) {
              errors.push({
                row: rowIndex,
                platform: record.platform || 'unknown',
                details: 'Exact duplicate: A credential with identical values for all fields already exists'
              });
            } else {
              const credential = await storage.createCredential({
                ...result.data,
                userId: req.user!.id,
              });
              results.push({ row: rowIndex, platform: record.platform });
            }
          } else {
            const formattedErrors = result.error.errors.map(err => 
              `Field '${err.path.join('.')}': ${err.message}`
            ).join('; ');
            errors.push({
              row: rowIndex,
              platform: record.platform || 'unknown',
              details: formattedErrors
            });
          }
        } catch (error: any) {
          errors.push({
            row: rowIndex,
            platform: record.platform || 'unknown',
            details: error.message
          });
        }
      }

      // Generate detailed error report
      const errorReport = errors.length > 0 ? 
        `CSV Import Summary Report\n` +
        `Total Records Processed: ${rowIndex}\n` +
        `Successfully Imported: ${results.length}\n` +
        `Failed to Import: ${errors.length}\n` +
        `Failure Rate: ${((errors.length / rowIndex) * 100).toFixed(1)}%\n\n` +
        `Detailed Import Failures:\n` +
        `Detailed Errors:\n` +
        errors.map(err => 
          `Row ${err.row} (${err.platform}):\n${err.details}`
        ).join('\n\n')
        : '';

      res.json({
        success: errors.length === 0,
        created: results.length,
        errors: errors,
        errorReport: errorReport
      });
    } catch (error: any) {
      const errorReport = `CSV Processing Error\n\n${error.message}`;
      res.status(400).json({
        success: false,
        message: "Failed to process CSV file",
        error: error.message,
        errorReport: errorReport
      });
    }
  });

  app.get("/api/credentials/export", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const credentials = await storage.searchCredentials(req.user!.id, "");

      const csvData = stringify(credentials.map(cred => ({
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
          'platform',
          'accountName',
          'url',
          'username',
          'password',
          'accountIdentity',
          'accountType',
          'status',
          'specialPin',
          'recoveryNumber',
          'recoveryEmail'
        ]
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=credentials.csv');
      res.send(csvData);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to export credentials",
        error: error.message
      });
    }
  });

  app.delete("/api/credentials/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid credential ID" });
    }

    try {
      await storage.deleteCredential(id, req.user!.id);
      res.sendStatus(200);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  });

  app.get("/api/credentials", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const search = req.query.q?.toString().toLowerCase() || "";
    const credentials = await storage.searchCredentials(req.user!.id, search);
    res.json(credentials);
  });

  const httpServer = createServer(app);
  return httpServer;
}