-- Clean up all purchase payment requests
DELETE FROM purchase_payment_requests;

-- Reset all purchase payments
DELETE FROM purchase_payments;

-- Reset paid_amount and payment_status for all purchase documents
UPDATE purchase_documents 
SET paid_amount = 0, 
    payment_status = 'unpaid'
WHERE status = 'validated';