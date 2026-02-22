import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { generateEmbeddings } from '@/utils/ai/embeddings';

// Dummy text chunker for MVP
// In a real app use LangChain's RecursiveCharacterTextSplitter
function chunkText(text: string, maxTokens: number = 500): string[] {
    const paragraphs = text.split('\n\n');
    return paragraphs.filter((p) => p.trim().length > 0);
}

// Simple Regex-based PII detector
function containsPII(text: string): { hasPII: boolean; type?: string } {
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/;
    const apiKeyRegex = /([A-Za-z0-9_]{20,})/; // Very naive catch-all

    if (ssnRegex.test(text)) return { hasPII: true, type: 'SSN' };
    if (apiKeyRegex.test(text) && text.includes('key')) return { hasPII: true, type: 'API_KEY' };

    return { hasPII: false };
}

export async function POST(req: Request) {
    try {
        const { documents, teamId, uploaderId, source = 'local' } = await req.json();

        if (!teamId || !documents || !Array.isArray(documents)) {
            return NextResponse.json({ error: 'teamId and an array of documents are required' }, { status: 400 });
        }

        const supabase = await createAdminClient();
        const results = [];

        for (const doc of documents) {
            // 1. PII Check
            const piiCheck = containsPII(doc.content);
            if (piiCheck.hasPII) {
                // Quarantine it
                const { error: quarantineError } = await supabase.from('quarantine_records').insert({
                    storage_path: `.tmp/quarantine/manual_${Date.now()}.txt`,
                    original_filename: doc.title || 'Untitled',
                    detected_pii_type: piiCheck.type,
                    uploader_id: uploaderId,
                    team_id: teamId,
                });

                results.push({ title: doc.title, status: 'quarantined', reason: piiCheck.type });
                continue;
            }

            // 2. Chunking
            const chunks = chunkText(doc.content);

            // 3. Embeddings mapping
            const embeddings = await generateEmbeddings(chunks);

            // 4. Formatting for pgvector insertion
            const recordsToInsert = chunks.map((chunk, i) => ({
                content: chunk,
                embedding: embeddings[i],
                source,
                source_id: doc.id || `manual-${Date.now()}-${i}`,
                title: doc.title,
                path_or_url: doc.path_or_url || null,
                page: doc.page || null,
                lang: doc.lang || 'en',
                uploader_id: uploaderId,
                team_id: teamId,
            }));

            // 5. Insert to Supabase DB
            const { error: insertError } = await supabase.from('documents').insert(recordsToInsert);

            if (insertError) {
                console.error('Insert error:', insertError);
                results.push({ title: doc.title, status: 'failed', error: insertError.message });
            } else {
                results.push({ title: doc.title, status: 'success', chunks_indexed: chunks.length });
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Ingestion API Error:', error);
        return NextResponse.json({ error: 'An error occurred during ingestion' }, { status: 500 });
    }
}
