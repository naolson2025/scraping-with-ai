import { eq } from 'drizzle-orm';
import { db } from './db';
import { businesses, businessRegisteredAgents } from './schema';

export type ScrapedBusinessJson = {
  businessName?: unknown;
  businessType?: unknown;
  fileNumber?: unknown;
  filingDate?: unknown;
  numberOfShares?: unknown;
  chiefExecutiveOfficer?: unknown;
  mailingAddress?: unknown;
  mnStatute?: unknown;
  homeJurisdiction?: unknown;
  status?: unknown;
  registeredOfficeAddress?: unknown;
  registeredAgents?: unknown;
};

export type ImportableBusinessRow = {
  fileNumber: string;
  businessName: string;
  businessType: string | null;
  filingDate: string | null;
  numberOfShares: number | null;
  chiefExecutiveOfficer: string | null;
  mailingAddress: string | null;
  mnStatute: string | null;
  homeJurisdiction: string | null;
  status: string | null;
  registeredOfficeAddress: string | null;
  registeredAgents: string[];
};

export type BusinessRejectedRow = {
  rowNumber: number;
  reason: string;
  row: unknown;
};

export type BusinessImportOptions = {
  batchSize: number;
  dryRun: boolean;
};

export type BusinessImportResult = {
  insertedBusinesses: number;
  skippedBusinesses: number;
  insertedAgents: number;
  skippedAgents: number;
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseUsDate(value: string, rowNumber: number): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid filing date "${trimmed}" at row ${rowNumber}.`);
  }

  const monthRaw = match[1]!;
  const dayRaw = match[2]!;
  const yearRaw = match[3]!;
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  const year = Number.parseInt(yearRaw, 10);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid filing date "${trimmed}" at row ${rowNumber}.`);
  }

  return `${yearRaw}-${monthRaw.padStart(2, '0')}-${dayRaw.padStart(2, '0')}`;
}

function parseOptionalInteger(
  value: unknown,
  rowNumber: number,
): number | null {
  const normalized = normalizeOptionalString(value);
  if (normalized === null) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `Invalid number of shares "${normalized}" at row ${rowNumber}.`,
    );
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(
      `Number of shares is too large "${normalized}" at row ${rowNumber}.`,
    );
  }

  return parsed;
}

function parseRegisteredAgents(value: unknown, rowNumber: number): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`registeredAgents must be an array at row ${rowNumber}.`);
  }

  const normalizedAgents = value.map((agent, index) => {
    if (typeof agent !== 'string') {
      throw new Error(
        `registeredAgents[${index}] must be a string at row ${rowNumber}.`,
      );
    }

    return agent.trim();
  });

  return [...new Set(normalizedAgents.filter((agent) => agent.length > 0))];
}

export function parseBusinessJsonInput(input: string): unknown[] {
  const parsed = JSON.parse(input) as unknown;

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object') {
    return [parsed];
  }

  throw new Error(
    'Business JSON must contain an object or an array of objects.',
  );
}

export function parseBusinessRow(
  row: ScrapedBusinessJson,
  rowNumber: number,
): { ok: true; value: ImportableBusinessRow } | { ok: false; error: string } {
  try {
    const businessName = normalizeOptionalString(row.businessName);
    const fileNumber = normalizeOptionalString(row.fileNumber);

    if (!businessName) {
      return {
        ok: false,
        error: `Missing businessName at row ${rowNumber}.`,
      };
    }

    if (!fileNumber) {
      return {
        ok: false,
        error: `Missing fileNumber at row ${rowNumber}.`,
      };
    }

    return {
      ok: true,
      value: {
        fileNumber,
        businessName,
        businessType: normalizeOptionalString(row.businessType),
        filingDate:
          typeof row.filingDate === 'string'
            ? parseUsDate(row.filingDate, rowNumber)
            : null,
        numberOfShares: parseOptionalInteger(row.numberOfShares, rowNumber),
        chiefExecutiveOfficer: normalizeOptionalString(
          row.chiefExecutiveOfficer,
        ),
        mailingAddress: normalizeOptionalString(row.mailingAddress),
        mnStatute: normalizeOptionalString(row.mnStatute),
        homeJurisdiction: normalizeOptionalString(row.homeJurisdiction),
        status: normalizeOptionalString(row.status),
        registeredOfficeAddress: normalizeOptionalString(
          row.registeredOfficeAddress,
        ),
        registeredAgents: parseRegisteredAgents(
          row.registeredAgents,
          rowNumber,
        ),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error.',
    };
  }
}

export async function importBusinesses(
  rows: ImportableBusinessRow[],
  options: BusinessImportOptions,
): Promise<BusinessImportResult> {
  if (options.dryRun || rows.length === 0) {
    return {
      insertedBusinesses: 0,
      skippedBusinesses: 0,
      insertedAgents: 0,
      skippedAgents: 0,
    };
  }

  let insertedBusinesses = 0;
  let skippedBusinesses = 0;
  let insertedAgents = 0;
  let skippedAgents = 0;

  for (let i = 0; i < rows.length; i += options.batchSize) {
    const batch = rows.slice(i, i + options.batchSize);

    await db.transaction(async (tx) => {
      for (const row of batch) {
        const insertedBusiness = await tx
          .insert(businesses)
          .values({
            fileNumber: row.fileNumber,
            businessName: row.businessName,
            businessType: row.businessType,
            filingDate: row.filingDate,
            numberOfShares: row.numberOfShares,
            chiefExecutiveOfficer: row.chiefExecutiveOfficer,
            mailingAddress: row.mailingAddress,
            mnStatute: row.mnStatute,
            homeJurisdiction: row.homeJurisdiction,
            status: row.status,
            registeredOfficeAddress: row.registeredOfficeAddress,
          })
          .onConflictDoNothing()
          .returning({ id: businesses.id });

        const businessId =
          insertedBusiness[0]?.id ??
          (
            await tx
              .select({ id: businesses.id })
              .from(businesses)
              .where(eq(businesses.fileNumber, row.fileNumber))
              .limit(1)
          )[0]?.id;

        if (insertedBusiness.length > 0) {
          insertedBusinesses += 1;
        } else {
          skippedBusinesses += 1;
        }

        if (!businessId || row.registeredAgents.length === 0) {
          continue;
        }

        const insertedAgentRows = await tx
          .insert(businessRegisteredAgents)
          .values(
            row.registeredAgents.map((agentName) => ({
              businessId,
              agentName,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: businessRegisteredAgents.id });

        insertedAgents += insertedAgentRows.length;
        skippedAgents += row.registeredAgents.length - insertedAgentRows.length;
      }
    });
  }

  return {
    insertedBusinesses,
    skippedBusinesses,
    insertedAgents,
    skippedAgents,
  };
}
