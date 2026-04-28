ALTER TABLE procurement_payments
ADD COLUMN IF NOT EXISTS due_date date;

UPDATE procurement_payments
SET due_date = payment_date
WHERE due_date IS NULL;

CREATE INDEX IF NOT EXISTS procurement_payments_due_date_idx
ON procurement_payments (due_date);