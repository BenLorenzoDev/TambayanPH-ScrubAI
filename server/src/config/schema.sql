-- TambayanPH ScrubAI Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('agent', 'supervisor', 'admin')),
  extension VARCHAR(20),
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'break', 'offline')),
  team VARCHAR(100),
  skills TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'outbound' CHECK (type IN ('inbound', 'outbound', 'blended')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'completed', 'draft')),
  dial_mode VARCHAR(20) DEFAULT 'preview' CHECK (dial_mode IN ('preview', 'progressive', 'predictive')),
  caller_id VARCHAR(50),
  script TEXT,
  dispositions JSONB DEFAULT '[]',
  working_hours JSONB DEFAULT '{"start": "09:00", "end": "18:00", "timezone": "Asia/Manila", "days": [1,2,3,4,5]}',
  max_attempts INT DEFAULT 3,
  retry_interval INT DEFAULT 60,
  created_by UUID REFERENCES users(id),
  stats JSONB DEFAULT '{"totalLeads": 0, "contacted": 0, "converted": 0, "pending": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign assigned agents (many-to-many)
CREATE TABLE campaign_agents (
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, user_id)
);

-- Leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  phone VARCHAR(50) NOT NULL,
  alt_phone VARCHAR(50),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  address JSONB,
  custom_fields JSONB,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'callback', 'converted', 'not_interested', 'dnc', 'invalid')),
  assigned_agent UUID REFERENCES users(id),
  priority INT DEFAULT 0,
  attempts INT DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  next_callback TIMESTAMPTZ,
  last_disposition VARCHAR(100),
  notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calls table
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id),
  lead_id UUID REFERENCES leads(id),
  agent_id UUID REFERENCES users(id) NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy')),
  call_sid VARCHAR(100),
  start_time TIMESTAMPTZ,
  answer_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration INT DEFAULT 0,
  talk_time INT DEFAULT 0,
  recording_url TEXT,
  recording_sid VARCHAR(100),
  disposition VARCHAR(100),
  notes TEXT,
  transferred_to VARCHAR(100),
  transferred_by UUID REFERENCES users(id),
  events JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_leads_campaign ON leads(campaign_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_assigned_agent ON leads(assigned_agent);
CREATE INDEX idx_leads_next_callback ON leads(next_callback);
CREATE INDEX idx_calls_agent ON calls(agent_id);
CREATE INDEX idx_calls_campaign ON calls(campaign_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional, for added security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - can be customized)
-- Allow service role full access
CREATE POLICY "Service role has full access to users" ON users FOR ALL USING (true);
CREATE POLICY "Service role has full access to campaigns" ON campaigns FOR ALL USING (true);
CREATE POLICY "Service role has full access to leads" ON leads FOR ALL USING (true);
CREATE POLICY "Service role has full access to calls" ON calls FOR ALL USING (true);
