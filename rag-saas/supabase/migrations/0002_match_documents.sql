-- Create a Postgres function for similarity search
-- This handles vector distance math (cosine) and RLS filtering natively.

create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_team_id uuid
)
returns table (
  id uuid,
  title varchar,
  content text,
  path_or_url text,
  page integer,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.title,
    documents.content,
    documents.path_or_url,
    documents.page,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  -- Optional: only include documents belonging to the user's team.
  -- RLS will technically enforce this if we invoke from client via Anon Key,
  -- but since we're using Service Role (Admin Client) in server endpoints,
  -- we must explicitly filter by team_id to prevent data leakage.
  where documents.team_id = filter_team_id
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
