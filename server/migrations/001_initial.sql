CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      username   TEXT UNIQUE,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS meetings (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL DEFAULT '#7a9e7e',
      archived   BOOLEAN NOT NULL DEFAULT false,
      owner_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS projects (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL DEFAULT '#6366f1',
      archived   BOOLEAN NOT NULL DEFAULT false,
      owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_id, user_id)
    );

CREATE TABLE IF NOT EXISTS tasks (
      id           SERIAL PRIMARY KEY,
      project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title        TEXT    NOT NULL,
      responsible  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_date     DATE,
      done         BOOLEAN NOT NULL DEFAULT false,
      done_at      DATE,
      priority     TEXT
    );

CREATE TABLE IF NOT EXISTS task_comments (
      id         SERIAL PRIMARY KEY,
      task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author     TEXT,
      text       TEXT    NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS project_notes (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text       TEXT    NOT NULL,
      author     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_due       ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_done      ON tasks(done);

CREATE INDEX IF NOT EXISTS idx_comments_task   ON task_comments(task_id);

CREATE INDEX IF NOT EXISTS idx_notes_project   ON project_notes(project_id);

CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_members_user    ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_meetings_owner   ON meetings(owner_id);



ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_projects_meeting ON projects(meeting_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
