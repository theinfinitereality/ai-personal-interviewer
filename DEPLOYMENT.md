# Deployment Guide

## Prerequisites

1. **Google Cloud Platform Account**
   - Create a project at [console.cloud.google.com](https://console.cloud.google.com)
   - Enable billing for the project

2. **API Keys**
   - **Napster Spaces API Key**: Get from Napster Spaces dashboard
   - **Google Gemini API Key**: Get from [ai.google.dev](https://ai.google.dev)

3. **Install Tools**
   ```bash
   # Install Google Cloud SDK
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   
   # Login to GCP
   gcloud auth login
   gcloud auth application-default login
   ```

## Step 1: Configure GCP Project

```bash
# Set your project ID
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    cloudscheduler.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com
```

## Step 2: Create GCS Bucket

```bash
# Create bucket for storing sessions
export BUCKET_NAME="ai-interviewer-sessions"
gsutil mb -p $GCP_PROJECT_ID -c STANDARD -l us-central1 gs://$BUCKET_NAME/

# Make bucket accessible (or configure IAM as needed)
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
```

## Step 3: Store API Keys in Secret Manager

```bash
# Store Napster API Key
echo -n 'YOUR_NAPSTER_API_KEY' | gcloud secrets create napster-api-key --data-file=-

# Store Gemini API Key
echo -n 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key --data-file=-

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding napster-api-key \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding gemini-api-key \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## Step 4: Deploy with Cloud Build

```bash
# Submit build
gcloud builds submit --config cloudbuild.yaml

# This will:
# 1. Build Next.js application Docker image
# 2. Build Session Monitor Docker image
# 3. Deploy both to Cloud Run
# 4. Configure environment variables and secrets
```

## Step 5: Setup Cloud Scheduler

```bash
# Get the session-monitor service URL
SESSION_MONITOR_URL=$(gcloud run services describe session-monitor \
    --region=us-central1 \
    --format='value(status.url)')

# Get the compute service account
SERVICE_ACCOUNT=$(gcloud iam service-accounts list \
    --filter="email:*-compute@developer.gserviceaccount.com" \
    --format="value(email)")

# Create Cloud Scheduler job (runs every 5 minutes)
gcloud scheduler jobs create http session-monitor-job \
    --location=us-central1 \
    --schedule='*/5 * * * *' \
    --uri="$SESSION_MONITOR_URL" \
    --http-method=POST \
    --oidc-service-account-email=$SERVICE_ACCOUNT \
    --oidc-token-audience=$SESSION_MONITOR_URL

# Verify the job was created
gcloud scheduler jobs describe session-monitor-job --location=us-central1
```

## Step 6: Grant Permissions

```bash
# Allow Cloud Scheduler to invoke the session-monitor service
gcloud run services add-iam-policy-binding session-monitor \
    --region=us-central1 \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/run.invoker"
```

## Step 7: Test the Deployment

1. **Get the application URL**:
   ```bash
   gcloud run services describe ai-interviewer \
       --region=us-central1 \
       --format='value(status.url)'
   ```

2. **Open the URL** in your browser

3. **Test the interview flow**:
   - Enter your full name
   - Start the interview
   - Have a conversation with the AI

4. **Access the admin panel**:
   - Go to `https://your-url/admin`
   - Enter PIN: `1001`
   - Wait 5 minutes for the session monitor to process your session

## Step 8: Trigger Manual Session Processing (Optional)

```bash
# Manually trigger the session monitor
curl -X POST $SESSION_MONITOR_URL \
    -H "Authorization: Bearer $(gcloud auth print-identity-token)"
```

## Monitoring

### View Logs

```bash
# Next.js application logs
gcloud run services logs read ai-interviewer --region=us-central1

# Session monitor logs
gcloud run services logs read session-monitor --region=us-central1

# Cloud Scheduler logs
gcloud scheduler jobs logs session-monitor-job --location=us-central1
```

### Check GCS Bucket

```bash
# List sessions
gsutil ls gs://$BUCKET_NAME/sessions/

# List summaries
gsutil ls gs://$BUCKET_NAME/summaries/

# List transcripts
gsutil ls gs://$BUCKET_NAME/transcripts/

# View a specific file
gsutil cat gs://$BUCKET_NAME/sessions/SESSION_ID.json
```

## Troubleshooting

### Session Monitor Not Running

1. Check Cloud Scheduler job status:
   ```bash
   gcloud scheduler jobs describe session-monitor-job --location=us-central1
   ```

2. Manually trigger the job:
   ```bash
   gcloud scheduler jobs run session-monitor-job --location=us-central1
   ```

3. Check logs for errors:
   ```bash
   gcloud run services logs read session-monitor --region=us-central1 --limit=50
   ```

### Sessions Not Appearing in Admin Panel

1. Verify GCS bucket has data:
   ```bash
   gsutil ls -r gs://$BUCKET_NAME/
   ```

2. Check API permissions for the Next.js app

3. Verify environment variables:
   ```bash
   gcloud run services describe ai-interviewer --region=us-central1 --format=yaml
   ```

### API Key Issues

1. Verify secrets exist:
   ```bash
   gcloud secrets list
   ```

2. Check secret values:
   ```bash
   gcloud secrets versions access latest --secret=napster-api-key
   gcloud secrets versions access latest --secret=gemini-api-key
   ```

## Updating the Application

```bash
# Make your changes, then redeploy
gcloud builds submit --config cloudbuild.yaml
```

## Cost Optimization

- **Cloud Run**: Scales to zero when not in use
- **Cloud Scheduler**: Minimal cost (~$0.10/month)
- **GCS**: Pay for storage used
- **Gemini API**: Pay per request

Estimated monthly cost for low usage: **$5-10/month**

## Security Notes

1. **Admin PIN**: Change the default PIN in `app/admin/page.tsx`
2. **Secrets**: Never commit API keys to version control
3. **IAM**: Review and restrict service account permissions as needed
4. **HTTPS**: Cloud Run provides automatic HTTPS

