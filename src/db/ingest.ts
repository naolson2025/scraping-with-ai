import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { dhsPayments } from './schema';

const EXPECTED_COLUMNS = [
  'Payment Amount',
  'Budget Period',
  'Agency',
  'Payee',
  ' SUBSTRING(Account Cd FROM 1 FOR 5)',
  'Expense Category',
  'Expense Type',
] as const;

export type CsvPaymentRow = {
  'Payment Amount': string;
  'Budget Period': string;
  Agency: string;
  Payee: string;
  ' SUBSTRING(Account Cd FROM 1 FOR 5)': string;
  'Expense Category': string;
  'Expense Type': string;
};

export type ImportablePaymentRow = {
  paymentAmount: string;
  budgetPeriod: number;
  agency: string;
  payee: string;
  accountCode: string;
  expenseCategory: string;
  expenseType: string;
};

export type RejectedRow = {
  rowNumber: number;
  reason: string;
  row: Record<string, string>;
};

export type ImportOptions = {
  batchSize: number;
  dryRun: boolean;
};

export type ImportResult = {
  rowsRead: number;
  inserted: number;
  skipped: number;
  failed: number;
  rejectedRows: RejectedRow[];
  elapsedMs: number;
};

export function validateCsvHeader(columns: string[]): void {
  if (columns.length !== EXPECTED_COLUMNS.length) {
    throw new Error(
      `Unexpected column count. Expected ${EXPECTED_COLUMNS.length}, got ${columns.length}.`,
    );
  }

  columns.forEach((column, index) => {
    if (column !== EXPECTED_COLUMNS[index]) {
      throw new Error(
        `Unexpected column at position ${index + 1}. Expected "${EXPECTED_COLUMNS[index]}", got "${column}".`,
      );
    }
  });
}

export function parsePaymentRow(
  row: CsvPaymentRow,
  rowNumber: number,
): { ok: true; value: ImportablePaymentRow } | { ok: false; error: string } {
  const paymentAmountRaw = row['Payment Amount']?.trim();
  const budgetPeriodRaw = row['Budget Period']?.trim();
  const agency = row.Agency?.trim();
  const payee = row.Payee?.trim();
  const accountCode = row[' SUBSTRING(Account Cd FROM 1 FOR 5)']?.trim();
  const expenseCategory = row['Expense Category']?.trim();
  const expenseType = row['Expense Type']?.trim();

  if (
    !paymentAmountRaw ||
    !budgetPeriodRaw ||
    !agency ||
    !payee ||
    !accountCode ||
    !expenseCategory ||
    !expenseType
  ) {
    return {
      ok: false,
      error: `Missing required field(s) at row ${rowNumber}.`,
    };
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(paymentAmountRaw)) {
    return {
      ok: false,
      error: `Invalid payment amount "${paymentAmountRaw}" at row ${rowNumber}.`,
    };
  }

  const budgetPeriod = Number.parseInt(budgetPeriodRaw, 10);
  if (Number.isNaN(budgetPeriod)) {
    return {
      ok: false,
      error: `Invalid budget period "${budgetPeriodRaw}" at row ${rowNumber}.`,
    };
  }

  if (!/^\d{1,5}$/.test(accountCode)) {
    return {
      ok: false,
      error: `Invalid account code "${accountCode}" at row ${rowNumber}.`,
    };
  }

  return {
    ok: true,
    value: {
      paymentAmount: paymentAmountRaw,
      budgetPeriod,
      agency,
      payee,
      accountCode,
      expenseCategory,
      expenseType,
    },
  };
}

export async function importPayments(
  rows: ImportablePaymentRow[],
  options: ImportOptions,
): Promise<{ inserted: number; skipped: number }> {
  if (options.dryRun || rows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += options.batchSize) {
    const batch = rows.slice(i, i + options.batchSize);

    const result = await db
      .insert(dhsPayments)
      .values(batch)
      .onConflictDoNothing()
      .returning({ id: dhsPayments.id });

    inserted += result.length;
    skipped += batch.length - result.length;
  }

  return { inserted, skipped };
}

export async function countPaymentsInDb(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dhsPayments);
  return result[0]?.count ?? 0;
}

export async function countPaymentsForBudgetPeriod(
  budgetPeriod: number,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dhsPayments)
    .where(eq(dhsPayments.budgetPeriod, budgetPeriod));
  return result[0]?.count ?? 0;
}
