# Quick Start Guide

Get the AI Personal Interviewer running in 10 minutes!

## Local Development (No Cloud Required)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
NAPSTER_API_KEY=your_napster_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GCS_BUCKET=ai-interviewer-sessions
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Test the Interview

1. Enter your full name in the popup
2. Click "Start Interview"
3. Have a conversation with the AI avatar

### 5. Access Admin Panel

1. Go to [http://localhost:3000/admin](http://localhost:3000/admin)
2. Enter PIN: `1001`
3. View your sessions (note: summaries require the session monitor to be running)

## Running Session Monitor Locally

The session monitor processes interviews and generates summaries.

### 1. Install Python Dependencies

```bash
cd services/session_monitor
pip install -r requirements.txt
cd ../..
```

### 2. Set Environment Variables

```bash
export NAPSTER_API_KEY=your_napster_api_key
export GEMINI_API_KEY=your_gemini_api_key
export GCS_BUCKET=ai-interviewer-sessions
```

### 3. Run the Monitor (One-Time)

```bash
python -m services.session_monitor.main --once
```

### 4. Run the Monitor (Continuous)

```bash
python -m services.session_monitor.main --daemon --interval 300
```

This will check for new sessions every 5 minutes (300 seconds).

## Cloud Deployment (Production)

For production deployment to Google Cloud Platform, see [DEPLOYMENT.md](DEPLOYMENT.md).

Quick deploy:

```bash
# 1. Setup GCP
export GCP_PROJECT_ID=your-project-id
./scripts/setup-gcp.sh

# 2. Add secrets
echo -n 'YOUR_NAPSTER_API_KEY' | gcloud secrets create napster-api-key --data-file=-
echo -n 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key --data-file=-

# 3. Deploy
gcloud builds submit --config cloudbuild.yaml

# 4. Setup scheduler
SESSION_MONITOR_URL=$(gcloud run services describe session-monitor --region=us-central1 --format='value(status.url)')
SERVICE_ACCOUNT=$(gcloud iam service-accounts list --filter="email:*-compute@developer.gserviceaccount.com" --format="value(email)")

gcloud scheduler jobs create http session-monitor-job \
    --location=us-central1 \
    --schedule='*/5 * * * *' \
    --uri="$SESSION_MONITOR_URL" \
    --http-method=POST \
    --oidc-service-account-email=$SERVICE_ACCOUNT \
    --oidc-token-audience=$SESSION_MONITOR_URL
```

## Testing

### Test Interview Flow

1. **Start Interview**: Enter name and begin conversation
2. **Check Session Storage**: 
   ```bash
   # Local: Check browser console for session ID
   # Cloud: Check GCS bucket
   gsutil ls gs://ai-interviewer-sessions/sessions/
   ```

### Test Session Monitor

1. **Run Monitor**:
   ```bash
   python -m services.session_monitor.main --once
   ```

2. **Check Output**:
   - Should fetch session IDs from Napster API
   - Should download transcripts
   - Should generate summaries with Gemini
   - Should save to GCS

3. **Verify Results**:
   ```bash
   # Check summaries
   gsutil ls gs://ai-interviewer-sessions/summaries/
   
   # View a summary
   gsutil cat gs://ai-interviewer-sessions/summaries/SESSION_ID.json
   ```

### Test Admin Panel

1. **Access**: Go to `/admin`
2. **Login**: Enter PIN `1001`
3. **Verify**:
   - Names appear in left sidebar
   - Sessions grouped by name
   - Clicking session shows summary
   - Transcript view works

## Common Issues

### "SDK not loaded"
- Check browser console for errors
- Verify Napster Spaces SDK URL is accessible
- Check network tab for failed requests

### "No sessions appearing"
- Verify GCS bucket exists and has correct permissions
- Check API routes are working (`/api/sessions`)
- Look at browser network tab for API errors

### "Summaries not generating"
- Verify Gemini API key is valid
- Check session monitor logs
- Ensure sessions have meaningful content (at least 2 exchanges)

### "Admin panel shows no data"
- Wait 5 minutes after interview for processing
- Manually trigger session monitor
- Check GCS bucket has data

## Next Steps

1. **Customize Interview Prompt**: Edit the Napster Spaces experience
2. **Change Admin PIN**: Update `app/admin/page.tsx`
3. **Modify Summary Format**: Edit `services/session_monitor/summarizer.py`
4. **Add Authentication**: Implement proper auth for admin panel
5. **Custom Styling**: Update Tailwind classes in components

## Support

- Check [README.md](README.md) for architecture details
- See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Review logs for debugging:
  ```bash
  # Cloud Run logs
  gcloud run services logs read ai-interviewer --region=us-central1
  gcloud run services logs read session-monitor --region=us-central1
  ```

## API Keys

### Napster Spaces API Key
Get from: Napster Spaces Dashboard
- Sign up at napsterai.dev
- Create an experience
- Copy the API key

### Google Gemini API Key
Get from: [ai.google.dev](https://ai.google.dev)
- Sign in with Google account
- Go to "Get API Key"
- Create new key or use existing

Both keys are free to start with generous quotas!

