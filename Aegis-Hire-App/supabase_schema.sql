-- Supabase Database Schema for Aegis Hire
-- Run this SQL in your Supabase SQL editor to create the necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create resumes table to store parsed resume data
CREATE TABLE IF NOT EXISTS resumes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    raw_text TEXT NOT NULL,
    parsed_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create resume_sessions table to group resumes for screening
CREATE TABLE IF NOT EXISTS resume_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_name TEXT,
    job_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create junction table to link resumes to sessions
CREATE TABLE IF NOT EXISTS session_resumes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES resume_sessions(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, resume_id)
);

-- Create screening_results table to store screening analysis
CREATE TABLE IF NOT EXISTS screening_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES resume_sessions(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    candidate_name TEXT,
    rank INTEGER NOT NULL,
    justification JSONB NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resumes_file_name ON resumes(file_name);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);
CREATE INDEX IF NOT EXISTS idx_resume_sessions_created_at ON resume_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_screening_results_session_id ON screening_results(session_id);
CREATE INDEX IF NOT EXISTS idx_screening_results_rank ON screening_results(rank);

-- Enable Row Level Security (RLS)
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_results ENABLE ROW LEVEL SECURITY;

-- Create policies (you may want to adjust these based on your auth strategy)
-- For now, allow all operations (remove this in production)
CREATE POLICY "Enable all operations for resumes" ON resumes FOR ALL USING (true);
CREATE POLICY "Enable all operations for resume_sessions" ON resume_sessions FOR ALL USING (true);
CREATE POLICY "Enable all operations for session_resumes" ON session_resumes FOR ALL USING (true);
CREATE POLICY "Enable all operations for screening_results" ON screening_results FOR ALL USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resume_sessions_updated_at BEFORE UPDATE ON resume_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
