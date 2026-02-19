import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_BUCKET || 'ai-interviewer-sessions';

// Initialize GCS client with explicit settings to avoid AbortSignal issues
let storage: Storage | null = null;
try {
  storage = new Storage({
    // Disable retry to avoid AbortSignal issues
    retryOptions: {
      autoRetry: false,
    },
  });
} catch (error) {
  console.error('Failed to initialize GCS client:', error);
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, fullName, workflow } = body;

    if (!sessionId || !workflow) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, workflow' },
        { status: 400 }
      );
    }

    // Save to GCS
    if (storage) {
      try {
        const bucket = storage.bucket(GCS_BUCKET);
        const fileName = `workflows/${sessionId}.json`;
        const file = bucket.file(fileName);

        // Try to read existing workflows for this session
        let existingWorkflows: Workflow[] = [];
        try {
          const [exists] = await file.exists();
          if (exists) {
            const [content] = await file.download();
            const data = JSON.parse(content.toString());
            existingWorkflows = data.workflows || [];
          }
        } catch (readError) {
          console.log('No existing workflows file, creating new one');
        }

        // Append new workflow
        existingWorkflows.push(workflow);

        const workflowData = {
          sessionId,
          fullName,
          workflows: existingWorkflows,
          updatedAt: new Date().toISOString(),
        };

        // Use stream-based upload to avoid AbortSignal compatibility issues
        const dataStr = JSON.stringify(workflowData, null, 2);
        await new Promise<void>((resolve, reject) => {
          const stream = file.createWriteStream({
            resumable: false,
            contentType: 'application/json',
            metadata: {
              metadata: {
                sessionId,
                fullName: fullName || '',
                workflowCount: existingWorkflows.length.toString(),
              },
            },
          });

          stream.on('error', (err) => {
            console.error('Stream error saving workflow to GCS:', err);
            reject(err);
          });

          stream.on('finish', () => {
            console.log(`Workflow saved to GCS: ${fileName} (total: ${existingWorkflows.length})`);
            resolve();
          });

          stream.end(dataStr);
        });
        
        return NextResponse.json({
          success: true,
          sessionId,
          workflowId: workflow.id,
          totalWorkflows: existingWorkflows.length,
        });
      } catch (gcsError) {
        console.error('Failed to save workflow to GCS:', gcsError);
        return NextResponse.json(
          { error: 'Failed to save workflow to storage' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      workflowId: workflow.id,
      message: 'GCS not configured, workflow logged only',
    });
  } catch (error) {
    console.error('Error saving workflow:', error);
    return NextResponse.json(
      { error: 'Failed to save workflow' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!storage) {
      return NextResponse.json(
        { error: 'GCS not configured' },
        { status: 500 }
      );
    }

    const bucket = storage.bucket(GCS_BUCKET);

    // If sessionId provided, get workflows for that session
    if (sessionId) {
      try {
        const file = bucket.file(`workflows/${sessionId}.json`);
        const [exists] = await file.exists();
        
        if (!exists) {
          return NextResponse.json({ workflows: [] });
        }

        const [content] = await file.download();
        const data = JSON.parse(content.toString());
        return NextResponse.json({ workflows: data.workflows || [] });
      } catch (error) {
        return NextResponse.json({ workflows: [] });
      }
    }

    // Get all workflows
    const [files] = await bucket.getFiles({ prefix: 'workflows/' });

    const allWorkflows = await Promise.all(
      files.map(async (file) => {
        const [content] = await file.download();
        return JSON.parse(content.toString());
      })
    );

    return NextResponse.json({ workflows: allWorkflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

