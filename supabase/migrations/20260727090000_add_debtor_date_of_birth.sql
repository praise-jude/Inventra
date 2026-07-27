-- Additive column for CRM birthday reminders (Customers/Debtors module).
-- Nullable, no default-value backfill needed, no existing query touches
-- it until app code explicitly selects/writes it, so this is safe to
-- apply without any coordinated deploy.
alter table debtors add column date_of_birth date;
