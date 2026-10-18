CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
ALTER TABLE task_comments ADD COLUMN author_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_notes ADD COLUMN author_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
-- Repair ownership left empty by the legacy restore, only when unambiguous.
UPDATE projects p SET owner_id = m.user_id FROM (
  SELECT project_id, MIN(user_id) AS user_id FROM project_members
  WHERE role='owner' GROUP BY project_id HAVING COUNT(*)=1
) m WHERE p.id=m.project_id AND p.owner_id IS NULL;
INSERT INTO project_members (project_id,user_id,role)
SELECT id,owner_id,'owner' FROM projects WHERE owner_id IS NOT NULL
ON CONFLICT (project_id,user_id) DO UPDATE SET role='owner';
