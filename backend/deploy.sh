#!/usr/bin/env bash
# Deploy the EldenGuard backend to Google Cloud Run.
# Usage: SAFE_BROWSING_API_KEY=xxx GEMINI_API_KEY=xxx ./deploy.sh PROJECT_ID

if [ -z "$1" ]; then
  echo "Usage: $0 <GCP_PROJECT_ID>"
  exit 1
fi

PROJECT_ID="$1"

gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SAFE_BROWSING_API_KEY="$SAFE_BROWSING_API_KEY",_GEMINI_API_KEY="$GEMINI_API_KEY"

echo "Deployment complete. Backend URL: https://eldenguard-backend-539581830876.us-central1.run.app"