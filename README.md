# Goal
Scrape business data from the Minnesota Secretary of State's website.

## Why
I'm experimenting with building a fraud detection system for the state of Minnesota. Minnesota has seen widespread fraud in many wellfare programs and I want to see if modern LLMs can find patterns that might indicate fraud. In order to build the system I need data.

## Gathering Data
I have downloaded payments data from the Minnesota transparency (website)[https://mn.gov/mmb/transparency-mn/], but that data does not include detailed business information such as: address, registered agents, and filing status. The Minnesota Secretary of State website has this info does not have a bulk download option, so I need to scrape the data.

## Outline
- [x] Download government payments data (CSV format) from MN transparency open checkbook for the department of human services, which is where most of the fraud is happening.
- [ ] Create a Postgres DB, Schema with Drizzle, and load the CSV data into the DB.
