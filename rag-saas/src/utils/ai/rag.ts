import { createAdminClient } from '@/utils/supabase/server';
import { generateEmbedding } from '@/utils/ai/embeddings';

export interface RetrievedDocument {
    id: string;
    title: string | null;
    snippet: string;
    path: string | null;
    page: number | null;
    similarity: number;
}

/**
 * Searches the Supabase vector store for the closest chunks to the query.
 * @param query text to search for
 * @param teamId the team scope to restrict the search mapped to RLS
 * @param matchThreshold minimum cosine similarity (e.g. 0.35)
 * @param matchCount number of chunks to return
 */
export async function retrieveRelevantDocuments(
    query: string,
    teamId: string,
    matchThreshold: number = 0.35,
    matchCount: number = 5
): Promise<RetrievedDocument[]> {
    // Generate embedding for the incoming query
    const queryEmbedding = await generateEmbedding(query);

    const supabase = await createAdminClient();

    // Call the Postgres function (Edge function / stored procedure) to match documents
    // Note: we need to create a match_documents Postgres function to execute the query
    // For safety against SQL injection & RLS, RPCs are preferred for pgvector.
    const { data: documents, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_team_id: teamId,
    });

    if (error) {
        console.error('Error fetching documents from pgvector:', error);
        throw new Error('Failed to retrieve documents.');
    }

    // Transform raw RPC output into strongly typed interface
    return (documents || []).map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        snippet: doc.content,
        path: doc.path_or_url,
        page: doc.page,
        similarity: doc.similarity,
    }));
}
