# Goal
Scrape business data from the Minnesota Secretary of State's website.

## Why
I'm experimenting with building a fraud detection system for the state of Minnesota. Minnesota has seen widespread fraud in many wellfare programs and I want to see if modern LLMs can find patterns that might indicate fraud. In order to build the system I need data.

## Gathering Data
I have downloaded payments data from the Minnesota transparency (website)[https://mn.gov/mmb/transparency-mn/], but that data does not include detailed business information such as: address, registered agents, and filing status. The Minnesota Secretary of State website has this info does not have a bulk download option, so I need to scrape the data.

## Outline
- [x] Download government payments data (CSV format) from MN transparency open checkbook for the department of human services, which is where most of the fraud is happening.
- [ ] Create a Postgres DB, Schema with Drizzle, and load the CSV data into the DB.
- [ ] Manually scrape with `curl` to test it works
```
https://mblsportal.sos.mn.gov/Business/BusinessSearch?BusinessName=the%20gardens%20at%20foley%20LLC&IncludePriorNames=False&Status=Active&Type=BeginsWith
```
- [ ] Have AI scrape. Provide the URL & business name. Prompt:
```
I'm searching businesses. Here is an example url:

https://mblsportal.sos.mn.gov/Business/BusinessSearch?BusinessName=the%20gardens%20at%20foley%20LLC&IncludePriorNames=False&Status=Active&Type=BeginsWith

I want you to search the business "1 ALPHA & OMEGA DIVINE CARE SYSTEM INC" and then scrape the result to find the details link which looks like this:

<a href="/Business/SearchDetails?filingGuid=3a969657-dd1d-ed11-9062-00155d01c614">Details</a>

and then navigate to that page and scrape the business data and write it to a CSV file. Use curl to request the data.
```