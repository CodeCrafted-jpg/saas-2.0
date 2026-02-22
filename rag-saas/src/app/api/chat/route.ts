import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { retrieveRelevantDocuments, RetrievedDocument } from '@/utils/ai/rag';
import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// Note: Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const { messages, teamId } = await req.json();

        if (!teamId) {
            return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        // Capture the latest user message
        const lastMessage = messages[messages.length - 1];

        // RAG Step: Retrieve documents matching the query (using minimum 0.35 confidence per specs)
        const docs = await retrieveRelevantDocuments(lastMessage.content, teamId, 0.35, 3);

        // Extract snippets to feed to the LLM
        const contextText = docs.map((doc: RetrievedDocument) => `
      ---
      SOURCE_ID: ${doc.id}
      TITLE: ${doc.title || 'Unknown Title'}
      PAGE: ${doc.page || 'N/A'}
      CONTENT: ${doc.snippet}
      ---
    `).join('\n');

        // System prompt enforcing behavioral rules: 
        // - Source-only rule
        // - Confidence & Fallback rule
        const systemPrompt = `
      You are an internal company AI assistant. You answer questions strictly based on the provided retrieved documents.
      
      BEHAVIORAL RULES:
      1. SOURCE-ONLY: Answer ONLY from the retrieved context below. Do not introduce outside knowledge.
      2. FALLBACK: If the provided documents do not contain the necessary information, you must respond EXACTLY with:
         "I don't know — I couldn't find relevant information in our documents. Would you like me to search external web resources or flag this for an expert?"
      3. CITATIONS: When asserting facts, always include inline citations (e.g. [TITLE, PAGE X]).
      4. SENSITIVE TOPICS: If the query is legal, medical, or HR-related and uncertain, fallback with:
         "This looks like a legal/medical/HR question — please consult the appropriate team. I can surface relevant policy docs if you want."
      5. REDACTION: If you output passwords, API keys, or SSNs that were in the context, redact them with [REDACTED].

      RETRIEVED CONTEXT:
      ${contextText || '(No documents found above the confidence threshold)'}
    `;

        // Initialize text stream. We pass the retrieved docs in headers so the client Next.js UI
        // can render the citations panel nicely mapped to the answer.
        const result = streamText({
            model: openai('gpt-4o'),
            system: systemPrompt,
            messages,
        });

        // toDataStreamResponse is the correct method in AI SDK v6 for useChat() compatibility
        const response = result.toDataStreamResponse();
        const headers = new Headers(response.headers);
        headers.set('x-rag-sources', Buffer.from(JSON.stringify(docs)).toString('base64'));
        // Expose the custom header to the browser
        headers.set('Access-Control-Expose-Headers', 'x-rag-sources');

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'An error occurred during retrieval/generation' },
            { status: 500 }
        );
    }
}
