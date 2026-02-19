import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_BUCKET || 'ai-interviewer-sessions';

let storage: Storage | null = null;
try {
  storage = new Storage();
} catch (error) {
  console.error('Failed to initialize GCS client:', error);
}

export async function GET(request: NextRequest) {
  try {
    if (!storage) {
      return NextResponse.json(
        { error: 'GCS not configured' },
        { status: 500 }
      );
    }

    const bucket = storage.bucket(GCS_BUCKET);
    
    // Get all session files
    const [sessionFiles] = await bucket.getFiles({ prefix: 'sessions/' });

    // Get all summary files
    const [summaryFiles] = await bucket.getFiles({ prefix: 'summaries/' });

    // Get all transcript files
    const [transcriptFiles] = await bucket.getFiles({ prefix: 'transcripts/' });

    // Get all workflow files
    const [workflowFiles] = await bucket.getFiles({ prefix: 'workflows/' });

    // Create maps for quick lookup
    const summaryMap = new Map();
    const transcriptMap = new Map();
    const workflowMap = new Map();

    // Load summaries
    await Promise.all(
      summaryFiles.map(async (file) => {
        try {
          const [content] = await file.download();
          const summary = JSON.parse(content.toString());
          const sessionId = file.name.replace('summaries/', '').replace('.json', '');
          summaryMap.set(sessionId, summary);
        } catch (error) {
          console.error(`Failed to load summary ${file.name}:`, error);
        }
      })
    );

    // Load transcripts
    await Promise.all(
      transcriptFiles.map(async (file) => {
        try {
          const [content] = await file.download();
          const transcript = JSON.parse(content.toString());
          const sessionId = file.name.replace('transcripts/', '').replace('.json', '');
          transcriptMap.set(sessionId, transcript);
        } catch (error) {
          console.error(`Failed to load transcript ${file.name}:`, error);
        }
      })
    );

    // Load workflows
    await Promise.all(
      workflowFiles.map(async (file) => {
        try {
          const [content] = await file.download();
          const workflowData = JSON.parse(content.toString());
          const sessionId = file.name.replace('workflows/', '').replace('.json', '');
          workflowMap.set(sessionId, workflowData.workflows || []);
        } catch (error) {
          console.error(`Failed to load workflow ${file.name}:`, error);
        }
      })
    );

    // Load sessions and enrich with summaries, transcripts, and workflows
    const sessions = await Promise.all(
      sessionFiles.map(async (file) => {
        try {
          const [content] = await file.download();
          const session = JSON.parse(content.toString());
          const sessionId = session.sessionId;

          return {
            ...session,
            summary: summaryMap.get(sessionId),
            transcript: transcriptMap.get(sessionId),
            workflows: workflowMap.get(sessionId) || [],
          };
        } catch (error) {
          console.error(`Failed to load session ${file.name}:`, error);
          return null;
        }
      })
    );

    // Filter out null values and sort by timestamp
    const validSessions = sessions
      .filter((s) => s !== null)
      .sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    return NextResponse.json({ sessions: validSessions });
  } catch (error) {
    console.error('Error fetching admin sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

