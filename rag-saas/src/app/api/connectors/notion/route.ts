import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

export async function POST(req: Request) {
    try {
        const { teamId, notionToken: bodyToken, databaseId } = await req.json();
        const notionToken = bodyToken || process.env.NOTION_INTEGRATION_TOKEN;

        if (!teamId || !notionToken || !databaseId) {
            return NextResponse.json({ error: 'Missing Notion sync parameters (teamId, databaseId, or notionToken/NOTION_INTEGRATION_TOKEN)' }, { status: 400 });
        }

        const notion = new Client({ auth: notionToken });

        // 1. Query the database for pages
        const response = await (notion.databases as any).query({ database_id: databaseId });
        const documentsToIngest = [];

        // 2. Loop through pages to extract content blocks
        for (const page of response.results) {
            if (!('url' in page)) continue;

            const pageId = page.id;
            // Fetch page blocks (children)
            const blocks = await notion.blocks.children.list({ block_id: pageId });

            let content = '';

            blocks.results.forEach((block: any) => {
                // Very basic extraction of text from common Notion block types
                if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
                    content += block.paragraph.rich_text.map((t: any) => t.plain_text).join('') + '\n\n';
                }
                if (block.type === 'heading_1' && block.heading_1.rich_text.length > 0) {
                    content += '# ' + block.heading_1.rich_text.map((t: any) => t.plain_text).join('') + '\n\n';
                }
                if (block.type === 'heading_2' && block.heading_2.rich_text.length > 0) {
                    content += '## ' + block.heading_2.rich_text.map((t: any) => t.plain_text).join('') + '\n\n';
                }
                if (block.type === 'heading_3' && block.heading_3.rich_text.length > 0) {
                    content += '### ' + block.heading_3.rich_text.map((t: any) => t.plain_text).join('') + '\n\n';
                }
                if (block.type === 'bulleted_list_item' && block.bulleted_list_item.rich_text.length > 0) {
                    content += '- ' + block.bulleted_list_item.rich_text.map((t: any) => t.plain_text).join('') + '\n';
                }
            });

            // Try to extract title from properties (assuming a standard DB)
            let title = 'Untitled Notion Page';
            if ('properties' in page) {
                const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title');
                if (titleProp && (titleProp as any).title.length > 0) {
                    title = (titleProp as any).title.map((t: any) => t.plain_text).join('');
                }
            }

            if (content.trim()) {
                documentsToIngest.push({
                    id: page.id,
                    title: title,
                    content: content,
                    path_or_url: page.url,
                    lang: 'en',
                    page: null,
                });
            }
        }

        if (documentsToIngest.length === 0) {
            return NextResponse.json({ message: 'No textual content found in your Notion database.' });
        }

        // 3. Send over to the ingestion pipeline
        const ingestUrl = new URL('/api/ingest', req.url);
        const ingestResponse = await fetch(ingestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                documents: documentsToIngest,
                teamId,
                source: 'notion',
            }),
        });

        const ingestResult = await ingestResponse.json();
        return NextResponse.json({ message: 'Notion Sync Complete', results: ingestResult });

    } catch (error: any) {
        console.error('Notion Sync Error:', error.message);
        return NextResponse.json({ error: 'Failed to sync Notion workspace' }, { status: 500 });
    }
}
