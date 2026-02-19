# AI Personal Interviewer

An AI-powered interview application that conducts interactive video interviews using Napster Spaces SDK and provides an admin panel for reviewing sessions.

## Features

- **Interactive AI Interviews**: Conduct interviews with an AI avatar using Napster Spaces SDK
- **Name Capture**: Collects participant's full name before starting the interview
- **Session Tracking**: Links names to session IDs for easy identification
- **Automated Summaries**: Uses Google Gemini AI to generate interview summaries
- **Admin Panel**: Review all interviews with PIN-protected access (PIN: 1001)
- **Cloud Storage**: Stores sessions, transcripts, and summaries in Google Cloud Storage
- **Automated Processing**: Background service runs every 5 minutes to process new sessions

## Architecture

### Frontend (Next.js)
- **Main Interview Page** (`/`): Captures name and starts interview
- **Admin Panel** (`/admin`): PIN-protected dashboard for reviewing sessions

### Backend Services
- **Session Monitor**: Python service that:
  - Fetches transcripts from Napster Spaces API
  - Generates summaries using Gemini AI
  - Stores data in Google Cloud Storage
  - Runs every 5 minutes via Cloud Scheduler

### Data Storage (GCS)
- `sessions/`: Session metadata (name, timestamp, session ID)
- `transcripts/`: Full conversation transcripts
- `summaries/`: AI-generated summaries with insights

## Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Google Cloud Platform account
- Napster Spaces API key
- Google Gemini API key

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
export GCS_BUCKET=ai-interviewer-sessions
export NAPSTER_API_KEY=your_napster_api_key
export GEMINI_API_KEY=your_gemini_api_key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

### Deploy to Google Cloud

1. Setup GCP resources:
```bash
chmod +x scripts/setup-gcp.sh
./scripts/setup-gcp.sh
```

2. Add API keys to Secret Manager:
```bash
echo -n 'YOUR_NAPSTER_API_KEY' | gcloud secrets create napster-api-key --data-file=-
echo -n 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key --data-file=-
```

3. Deploy with Cloud Build:
```bash
gcloud builds submit --config cloudbuild.yaml
```

4. Create Cloud Scheduler job:
```bash
# Get the session-monitor URL from Cloud Run
SESSION_MONITOR_URL=$(gcloud run services describe session-monitor --region=us-central1 --format='value(status.url)')

# Create scheduler job (runs every 5 minutes)
gcloud scheduler jobs create http session-monitor-job \
  --location=us-central1 \
  --schedule='*/5 * * * *' \
  --uri="$SESSION_MONITOR_URL" \
  --http-method=POST \
  --oidc-service-account-email=$(gcloud iam service-accounts list --filter="email:*-compute@developer.gserviceaccount.com" --format="value(email)")
```

## Admin Panel

Access the admin panel at `/admin` with PIN: **1001**

Features:
- **Left Sidebar**: List of names (collapsible) with sessions grouped by date/time
- **Right Panel**: 
  - Session summary with AI-generated insights
  - Full transcript view
  - Suggested actions

## Configuration

### Experience ID
The Napster Spaces experience ID is configured in:
- `app/page.tsx` (frontend)
- `services/session_monitor/config.py` (backend)

Current ID: `YWIzZGI5ZWItMWIxOC00MzVlLTkxN2UtYTgzZjJiNDVmM2I1OjFiY2FiMGFkLTA4NDktNDdlMS04MjM0LTFhNDFhYTZmYzQ1Zg==`

### Admin PIN
Change the admin PIN in `app/admin/page.tsx`:
```typescript
const ADMIN_PIN = '1001';
```

## Project Structure

```
ai-personal-interviewer/
├── app/                          # Next.js application
│   ├── page.tsx                  # Main interview page
│   ├── admin/page.tsx            # Admin panel
│   └── api/                      # API routes
│       ├── sessions/route.ts     # Session storage
│       └── admin/sessions/route.ts # Admin data fetching
├── services/
│   └── session_monitor/          # Python session monitor
│       ├── main.py               # Main service
│       ├── napster_client.py     # Napster API client
│       ├── summarizer.py         # Gemini AI summarizer
│       ├── state_manager.py      # State persistence
│       └── config.py             # Configuration
├── Dockerfile                    # Next.js container
├── cloudbuild.yaml              # GCP deployment config
└── scripts/
    └── setup-gcp.sh             # GCP setup script
```

## License

MIT

