-- Make all users in tenant_id = 2 admin
UPDATE users 
SET is_admin = 1 
WHERE tenant_id = 2;

-- Verify the update
SELECT id, email, tenant_id, is_admin 
FROM users 
WHERE tenant_id = 2;

