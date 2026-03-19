import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../db/db';
import { dhsPayments } from '../db/schema';

const DELAY_MS = 5000;
const OUTPUT_FILE = 'business_data.json';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type ScrapedBusinessData = {
  businessName: string;
  businessType: string | null;
  fileNumber: string | null;
  filingDate: string | null;
  numberOfShares: string | null;
  chiefExecutiveOfficer: string | null;
  mailingAddress: string | null;
  mnStatute: string | null;
  homeJurisdiction: string | null;
  status: string | null;
  registeredOfficeAddress: string | null;
  registeredAgents: string[];
};

type CliArgs = {
  batchSize: number;
  offset: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let batchSize = 25;
  let offset = 1;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const nextArg = argv[i + 1];

    if (arg === '--batch-size' && nextArg !== undefined) {
      const parsed = Number.parseInt(nextArg, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        batchSize = parsed;
      }
      i += 1;
      continue;
    }

    if (arg === '--offset' && nextArg !== undefined) {
      const parsed = Number.parseInt(nextArg, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        offset = parsed;
      }
      i += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { batchSize, offset, dryRun };
}

async function loadBusinessNames(
  batchSize: number,
  offset: number,
): Promise<string[]> {
  const queryOffset = Math.max(0, offset - 1);

  const rows = await db
    .selectDistinct({ payee: dhsPayments.payee })
    .from(dhsPayments)
    .where(sql`trim(${dhsPayments.payee}) <> ''`)
    .orderBy(dhsPayments.payee)
    .limit(batchSize)
    .offset(queryOffset);

  const seen = new Set<string>();
  const names: string[] = [];

  for (const row of rows) {
    const normalized = row.payee.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    names.push(normalized);
  }

  return names;
}

async function loadExistingData(): Promise<ScrapedBusinessData[]> {
  try {
    const content = await fs.readFile(
      resolve(process.cwd(), OUTPUT_FILE),
      'utf8',
    );
    const parsed = JSON.parse(content) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as ScrapedBusinessData[];
    }

    if (parsed && typeof parsed === 'object') {
      return [parsed as ScrapedBusinessData];
    }

    return [];
  } catch {
    return [];
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithCurl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.text();
}

function extractField(html: string, label: string): string | null {
  const regex = new RegExp(`<dt>${label}</dt>\\s*<dd>(.*?)</dd>`, 's');
  const match = html.match(regex);
  if (!match) return null;
  const value = match[1];
  if (value === undefined) return null;
  return value
    .replace(/&ndash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/<br \/>/g, ' ')
    .replace(/<address>/g, '')
    .replace(/<\/address>/g, '')
    .trim();
}

function extractAddress(html: string, label: string): string | null {
  const regex = new RegExp(
    `<dt>${label}</dt>\\s*<dd>\\s*<address>(.*?)</address>`,
    's',
  );
  const match = html.match(regex);
  if (!match) return null;
  const value = match[1];
  if (value === undefined) return null;
  return value
    .replace(/&ndash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/<br \/>/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAgents(html: string): string[] {
  const regex = /<dt>Registered Agent\(s\)<\/dt>(<dd>.*?<\/dd>)+/s;
  const match = html.match(regex);
  if (!match) return [];
  const ddMatches = match[0].match(/<dd>(.*?)<\/dd>/g);
  if (!ddMatches) return [];
  return ddMatches.map((m) => m.replace(/<dd>|<\/dd>/g, '').trim());
}

async function scrapeBusiness(
  businessName: string,
): Promise<ScrapedBusinessData | null> {
  console.log(`Searching for: ${businessName}`);
  const searchUrl = `https://mblsportal.sos.mn.gov/Business/BusinessSearch?BusinessName=${encodeURIComponent(businessName)}&IncludePriorNames=False&Status=Active&Type=BeginsWith`;

  const searchHtml = await fetchWithCurl(searchUrl);
  const guidMatch = searchHtml.match(
    /\/Business\/SearchDetails\?filingGuid=([a-z0-9-]+)/,
  );

  if (!guidMatch) {
    console.error(`Could not find business: ${businessName}`);
    return null;
  }

  const filingGuid = guidMatch[1];
  console.log(`Found filingGuid: ${filingGuid}. Waiting ${DELAY_MS}ms...`);
  await sleep(DELAY_MS);

  const detailsUrl = `https://mblsportal.sos.mn.gov/Business/SearchDetails?filingGuid=${filingGuid}`;
  const detailsHtml = await fetchWithCurl(detailsUrl);

  const nameMatch = detailsHtml.match(
    /<span class="navbar-brand">(.*?)<\/span>/,
  );
  const scrapedNameValue = nameMatch?.[1];
  const scrapedName = scrapedNameValue
    ? scrapedNameValue.replace(/&amp;/g, '&').trim()
    : businessName;

  const data = {
    businessName: scrapedName,
    businessType: extractField(detailsHtml, 'Business Type'),
    fileNumber: extractField(detailsHtml, 'File Number'),
    filingDate: extractField(detailsHtml, 'Filing Date'),
    numberOfShares: extractField(detailsHtml, 'Number of Shares'),
    chiefExecutiveOfficer: extractField(detailsHtml, 'Chief Executive Officer'),
    mailingAddress: extractAddress(detailsHtml, 'Mailing Address'),
    mnStatute: extractField(detailsHtml, 'MN Statute'),
    homeJurisdiction: extractField(detailsHtml, 'Home Jurisdiction'),
    status: extractField(detailsHtml, 'Status'),
    registeredOfficeAddress: extractAddress(
      detailsHtml,
      'Registered Office Address',
    ),
    registeredAgents: extractAgents(detailsHtml),
  };

  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const businessNames = await loadBusinessNames(args.batchSize, args.offset);

  if (businessNames.length === 0) {
    console.log('No business names found in dhs_payments for scraping.');
    return;
  }

  console.log(
    `Loaded ${businessNames.length} unique business name(s) from dhs_payments (batch size: ${args.batchSize}, start position: ${args.offset}).`,
  );

  const outputPath = resolve(process.cwd(), OUTPUT_FILE);
  const existingData = await loadExistingData();
  const existingNameSet = new Set(
    existingData.map((row) => row.businessName.trim().toLowerCase()),
  );
  const existingKeys = new Set(
    existingData.map((row) => row.fileNumber ?? `name:${row.businessName}`),
  );

  if (args.dryRun) {
    const start = args.offset;
    const end = args.offset + businessNames.length - 1;
    const alreadySavedByName = businessNames.filter((name) =>
      existingNameSet.has(name.trim().toLowerCase()),
    );

    console.log('Dry run summary');
    console.log(`- Mode: dry-run`);
    console.log(`- Output file: ${outputPath}`);
    console.log(`- Batch size: ${args.batchSize}`);
    console.log(`- Start position: ${args.offset}`);
    console.log(`- End position: ${end}`);
    console.log(`- Existing output rows: ${existingData.length}`);
    console.log(`- Candidate businesses: ${businessNames.length}`);
    console.log(
      `- Candidate names already present in output (name match): ${alreadySavedByName.length}`,
    );
    console.log('- Businesses selected for scraping:');

    businessNames.forEach((name, index) => {
      const position = start + index;
      const presentMarker = existingNameSet.has(name.trim().toLowerCase())
        ? ' [already in output by name]'
        : '';
      console.log(`  ${position}. ${name}${presentMarker}`);
    });

    return;
  }

  for (const name of businessNames) {
    try {
      const data = await scrapeBusiness(name);
      if (data) {
        const rowKey = data.fileNumber ?? `name:${data.businessName}`;

        if (existingKeys.has(rowKey)) {
          console.log(
            `Skipping already-saved business for ${name} (${rowKey}). Waiting ${DELAY_MS}ms...`,
          );
          await sleep(DELAY_MS);
          continue;
        }

        existingData.push(data);
        existingKeys.add(rowKey);
        await fs.writeFile(outputPath, JSON.stringify(existingData, null, 2));
        console.log(
          `Saved data for ${name}. Waiting ${DELAY_MS}ms before next search...`,
        );
        await sleep(DELAY_MS);
      }
    } catch (error) {
      console.error(`Error scraping ${name}:`, error);
    }
  }
}

main();
