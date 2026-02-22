import { NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';

export async function POST(req: Request) {
    try {
        const { teamId, slackToken: bodyToken, channelId } = await req.json();
        const slackToken = bodyToken || process.env.SLACK_BOT_TOKEN;

        if (!teamId || !slackToken || !channelId) {
            return NextResponse.json({ error: 'Missing Slack sync parameters (teamId, channelId, or slackToken/SLACK_BOT_TOKEN)' }, { status: 400 });
        }

        const slack = new WebClient(slackToken);
        const documentsToIngest = [];

        // 1. Fetch channel history
        const history = await slack.conversations.history({
            channel: channelId,
            limit: 100, // MVP limit
        });

        if (!history.messages) {
            return NextResponse.json({ message: 'No messages found in channel' });
        }

        // 2. Extract content from pinned messages and files
        for (const msg of history.messages) {
            // Focus on pinned messages as "important" knowledge OR messages with files
            // For MVP, we'll ingest all substantial text messages > 100 chars

            let content = msg.text || '';

            // If there are files (like snippets), try to get their public URL or text
            if (msg.files) {
                for (const file of msg.files) {
                    if (file.mimetype === 'text/plain') {
                        // Slack file content requires an authenticated GET request to file.url_private
                        try {
                            const fileRes = await fetch(file.url_private as string, {
                                headers: { Authorization: `Bearer ${slackToken}` }
                            });
                            if (fileRes.ok) {
                                content += '\n\n[Attached File Content:]\n' + await fileRes.text();
                            }
                        } catch (e) {
                            console.warn(`Failed to fetch file content for ${file.id}`, e);
                        }
                    }
                }
            }

            if (content.trim().length > 100) { // Arbitrary cut-off for "meaningful" knowledge
                documentsToIngest.push({
                    id: msg.client_msg_id || msg.ts,
                    title: `Slack Message from ${msg.user}`,
                    content: content,
                    path_or_url: `slack://channel?id=${channelId}&msg=${msg.ts}`,
                    lang: 'en',
                    page: null,
                });
            }
        }

        if (documentsToIngest.length === 0) {
            return NextResponse.json({ message: 'No substantial textual content found in your Slack channel.' });
        }

        // 3. Send over to the ingestion pipeline
        const ingestUrl = new URL('/api/ingest', req.url);
        const ingestResponse = await fetch(ingestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                documents: documentsToIngest,
                teamId,
                source: 'slack',
            }),
        });

        const ingestResult = await ingestResponse.json();
        return NextResponse.json({ message: 'Slack Sync Complete', results: ingestResult });

    } catch (error: any) {
        console.error('Slack Sync Error:', error.message);
        return NextResponse.json({ error: 'Failed to sync Slack channel' }, { status: 500 });
    }
}
