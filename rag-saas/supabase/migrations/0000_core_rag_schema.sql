-- Core Schema for RAG-Powered SaaS

CREATE EXTENSION IF NOT EXISTS vector;

-- Table for storing chunked document content and metadata
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536), -- Assuming text-embedding-3-small
  source VARCHAR(50) NOT NULL, -- e.g., 'google_drive', 'notion', 'local', 'slack'
  source_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  path_or_url TEXT,
  page INTEGER,
  lang VARCHAR(10) DEFAULT 'en',
  uploader_id UUID REFERENCES auth.users(id),
  team_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW Vector Index for fast ANN search (cosine similarity)
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);

-- Audit logs for compliance and monitoring
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  team_id UUID NOT NULL,
  retrieved_doc_ids UUID[] NOT NULL,
  final_answer TEXT NOT NULL,
  llm_response_tokens INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Quarantine records for PII/secrets flagged files
CREATE TABLE quarantine_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL, -- Path in Supabase Storage '.tmp/quarantine/{id}'
  original_filename TEXT NOT NULL,
  detected_pii_type TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'rejected'
  uploader_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) setup
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_records ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies require a proper 'teams' architecture which would be defined further.
-- A basic example policy for documents:
-- CREATE POLICY "User can view their team's documents" ON documents
--   FOR SELECT USING (
--     team_id IN (
--       SELECT team_id FROM team_members WHERE user_id = auth.uid()
--     )
--   );
