import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_BUCKET || 'ai-interviewer-sessions';

// Initialize GCS client
let storage: Storage | null = null;
try {
  storage = new Storage();
} catch (error) {
  console.error('Failed to initialize GCS client:', error);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, fullName, timestamp } = body;

    if (!sessionId || !fullName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Save to GCS
    if (storage) {
      try {
        const bucket = storage.bucket(GCS_BUCKET);
        const fileName = `sessions/${sessionId}.json`;
        const file = bucket.file(fileName);

        const sessionData = {
          sessionId,
          fullName,
          timestamp,
          createdAt: new Date().toISOString(),
        };

        await file.save(JSON.stringify(sessionData, null, 2), {
          contentType: 'application/json',
          metadata: {
            fullName,
            timestamp,
          },
        });

        console.log(`Session saved to GCS: ${fileName}`);
      } catch (gcsError) {
        console.error('Failed to save to GCS:', gcsError);
        // Continue even if GCS fails - we'll log it
      }
    }

    // Also save to local storage as backup (in-memory for now)
    // In production, this would be a database
    return NextResponse.json({
      success: true,
      sessionId,
      fullName,
    });
  } catch (error) {
    console.error('Error saving session:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    );
  }
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
    const [files] = await bucket.getFiles({ prefix: 'sessions/' });

    const sessions = await Promise.all(
      files.map(async (file) => {
        const [content] = await file.download();
        return JSON.parse(content.toString());
      })
    );

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

