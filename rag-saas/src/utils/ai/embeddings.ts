/**
 * Generate embeddings using Ollama (local, free, no quota)
 * Uses nomic-embed-text model running on http://localhost:11434
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = 'nomic-embed-text';

/**
 * Generate a single embedding for a query or document chunk.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            input: text.replace(/\n/g, ' '),
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings[0];
}

/**
 * Generate embeddings for multiple document chunks simultaneously.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            input: texts.map((t) => t.replace(/\n/g, ' ')),
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings;
}
