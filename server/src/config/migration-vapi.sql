-- Migration to add VAPI support to calls table
-- Run this in Supabase SQL Editor

-- Add vapi_call_id column to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS vapi_call_id VARCHAR(100);

-- Add index for vapi_call_id
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id ON calls(vapi_call_id);

-- Update status check constraint to include more statuses
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_status_check;
ALTER TABLE calls ADD CONSTRAINT calls_status_check
  CHECK (status IN ('queued', 'initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy', 'transferred'));

-- Add started_at and ended_at columns for better tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Rename phone to phone_number for consistency (optional)
-- ALTER TABLE calls RENAME COLUMN phone TO phone_number;
