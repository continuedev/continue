-- Migration: Create workflow template tables
-- Version: 1.0.0
-- Description: Initial schema for workflow templates feature

-- ============================================================
-- TEMPLATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  version VARCHAR(50) NOT NULL,
  author VARCHAR(255) NOT NULL,

  -- Categorization
  category VARCHAR(50) NOT NULL,
  tags TEXT[], -- Array of tags
  difficulty VARCHAR(20) NOT NULL,

  -- Technical details
  code TEXT NOT NULL,
  mcp_servers TEXT[] NOT NULL, -- Array of MCP server names
  trigger_types TEXT[] NOT NULL, -- Array of 'cron' or 'webhook'

  -- Configuration
  config_schema JSONB NOT NULL,
  default_config JSONB NOT NULL,

  -- Metrics
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_duration INTEGER NOT NULL DEFAULT 0,
  token_reduction INTEGER NOT NULL DEFAULT 0,

  -- Documentation
  use_cases TEXT[],
  example_output_url TEXT,
  documentation_url TEXT,

  -- Permissions
  required_permissions TEXT[],

  -- Analytics
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2),
  rating DECIMAL(3,2),

  -- Visibility
  visibility VARCHAR(20) DEFAULT 'public',
  organization_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_category (category),
  INDEX idx_visibility (visibility),
  INDEX idx_organization (organization_id),
  INDEX idx_difficulty (difficulty)
);

-- ============================================================
-- WORKFLOWS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS workflows (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),

  -- Source
  template_id VARCHAR(255),
  template_version VARCHAR(50),

  -- Configuration
  repository_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  code TEXT NOT NULL,
  config JSONB NOT NULL,

  -- Trigger
  trigger_type VARCHAR(20) NOT NULL,
  cron_expression VARCHAR(100),
  webhook_secret VARCHAR(255),

  -- Status
  enabled BOOLEAN DEFAULT true,
  last_execution_at TIMESTAMP,
  next_execution_at TIMESTAMP,

  -- Notifications
  notification_config JSONB,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,

  -- Indexes
  INDEX idx_user (user_id),
  INDEX idx_organization (organization_id),
  INDEX idx_template (template_id),
  INDEX idx_enabled (enabled),
  INDEX idx_next_execution (next_execution_at),
  INDEX idx_trigger_type (trigger_type)
);

-- ============================================================
-- WORKFLOW EXECUTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS workflow_executions (
  id VARCHAR(255) PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,

  -- Trigger
  triggered_by VARCHAR(20) NOT NULL,
  triggered_at TIMESTAMP NOT NULL,
  trigger_payload JSONB,

  -- Execution
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,

  -- Results
  result JSONB,
  error JSONB,

  -- Metrics
  tokens_used INTEGER DEFAULT 0,
  mcp_call_count INTEGER DEFAULT 0,

  -- Resources
  sandbox_id VARCHAR(255),

  -- Indexes
  INDEX idx_workflow (workflow_id),
  INDEX idx_status (status),
  INDEX idx_triggered_at (triggered_at),
  INDEX idx_completed_at (completed_at),

  -- Foreign keys
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- ============================================================
-- EXECUTION LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS execution_logs (
  id SERIAL PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,

  -- Indexes
  INDEX idx_execution (execution_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_level (level),

  -- Foreign keys
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

-- ============================================================
-- WEBHOOKS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id VARCHAR(255) PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events TEXT[] NOT NULL,

  -- Status
  enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_workflow (workflow_id),
  INDEX idx_enabled (enabled),

  -- Foreign keys
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,

  -- Constraints
  UNIQUE(workflow_id) -- One webhook per workflow
);

-- ============================================================
-- TEMPLATE USAGE ANALYTICS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS template_analytics (
  id SERIAL PRIMARY KEY,
  template_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),

  -- Event
  event_type VARCHAR(50) NOT NULL, -- 'view', 'instantiate', 'execute', 'rate'
  event_data JSONB,

  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_template (template_id),
  INDEX idx_user (user_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at),

  -- Foreign keys
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for templates
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for workflows
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for webhooks
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VIEWS
-- ============================================================

-- View for template statistics
CREATE OR REPLACE VIEW template_stats AS
SELECT
  t.id,
  t.name,
  t.category,
  COUNT(DISTINCT w.id) as workflow_count,
  COUNT(DISTINCT we.id) as total_executions,
  SUM(CASE WHEN we.status = 'success' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(we.id), 0) * 100 as success_rate,
  AVG(we.duration_ms) as avg_duration_ms,
  SUM(we.tokens_used) as total_tokens_used
FROM templates t
LEFT JOIN workflows w ON t.id = w.template_id
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
GROUP BY t.id, t.name, t.category;

-- View for workflow execution history
CREATE OR REPLACE VIEW workflow_execution_summary AS
SELECT
  w.id as workflow_id,
  w.name as workflow_name,
  we.id as execution_id,
  we.triggered_by,
  we.triggered_at,
  we.status,
  we.duration_ms,
  we.tokens_used,
  we.mcp_call_count,
  CASE
    WHEN we.error IS NOT NULL THEN (we.error->>'message')::TEXT
    ELSE NULL
  END as error_message
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
ORDER BY we.triggered_at DESC;

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- Insert sample data (optional)
-- This would be populated by the template registry at startup
