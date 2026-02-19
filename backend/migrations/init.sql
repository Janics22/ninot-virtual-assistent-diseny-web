-- Code Pet SaaS - Database Schema

-- Drop tables if exist
DROP TABLE IF EXISTS analysis_history CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  
  -- Stripe fields
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255),
  
  -- Usage control
  analyses_count INTEGER DEFAULT 0,
  current_period_end TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analysis history table
CREATE TABLE analysis_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url VARCHAR(2048) NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_plan ON users(plan);
CREATE INDEX idx_analysis_user_id ON analysis_history(user_id);
CREATE INDEX idx_analysis_created_at ON analysis_history(created_at DESC);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert test user (password: test123)
INSERT INTO users (email, password_hash, plan) 
VALUES ('test@codepet.com', '$2b$10$xQnJ9Z.Q8X5qKj0F9qKj0O9qKj0F9qKj0F9qKj0F9qKj0F9qKj0F', 'free');