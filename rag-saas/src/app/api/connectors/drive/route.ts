import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Note: Ensure `googleapis` is installed via npm (`npm install googleapis`)

export async function POST(req: Request) {
    try {
        const { teamId, folderId, serviceAccountKeyJson: bodyKey } = await req.json();
        const serviceAccountKeyJson = bodyKey || process.env.GOOGLE_DRIVE_KEY;

        if (!teamId || !folderId || !serviceAccountKeyJson) {
            return NextResponse.json({ error: 'Missing required sync parameters (teamId, folderId, or serviceAccountKeyJson/GOOGLE_DRIVE_KEY)' }, { status: 400 });
        }

        // 1. Authenticate with Google API using Service Account Key provided in the request
        // Alternatively, this can be retrieved securely from AWS Secrets / Supabase Vault
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(serviceAccountKeyJson),
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // 2. Fetch all text/pdf files in the folder (MVP: limited to textual docs for simplicity)
        const response = await drive.files.list({
            q: `'${folderId}' in parents and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document') and trashed=false`,
            fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime)',
        });

        const files = response.data.files;
        const documentsToIngest = [];

        // 3. Loop through files and extract content
        if (files) {
            for (const file of files) {
                if (!file.id) continue;

                let content = '';

                if (file.mimeType === 'application/vnd.google-apps.document') {
                    // Export Google Doc as text
                    const exportResponse = await drive.files.export({
                        fileId: file.id,
                        mimeType: 'text/plain',
                    });
                    content = String(exportResponse.data);
                } else if (file.mimeType === 'text/plain') {
                    // Get text content directly
                    const getResponse = await drive.files.get({
                        fileId: file.id,
                        alt: 'media',
                    });
                    content = String(getResponse.data);
                }

                if (content.trim()) {
                    documentsToIngest.push({
                        id: file.id,
                        title: file.name,
                        content: content,
                        path_or_url: file.webViewLink,
                        lang: 'en',
                        page: null,
                    });
                }
            }
        }

        if (documentsToIngest.length === 0) {
            return NextResponse.json({ message: 'No valid documents found in the folder.' });
        }

        // 4. Pass the extracted content to the internal /api/ingest route
        const ingestUrl = new URL('/api/ingest', req.url);
        const ingestResponse = await fetch(ingestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                documents: documentsToIngest,
                teamId,
                source: 'google_drive',
            }),
        });

        const ingestResult = await ingestResponse.json();

        return NextResponse.json({ message: 'Sync complete', ingestedFiles: files?.length, results: ingestResult });

    } catch (error: any) {
        console.error('Google Drive Sync Error:', error.message);
        return NextResponse.json({ error: 'Failed to sync Google Drive' }, { status: 500 });
    }
}
