import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
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

export type DhsPayment = typeof dhsPayments.$inferSelect;
export type NewDhsPayment = typeof dhsPayments.$inferInsert;
