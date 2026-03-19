# Goal

Scrape business data from the Minnesota Secretary of State's website.

## Why

I'm experimenting with building a fraud detection system for the state of Minnesota. Minnesota has seen widespread fraud in many wellfare programs and I want to see if modern LLMs can find patterns that might indicate fraud. In order to build the system I need data.

## Gathering Data

I have downloaded payments data from the Minnesota transparency (website)[https://mn.gov/mmb/transparency-mn/], but that data does not include detailed business information such as: address, registered agents, and filing status. The Minnesota Secretary of State website has this info does not have a bulk download option, so I need to scrape the data.

## Outline

- [x] Download government payments data (CSV format) from MN transparency open checkbook for the department of human services, which is where most of the fraud is happening.
- [x] Create a Postgres DB, Schema with Drizzle, and load the CSV data into the DB.
- [x] Add columns for the data in the SOS website to the database.
- [ ] Manually scrape with `curl` to test it works

```
https://mblsportal.sos.mn.gov/Business/BusinessSearch?BusinessName=the%20gardens%20at%20foley%20LLC&IncludePriorNames=False&Status=Active&Type=BeginsWith
```

- [ ] Have AI scrape. Provide the URL & business name.

```
Prompt:
I'm searching businesses. Here is an example url:

https://mblsportal.sos.mn.gov/Business/BusinessSearch?BusinessName=the%20gardens%20at%20foley%20LLC&IncludePriorNames=False&Status=Active&Type=BeginsWith

I want you to search the business "1 ALPHA & OMEGA DIVINE CARE SYSTEM INC" and then scrape the result to find the details link which looks like this:

<a href="/Business/SearchDetails?filingGuid=3a969657-dd1d-ed11-9062-00155d01c614">Details</a>

and then navigate to that page and scrape the business data. Use curl to request the data.

Save the data to a JSON file with the following format:

{
  "businessName": "1 ALPHA & OMEGA DIVINE CARE SYSTEM INC",
  "businessType": "Business Corporation (Domestic)",
  "fileNumber": "1234567",
  "filingDate": "01/01/2020",
  "numberOfShares": "1000",
  "chiefExecutiveOfficer": "Jane Smith",
  "mailingAddress": "123 Main St, Anytown, MN 12345",
  "mnStatute": "302A",
  "homeJurisdiction": "Minnesota",
  "status": "Active / In Good Standing",
  "registeredOfficeAddress": "456 Elm St, Anytown, MN 12345",
  "registeredAgents": [
    "John Doe",
    "Jane Doe"
  ]
}
```

- [ ] Have AI create a drizzle query to load the scraped data into the database from the JSON file (ignoring duplicates).
- [ ] Have AI write a script to automate the scraping where I can give a list of business names and it will scrape the data for each business and append it to a JSON file.

# Instructions

## Importing DHS CSV into Postgres

The project includes a typed CSV importer for `2026-dept-HS-payments-data.csv`.

### Commands

1. Generate and apply schema migrations:

```bash
bun run db:generate
bun run db:migrate
```

2. Validate the CSV without writing to DB:

```bash
bun run import:payments:dry-run
```

3. Import into `dhs_payments`:

```bash
bun run import:payments
```

### Optional arguments

```bash
bun run import:payments --csv ./2026-dept-HS-payments-data.csv --batch-size 1000
```

### Idempotency behavior

Imports are duplicate-safe. Re-running the same CSV does not create duplicate rows. A unique index on the full payment row signature is enforced and inserts use conflict-ignore semantics.
