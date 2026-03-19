import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import {
  countPaymentsForBudgetPeriod,
  countPaymentsInDb,
  type CsvPaymentRow,
  type ImportablePaymentRow,
  importPayments,
  parsePaymentRow,
  type RejectedRow,
  validateCsvHeader,
} from '../db/ingest';

type CliArgs = {
  csvPath: string;
  dryRun: boolean;
  batchSize: number;
};

function parseArgs(argv: string[]): CliArgs {
  let csvPath = '2026-dept-HS-payments-data.csv';
  let dryRun = false;
  let batchSize = 1000;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--csv' && argv[i + 1]) {
      csvPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--batch-size' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        batchSize = parsed;
      }
      i += 1;
    }
  }

  return {
    csvPath,
    dryRun,
    batchSize,
  };
}

async function saveRejectedRows(
  rejectedRows: RejectedRow[],
): Promise<string | null> {
  if (rejectedRows.length === 0) {
    return null;
  }

  const outputDir = resolve(process.cwd(), 'tmp');
  await mkdir(outputDir, { recursive: true });

  const filePath = resolve(
    outputDir,
    `payments-import-rejects-${Date.now()}.json`,
  );
  await writeFile(filePath, JSON.stringify(rejectedRows, null, 2), 'utf8');
  return filePath;
}

async function run(): Promise<void> {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const csvPath = resolve(process.cwd(), args.csvPath);

  const csvContent = await Bun.file(csvPath).text();
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: false,
    relax_column_count: false,
  }) as CsvPaymentRow[];

  const parsedHeader = Object.keys(records[0] ?? {});
  validateCsvHeader(parsedHeader);

  const validRows: ImportablePaymentRow[] = [];
  const rejectedRows: RejectedRow[] = [];

  for (let i = 0; i < records.length; i += 1) {
    const rowNumber = i + 2;
    const parsed = parsePaymentRow(records[i], rowNumber);
    if (!parsed.ok) {
      rejectedRows.push({
        rowNumber,
        reason: parsed.error,
        row: records[i],
      });
      continue;
    }

    validRows.push(parsed.value);
  }

  const dbCountBefore = args.dryRun ? null : await countPaymentsInDb();
  const budgetPeriod = validRows[0]?.budgetPeriod ?? null;
  const periodCountBefore =
    args.dryRun || budgetPeriod === null
      ? null
      : await countPaymentsForBudgetPeriod(budgetPeriod);

  const insertResult = await importPayments(validRows, {
    batchSize: args.batchSize,
    dryRun: args.dryRun,
  });

  const rejectedFile = await saveRejectedRows(rejectedRows);
  const elapsedMs = Date.now() - startedAt;

  console.log('Payments import summary');
  console.log(`- Mode: ${args.dryRun ? 'dry-run' : 'write'}`);
  console.log(`- CSV path: ${csvPath}`);
  console.log(`- Batch size: ${args.batchSize}`);
  console.log(`- Rows read: ${records.length}`);
  console.log(`- Valid rows: ${validRows.length}`);
  console.log(`- Inserted: ${insertResult.inserted}`);
  console.log(`- Skipped (duplicate): ${insertResult.skipped}`);
  console.log(`- Failed validation: ${rejectedRows.length}`);

  if (dbCountBefore !== null) {
    const dbCountAfter = await countPaymentsInDb();
    console.log(`- DB rows before: ${dbCountBefore}`);
    console.log(`- DB rows after: ${dbCountAfter}`);
  }

  if (periodCountBefore !== null && budgetPeriod !== null) {
    const periodCountAfter = await countPaymentsForBudgetPeriod(budgetPeriod);
    console.log(
      `- Budget period ${budgetPeriod} rows before: ${periodCountBefore}`,
    );
    console.log(
      `- Budget period ${budgetPeriod} rows after: ${periodCountAfter}`,
    );
  }

  if (rejectedFile) {
    console.log(`- Rejects file: ${rejectedFile}`);
  }

  console.log(`- Elapsed ms: ${elapsedMs}`);

  if (rejectedRows.length > 0) {
    process.exitCode = 1;
  }
}

await run();
