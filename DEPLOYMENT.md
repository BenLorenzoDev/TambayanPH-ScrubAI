# Railway Deployment Guide

This guide covers deploying TambayanPH-ScrubAI to Railway with separate services for the server and client.

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository connected to Railway
3. Supabase project with schema deployed
4. VAPI account with configured assistant

## Deployment Steps

### Step 1: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your TambayanPH-ScrubAI repository

### Step 2: Deploy Server Service

1. In Railway dashboard, click "New Service"
2. Select "GitHub Repo" → choose your repo
3. Set the root directory to `server`
4. Railway will auto-detect the Node.js app

**Environment Variables for Server:**

```
NODE_ENV=production
PORT=5001

# Supabase
SUPABASE_URL=https://yhdkkslscdyqxapycdcb.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# JWT
JWT_SECRET=your-strong-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# VAPI
VAPI_API_KEY=your-vapi-api-key
VAPI_ASSISTANT_ID=your-vapi-assistant-id
VAPI_PHONE_ID=your-vapi-phone-id

# Client URL (update after deploying client)
CLIENT_URL=https://your-client-service.up.railway.app
```

5. Click "Deploy"
6. Note the server URL (e.g., `https://tambayanph-server-production.up.railway.app`)

### Step 3: Deploy Client Service

1. In the same Railway project, click "New Service"
2. Select "GitHub Repo" → choose your repo
3. Set the root directory to `client`

**Environment Variables for Client:**

```
VITE_API_URL=https://your-server-service.up.railway.app
```

4. Click "Deploy"
5. Note the client URL

### Step 4: Update Server's CLIENT_URL

1. Go back to the server service
2. Update the `CLIENT_URL` variable to point to your client URL
3. Redeploy the server

### Step 5: Configure VAPI Webhook

1. Go to VAPI Dashboard (https://dashboard.vapi.ai)
2. Navigate to Account Settings
3. Set Server URL to: `https://your-server-service.up.railway.app/api/vapi/webhook`

### Step 6: Run Database Migration

Run the VAPI migration in Supabase SQL Editor:

```sql
-- Add vapi_call_id column to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS vapi_call_id VARCHAR(100);

-- Add index for vapi_call_id
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id ON calls(vapi_call_id);

-- Update status check constraint
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
ALTER TABLE calls ADD CONSTRAINT calls_status_check
  CHECK (status IN ('queued', 'initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy', 'transferred'));

-- Add tracking columns
ALTER TABLE calls ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
```

## Custom Domains (Optional)

### Server Domain
1. In Railway, go to your server service
2. Click "Settings" → "Domains"
3. Add custom domain (e.g., `api.yourdomain.com`)
4. Update DNS records as shown

### Client Domain
1. In Railway, go to your client service
2. Click "Settings" → "Domains"
3. Add custom domain (e.g., `app.yourdomain.com`)
4. Update DNS records as shown

## Monitoring & Logs

- **Logs**: Railway dashboard → Service → "Deployments" → Click deployment → "Logs"
- **Metrics**: Railway dashboard → Service → "Metrics"
- **Health Check**: Server exposes `/health` endpoint

## Troubleshooting

### CORS Errors
Ensure `CLIENT_URL` in server matches your client's deployed URL exactly.

### Socket Connection Issues
1. Check that both services are using HTTPS
2. Verify `VITE_API_URL` points to the correct server URL
3. Socket.io falls back to polling if WebSocket fails

### VAPI Calls Not Working
1. Verify VAPI credentials in environment variables
2. Check webhook URL is correctly set in VAPI dashboard
3. View server logs for VAPI API errors

### Database Connection Issues
1. Verify Supabase URL and keys are correct
2. Check if Supabase project is active
3. Ensure RLS policies allow service role access

## Environment Variables Reference

### Server Variables
| Variable | Description | Required |
|----------|-------------|----------|
| NODE_ENV | Environment (production) | Yes |
| PORT | Server port | Yes |
| SUPABASE_URL | Supabase project URL | Yes |
| SUPABASE_ANON_KEY | Supabase anon key | Yes |
| SUPABASE_SERVICE_KEY | Supabase service key | Yes |
| JWT_SECRET | Secret for JWT tokens | Yes |
| JWT_EXPIRES_IN | Token expiration | Yes |
| VAPI_API_KEY | VAPI API key | Yes |
| VAPI_ASSISTANT_ID | VAPI assistant ID | Yes |
| VAPI_PHONE_ID | VAPI phone ID | Yes |
| CLIENT_URL | Frontend URL for CORS | Yes |

### Client Variables
| Variable | Description | Required |
|----------|-------------|----------|
| VITE_API_URL | Backend server URL | Yes |

## Updating Deployments

Railway auto-deploys when you push to the connected branch. To manually trigger:

1. Go to service in Railway
2. Click "Deployments"
3. Click "Redeploy"

## Scaling

Railway allows you to:
- Add more memory/CPU in service settings
- Enable autoscaling (Pro plan)
- Add replicas for high availability
