import fs from 'node:fs/promises';
import { resolve } from 'node:path';

const DELAY_MS = 5000;
const OUTPUT_FILE = 'business_data.json';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithCurl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    }
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
  return match[1]
    .replace(/&ndash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/<br \/>/g, ' ')
    .replace(/<address>/g, '')
    .replace(/<\/address>/g, '')
    .trim();
}

function extractAddress(html: string, label: string): string | null {
  const regex = new RegExp(`<dt>${label}</dt>\\s*<dd>\\s*<address>(.*?)</address>`, 's');
  const match = html.match(regex);
  if (!match) return null;
  return match[1]
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
  return ddMatches.map(m => m.replace(/<dd>|<\/dd>/g, '').trim());
}

async function scrapeBusiness(businessName: string) {
  console.log(`Searching for: ${businessName}`);
  const searchUrl = `https://mblsportal.sos.mn.gov/Business/BusinessSearch?BusinessName=${encodeURIComponent(businessName)}&IncludePriorNames=False&Status=Active&Type=BeginsWith`;
  
  const searchHtml = await fetchWithCurl(searchUrl);
  const guidMatch = searchHtml.match(/\/Business\/SearchDetails\?filingGuid=([a-z0-9-]+)/);
  
  if (!guidMatch) {
    console.error(`Could not find business: ${businessName}`);
    return null;
  }

  const filingGuid = guidMatch[1];
  console.log(`Found filingGuid: ${filingGuid}. Waiting ${DELAY_MS}ms...`);
  await sleep(DELAY_MS);

  const detailsUrl = `https://mblsportal.sos.mn.gov/Business/SearchDetails?filingGuid=${filingGuid}`;
  const detailsHtml = await fetchWithCurl(detailsUrl);

  const nameMatch = detailsHtml.match(/<span class="navbar-brand">(.*?)<\/span>/);
  const scrapedName = nameMatch ? nameMatch[1].replace(/&amp;/g, '&').trim() : businessName;

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
    registeredOfficeAddress: extractAddress(detailsHtml, 'Registered Office Address'),
    registeredAgents: extractAgents(detailsHtml)
  };

  return data;
}

async function main() {
  const businessNames = process.argv.slice(2);
  if (businessNames.length === 0) {
    console.log("Usage: bun run src/scripts/scrapeBusinesses.ts \"Business Name 1\" \"Business Name 2\"");
    return;
  }

  let existingData = [];
  try {
    const content = await fs.readFile(OUTPUT_FILE, 'utf8');
    existingData = JSON.parse(content);
    if (!Array.isArray(existingData)) existingData = [existingData];
  } catch (e) {
    // File doesn't exist or is invalid, start fresh
  }

  for (const name of businessNames) {
    try {
      const data = await scrapeBusiness(name);
      if (data) {
        existingData.push(data);
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(existingData, null, 2));
        console.log(`Saved data for ${name}. Waiting ${DELAY_MS}ms before next search...`);
        await sleep(DELAY_MS);
      }
    } catch (error) {
      console.error(`Error scraping ${name}:`, error);
    }
  }
}

main();
