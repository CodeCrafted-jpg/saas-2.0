import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';

/**
 * Generate a single embedding for a query or document chunk.
 * Uses text-embedding-3-small as defined in architecture.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text.replace(/\n/g, ' '), // Openai recommends replacing newlines with spaces
    });
    return embedding;
}

/**
 * Generate embeddings for multiple document chunks simultaneously.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: texts.map((t) => t.replace(/\n/g, ' ')),
    });
    return embeddings;
}
