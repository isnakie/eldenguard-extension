#!/usr/bin/env bash
# Deploy the EldenGuard backend to Google Cloud Run.
# Usage: ./deploy.sh PROJECT_ID

if [ -z "$1" ]; then
  echo "Usage: $0 <GCP_PROJECT_ID>"
  exit 1
fi

PROJECT_ID="$1"

gcloud builds submit --config cloudbuild.yaml --substitutions=_SAFE_BROWSING_API_KEY="$SAFE_BROWSING_API_KEY"

echo "Deployment is complete. Update the extension backend URL to your Cloud Run service URL."
