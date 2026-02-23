-- Setup Test Data for RAG Ingestion Testing
-- Run this in the Supabase SQL Editor

-- 1. Create a dummy team
INSERT INTO teams (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Team')
ON CONFLICT (id) DO NOTHING;

-- 2. Note: uploader_id must exist in auth.users. 
-- Since we can't easily insert into auth.users via SQL without side effects, 
-- we'll rely on the ingestion API using the Admin Client (which bypasses references if we are careful).
-- Actually, the documents table has a foreign key to auth.users. 
-- To test successfully, you should use the ID of a user already in your project.

-- You can find your user ID in the Supabase Dashboard -> Authentication -> Users.
-- Replace '00000000-0000-0000-0000-000000000001' in test-ingest.json 
-- with your actual User ID if you want uploader_id to be correct.
