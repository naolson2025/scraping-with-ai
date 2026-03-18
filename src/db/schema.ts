import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const dhsPayments = pgTable(
  'dhs_payments',
  {
    id: serial('id').primaryKey(),
    payee: text('payee').notNull(),
    paymentAmount: numeric('payment_amount', {
      precision: 14,
      scale: 2,
    }).notNull(),
    budgetPeriod: integer('budget_period').notNull(),
    agency: text('agency').notNull(),
    accountCode: varchar('account_code', { length: 5 }).notNull(),
    expenseCategory: text('expense_category').notNull(),
    expenseType: text('expense_type').notNull(),
  },
  (table) => [
    index('dhs_payments_payee_idx').on(table.payee),
    index('dhs_payments_expense_category_idx').on(table.expenseCategory),
  ],
);

export const businesses = pgTable(
  'businesses',
  {
    id: serial('id').primaryKey(),
    fileNumber: varchar('file_number', { length: 64 }).notNull(),
    businessName: text('business_name').notNull(),
    businessType: text('business_type'),
    filingDate: date('filing_date'),
    numberOfShares: integer('number_of_shares'),
    chiefExecutiveOfficer: text('chief_executive_officer'),
    mailingAddress: text('mailing_address'),
    mnStatute: varchar('mn_statute', { length: 64 }),
    homeJurisdiction: text('home_jurisdiction'),
    status: text('status'),
    registeredOfficeAddress: text('registered_office_address'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('businesses_file_number_uidx').on(table.fileNumber),
    index('businesses_business_name_idx').on(table.businessName),
    index('businesses_status_idx').on(table.status),
  ],
);

export const businessRegisteredAgents = pgTable(
  'business_registered_agents',
  {
    id: serial('id').primaryKey(),
    businessId: integer('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(),
  },
  (table) => [
    index('business_registered_agents_business_id_idx').on(table.businessId),
    uniqueIndex('business_registered_agents_business_agent_uidx').on(
      table.businessId,
      table.agentName,
    ),
  ],
);

export const paymentBusinessLinks = pgTable(
  'payment_business_links',
  {
    id: serial('id').primaryKey(),
    paymentId: integer('payment_id')
      .notNull()
      .references(() => dhsPayments.id, { onDelete: 'cascade' }),
    businessId: integer('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    matchMethod: text('match_method').notNull(),
    matchConfidence: numeric('match_confidence', {
      precision: 5,
      scale: 4,
    }),
    isPrimary: boolean('is_primary').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('payment_business_links_payment_business_uidx').on(
      table.paymentId,
      table.businessId,
    ),
    index('payment_business_links_payment_id_idx').on(table.paymentId),
    index('payment_business_links_business_id_idx').on(table.businessId),
    index('payment_business_links_match_method_idx').on(table.matchMethod),
  ],
);

export type DhsPayment = typeof dhsPayments.$inferSelect;
export type NewDhsPayment = typeof dhsPayments.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type BusinessRegisteredAgent =
  typeof businessRegisteredAgents.$inferSelect;
export type NewBusinessRegisteredAgent =
  typeof businessRegisteredAgents.$inferInsert;
export type PaymentBusinessLink = typeof paymentBusinessLinks.$inferSelect;
export type NewPaymentBusinessLink = typeof paymentBusinessLinks.$inferInsert;
