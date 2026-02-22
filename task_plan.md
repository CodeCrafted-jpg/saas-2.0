# Project Task Plan: RAG-Powered SaaS

## 🌟 North Star
**Primary Objective:** "The system allows team members to ask natural-language questions and reliably receive accurate answers composed only from the company’s internal documents with clear citations and direct links to the source pages."

## 🔗 Integrations & Stack
**Core Stack:**
- **Next.js**: Frontend + Server Routes (TypeScript)
- **Supabase**: Auth, Postgres, Storage, Edge Functions
- **pgvector**: Vector storage + ANN index inside Supabase Postgres
- **OpenAI**: Embeddings + Chat/LLM
- **Vercel**: Deployment
- **LangChain.js**: Retreivers/chains (Optional convenience)

**Connectors:**
- Slack: Yes (Notifications & Optional Bot)
- Google Drive: Yes
- Notion: Yes
- AWS S3: Yes

**API Keys Status:**
- `SUPABASE_URL`: ❌ No
- `SUPABASE_SERVICE_ROLE_KEY`: ❌ No
- `SUPABASE_ANON_KEY`: ❌ No
- `OPENAI_API_KEY`: ❌ No
- `VERCEL_TOKEN`: ❌ No
- `GOOGLE_DRIVE_KEY`: ❌ No
- `NOTION_INTEGRATION_TOKEN`: ❌ No
- `SLACK_BOT_TOKEN`: ❌ No
- `AWS_S3_KEY` / `AWS_S3_SECRET`: ❌ No

*Action Item: Obtain keys and store in deployment secrets / `.env` before proceeding to the Link phase.*

## 📚 Source of Truth & Sync Plan
1. **Google Drive (Shared Drive)**: PDFs, Docs, Sheets.
   - *Sync Plan*: One-time bulk ingest → daily incremental sync via Drive API webhook/scheduled job.
2. **Notion Workspace**: Team docs, SOPs.
   - *Sync Plan*: Polling or webhook for updated pages; re-embed on update.
3. **Local / Manual Uploads**: PDFs, Word via dashboard upload.
   - *Sync Plan*: Immediate ingestion pipeline after upload.
4. **Slack**: Files & pinned messages in select channels.
   - *Sync Plan*: Fetch files + thread extraction for admin-allowed channels.
5. **GitHub** (Optional): Extracted code docs.
   - *Sync Plan*: Scheduled crawl of select repos.

**Metadata to Capture:**
- `source`, `source_id`, `title`, `path_or_url`, `page` (if PDF), `lang`, `uploader_id`, `team_id`, `created_at`, `updated_at`

**Quarantine Rule:**
- If ingestion finds PII/secrets, move raw file to `.tmp/quarantine/<id>` and create quarantine record in DB. DO NOT index until reviewed.

## 📦 Delivery Payload
**Delivery Channels:**
- Web Chat UI (Next.js) - Message thread + citations panel
- Exportable Answers (Markdown or PDF)
- Optional: Slack Bot DM

**Query Response Payload:**
```json
{
  "answer": "<string: final composed answer>",
  "sources": [
    {
      "doc_id": "<uuid>",
      "title": "<string>",
      "snippet": "<string: 200 char excerpt>",
      "path": "<url or null>",
      "page": "<integer|null>",
      "confidence": "<0.0-1.0>"
    }
  ],
  "meta": {
    "retrieved_count": 3,
    "model": "gpt-x",
    "embedding_model": "text-embedding-3-small",
    "query_time_ms": 350
  }
}
```

**UI Behavior:** Show answer → collapsible sources (snippet, link, page) → "Show raw context" toggle.
**Audit Logs:** Track query text, user_id, timestamp, retrieved doc_ids, final_answer, and token count (90 days retention).

## ⚖️ Behavioral Rules
**Tone:** Configurable (default: concise, professional, friendly), with a persona flag.

**Hard Guardrails:**
1. **SOURCE-ONLY RULE:** Answer ONLY from retrieved docs. Fallback: *"I don’t know — I couldn’t find relevant information in our documents. Would you like me to search external web resources or flag this for an expert?"*
2. **CITATION RULE:** Always include top 1-3 sources.
3. **REDACTION RULE:** Detect and redact API keys, passwords, SSNs, etc., replacing with `[REDACTED]` + audit log.
4. **ACCESS CONTROL:** Supabase RLS based on `team_id`, `role`, or document ACL.
5. **CONFIDENCE/FALLBACK:** If confidence < 0.35, say *"I don't know"* but provide best snippets.
6. **SENSITIVE TOPICS:** Legal, medical, HR queries fallback to: *"This looks like a legal/medical/HR question — please consult the appropriate team. I can surface relevant policy docs if you want."*
7. **RATE LIMITING:** Per-user & per-team query limits.

**Self-Healing & Ops:**
- 3 consecutive embedding failures -> pause ingestion, log to `progress.md`, alert Ops.
- Broken index (migration/dim mismatch) -> update DB state and block queries until reindexed.
