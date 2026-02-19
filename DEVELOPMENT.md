# Development Guide

## Local Development Setup

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Google Cloud SDK (for GCS access)
- API Keys:
  - Napster Spaces API Key
  - Google Gemini API Key

### Initial Setup

1. **Clone and Install**:
   ```bash
   cd ai-personal-interviewer
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:
   ```env
   NAPSTER_API_KEY=your_key_here
   GEMINI_API_KEY=your_key_here
   GCS_BUCKET=ai-interviewer-sessions-dev
   ```

3. **Setup GCS (Optional for local dev)**:
   ```bash
   # Login to GCP
   gcloud auth application-default login
   
   # Create dev bucket
   gsutil mb gs://ai-interviewer-sessions-dev
   ```

### Running the Application

#### Frontend (Next.js)

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

Access at: http://localhost:3000

#### Session Monitor (Python)

```bash
# Install dependencies
cd services/session_monitor
pip install -r requirements.txt
cd ../..

# Set environment variables
export NAPSTER_API_KEY=your_key
export GEMINI_API_KEY=your_key
export GCS_BUCKET=ai-interviewer-sessions-dev

# Run once
python -m services.session_monitor.main --once

# Run in daemon mode (every 5 minutes)
python -m services.session_monitor.main --daemon --interval 300
```

## Development Workflow

### Making Changes

1. **Frontend Changes**:
   - Edit files in `app/`
   - Hot reload will update automatically
   - Check browser console for errors

2. **Session Monitor Changes**:
   - Edit files in `services/session_monitor/`
   - Restart the Python process
   - Check terminal output for logs

3. **Testing Changes**:
   - Test interview flow at `/`
   - Check admin panel at `/admin`
   - Verify GCS storage

### Testing Locally

#### Test Interview Flow

1. Start the dev server: `npm run dev`
2. Open http://localhost:3000
3. Enter a test name
4. Start interview and have a conversation
5. Check browser console for session ID
6. Verify session saved to GCS:
   ```bash
   gsutil ls gs://ai-interviewer-sessions-dev/sessions/
   ```

#### Test Session Monitor

1. Have at least one interview session
2. Run the monitor:
   ```bash
   python -m services.session_monitor.main --once
   ```
3. Check output for:
   - Session IDs fetched
   - Transcripts downloaded
   - Summaries generated
4. Verify GCS storage:
   ```bash
   gsutil ls gs://ai-interviewer-sessions-dev/summaries/
   gsutil cat gs://ai-interviewer-sessions-dev/summaries/SESSION_ID.json
   ```

#### Test Admin Panel

1. Open http://localhost:3000/admin
2. Enter PIN: `1001`
3. Verify:
   - Names appear in sidebar
   - Sessions listed under names
   - Clicking session shows data
   - Summary and transcript views work

### Debugging

#### Frontend Debugging

```bash
# Check Next.js logs
npm run dev

# Browser DevTools
# - Console: JavaScript errors
# - Network: API calls
# - Application: Local storage
```

#### Session Monitor Debugging

```bash
# Verbose logging
export LOG_LEVEL=DEBUG
python -m services.session_monitor.main --once

# Check specific components
python -c "from services.session_monitor.napster_client import NapsterSpacesClient; client = NapsterSpacesClient(); print(client.get_session_ids())"

python -c "from services.session_monitor.summarizer import GeminiSummarizer; s = GeminiSummarizer(); print('Gemini initialized')"
```

#### GCS Debugging

```bash
# List all files
gsutil ls -r gs://ai-interviewer-sessions-dev/

# View file contents
gsutil cat gs://ai-interviewer-sessions-dev/sessions/SESSION_ID.json

# Check permissions
gsutil iam get gs://ai-interviewer-sessions-dev/
```

## Code Structure

### Frontend (`app/`)

```
app/
├── layout.tsx              # Root layout
├── globals.css             # Global styles
├── page.tsx                # Main interview page
│   ├── Name capture popup
│   ├── Napster SDK integration
│   └── Session tracking
├── admin/
│   └── page.tsx            # Admin panel
│       ├── PIN authentication
│       ├── Session list
│       └── Summary/transcript view
└── api/
    ├── sessions/
    │   └── route.ts        # Save sessions
    └── admin/
        └── sessions/
            └── route.ts    # Fetch sessions
```

### Session Monitor (`services/session_monitor/`)

```
services/session_monitor/
├── __init__.py
├── config.py               # Configuration & secrets
├── main.py                 # Main service orchestration
├── napster_client.py       # Napster API client
├── summarizer.py           # Gemini AI summarizer
├── state_manager.py        # State persistence
└── requirements.txt        # Python dependencies
```

## Common Development Tasks

### Change Admin PIN

Edit `app/admin/page.tsx`:
```typescript
const ADMIN_PIN = '1001'; // Change this
```

### Modify Summary Prompt

Edit `services/session_monitor/summarizer.py`:
```python
SUMMARY_PROMPT = """Your custom prompt here..."""
```

### Change Experience ID

Edit both:
- `app/page.tsx`: Frontend
- `services/session_monitor/config.py`: Backend

### Add New API Route

1. Create `app/api/your-route/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Use `NextRequest` and `NextResponse`

### Customize Styling

- Global styles: `app/globals.css`
- Tailwind config: `tailwind.config.ts`
- Component styles: Inline Tailwind classes

## Testing Tips

### Mock Data

Create test sessions without running interviews:

```bash
# Create test session
echo '{"sessionId":"test-123","fullName":"Test User","timestamp":"2024-01-01T00:00:00Z"}' | \
  gsutil cp - gs://ai-interviewer-sessions-dev/sessions/test-123.json
```

### Skip Napster API

For testing summarizer without real sessions:

```python
from services.session_monitor.summarizer import GeminiSummarizer
from services.session_monitor.napster_client import SessionTranscript, TranscriptEntry

# Create mock transcript
entries = [
    TranscriptEntry("Hello, how are you?", "agent", 1000),
    TranscriptEntry("I'm doing well, thanks!", "user", 2000),
]
transcript = SessionTranscript("test-session", entries)

# Test summarizer
summarizer = GeminiSummarizer()
summary = summarizer.summarize(transcript)
print(summary.to_dict())
```

## Performance Tips

### Frontend

- Use Next.js Image component for images
- Implement pagination for large session lists
- Add loading states for API calls
- Cache admin panel data

### Session Monitor

- Process sessions in batches
- Add retry logic for API failures
- Implement exponential backoff
- Cache processed session IDs

## Security Considerations

### Development

- Never commit `.env.local`
- Use separate dev/prod buckets
- Rotate API keys regularly
- Test with limited permissions

### Production

- Use Secret Manager for all keys
- Implement proper authentication
- Add rate limiting
- Enable CORS properly
- Use HTTPS only

## Troubleshooting

### "Module not found" errors

```bash
# Clear Next.js cache
rm -rf .next
npm install
npm run dev
```

### Python import errors

```bash
# Reinstall dependencies
pip install -r services/session_monitor/requirements.txt

# Check Python path
python -c "import sys; print(sys.path)"
```

### GCS permission errors

```bash
# Re-authenticate
gcloud auth application-default login

# Check permissions
gsutil iam get gs://your-bucket/
```

## Next Steps

- Add unit tests
- Implement E2E tests
- Add CI/CD pipeline
- Set up staging environment
- Add monitoring/alerting

