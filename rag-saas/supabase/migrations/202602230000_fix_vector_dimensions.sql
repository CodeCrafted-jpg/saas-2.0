-- Fix vector dimension mismatch for Ollama (768 dimensions)
-- Previous schema was designed for OpenAI (1536 dimensions)

-- 1. Drop the existing match_documents function so we can change the signature
DROP FUNCTION IF EXISTS match_documents(vector, float, int, uuid);

-- 2. Alter the documents table embedding column
ALTER TABLE documents 
ALTER COLUMN embedding TYPE vector(768);

-- 3. Recreate the match_documents function with the new dimension
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_team_id uuid
)
RETURNS TABLE (
  id uuid,
  title varchar,
  content text,
  path_or_url text,
  page integer,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    documents.id,
    documents.title,
    documents.content,
    documents.path_or_url,
    documents.page,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE documents.team_id = filter_team_id
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;
