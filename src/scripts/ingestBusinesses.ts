import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type BusinessRejectedRow,
  importBusinesses,
  parseBusinessJsonInput,
  parseBusinessRow,
  type ScrapedBusinessJson,
} from '../db/ingestBusinesses';

type CliArgs = {
  jsonPath: string;
  dryRun: boolean;
  batchSize: number;
};

function parseArgs(argv: string[]): CliArgs {
  let jsonPath = 'business_data.json';
  let dryRun = false;
  let batchSize = 100;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const nextArg = argv[i + 1];

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--json' && nextArg !== undefined) {
      jsonPath = nextArg;
      i += 1;
      continue;
    }

    if (arg === '--batch-size' && nextArg !== undefined) {
      const parsed = Number.parseInt(nextArg, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        batchSize = parsed;
      }
      i += 1;
    }
  }

  return {
    jsonPath,
    dryRun,
    batchSize,
  };
}

async function saveRejectedRows(
  rejectedRows: BusinessRejectedRow[],
): Promise<string | null> {
  if (rejectedRows.length === 0) {
    return null;
  }

  const outputDir = resolve(process.cwd(), 'tmp');
  await mkdir(outputDir, { recursive: true });

  const filePath = resolve(
    outputDir,
    `business-import-rejects-${Date.now()}.json`,
  );
  await writeFile(filePath, JSON.stringify(rejectedRows, null, 2), 'utf8');
  return filePath;
}

async function run(): Promise<void> {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const jsonPath = resolve(process.cwd(), args.jsonPath);

  const jsonContent = await Bun.file(jsonPath).text();
  const rows = parseBusinessJsonInput(jsonContent) as ScrapedBusinessJson[];

  const validRows = [];
  const rejectedRows: BusinessRejectedRow[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    const row = rows[i];
    if (!row) {
      rejectedRows.push({
        rowNumber,
        reason: 'Row is missing from parsed JSON output.',
        row: null,
      });
      continue;
    }

    const parsed = parseBusinessRow(row, rowNumber);

    if (!parsed.ok) {
      rejectedRows.push({
        rowNumber,
        reason: parsed.error,
        row,
      });
      continue;
    }

    validRows.push(parsed.value);
  }

  const importResult = await importBusinesses(validRows, {
    batchSize: args.batchSize,
    dryRun: args.dryRun,
  });

  const rejectedFile = await saveRejectedRows(rejectedRows);
  const elapsedMs = Date.now() - startedAt;

  console.log('Business import summary');
  console.log(`- Mode: ${args.dryRun ? 'dry-run' : 'write'}`);
  console.log(`- JSON path: ${jsonPath}`);
  console.log(`- Batch size: ${args.batchSize}`);
  console.log(`- Records read: ${rows.length}`);
  console.log(`- Valid records: ${validRows.length}`);
  console.log(`- Inserted businesses: ${importResult.insertedBusinesses}`);
  console.log(
    `- Skipped businesses (duplicate): ${importResult.skippedBusinesses}`,
  );
  console.log(`- Inserted agents: ${importResult.insertedAgents}`);
  console.log(`- Skipped agents (duplicate): ${importResult.skippedAgents}`);
  console.log(`- Failed validation: ${rejectedRows.length}`);

  if (rejectedFile) {
    console.log(`- Rejects file: ${rejectedFile}`);
  }

  console.log(`- Elapsed ms: ${elapsedMs}`);

  if (rejectedRows.length > 0) {
    process.exitCode = 1;
  }
}

await run();
