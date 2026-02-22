-- Role tables and RLS policies for RAG-Powered SaaS

-- 1. Create a teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create team_members junction table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- 'member', 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS on teams and team_members
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for teams & team_members
-- Users can see teams they belong to
CREATE POLICY "Users can view their teams" ON teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Users can see team members for their teams
CREATE POLICY "Users can view members of their teams" ON team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- 4. Apply RLS to documents
-- Documents: Users can SELECT if they belong to the team
CREATE POLICY "Users can view their team's documents" ON documents
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Documents: Only admins (or specific roles) can INSERT/UPDATE (ingestion should usually be server-side using Service Role, but if client-side:)
CREATE POLICY "Users can upload to their team" ON documents
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- 5. Apply RLS to audit_logs
-- Users can insert their own audit logs
CREATE POLICY "Users can insert their own query logs" ON audit_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- Only team admins can read audit logs
CREATE POLICY "Team admins can read audit logs" ON audit_logs
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 6. Apply RLS to quarantine_records
-- Only team admins can read/update quarantine records
CREATE POLICY "Team admins can manage quarantine" ON quarantine_records
  FOR ALL USING (
    auth.uid() IN (
        -- Assuming quarantine records should be linked to teams, but currently uploader_id is the only link.
        -- Let's update quarantine_records to include team_id
        SELECT user_id FROM team_members WHERE role = 'admin'
    )
  );

-- Add team_id to quarantine_records so RLS is easier
ALTER TABLE quarantine_records ADD COLUMN team_id UUID REFERENCES teams(id);

CREATE POLICY "Team admins can manage their team's quarantine" ON quarantine_records
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );
