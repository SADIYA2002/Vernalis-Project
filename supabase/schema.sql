-- ===========================================================================
-- Chrono Attendance & Statutory Payroll Platform — Supabase PostgreSQL Schema
-- ===========================================================================
-- Run this script in your Supabase project's SQL Editor (supabase.com/dashboard).
-- It creates all tables, foreign keys, indexes, and populates initial demo data.
-- ===========================================================================

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  manager_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  base_role TEXT NOT NULL CHECK (base_role IN ('employee', 'manager', 'hr', 'payroll')),
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'wfh', 'half-day', 'late', 'leave', 'absent', 'weekend', 'holiday')),
  check_in TEXT,
  check_out TEXT,
  worked_hours NUMERIC DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('biometric', 'web', 'correction', 'leave')),
  corrected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_date UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, date);

-- 3. Correction Requests Table
CREATE TABLE IF NOT EXISTS correction_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  requested_check_in TEXT,
  requested_check_out TEXT,
  reason TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'rejected')),
  reviewer_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  review_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrections_employee ON correction_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_corrections_state ON correction_requests(state);

-- 4. Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('casual', 'sick', 'earned', 'unpaid')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'rejected')),
  reviewer_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  review_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_state ON leave_requests(state);

-- 5. Leave Balances Table
CREATE TABLE IF NOT EXISTS leave_balances (
  employee_id TEXT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  casual NUMERIC NOT NULL DEFAULT 10,
  sick NUMERIC NOT NULL DEFAULT 8,
  earned NUMERIC NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Payroll Locks Table
CREATE TABLE IF NOT EXISTS payroll_locks (
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  PRIMARY KEY (period_start, period_end)
);

-- ===========================================================================
-- SEED DATA: EMPLOYEES & INITIAL DEMO SETUP
-- ===========================================================================

INSERT INTO employees (id, name, email, department, designation, manager_id, base_role, monthly_salary)
VALUES
  ('mgr-01', 'Vikram Rao', 'vikram.rao@acme.co', 'Engineering', 'Engineering Manager', NULL, 'manager', 210000),
  ('hr-01', 'Meera Joshi', 'meera.joshi@acme.co', 'Human Resources', 'HR Manager', NULL, 'hr', 175000),
  ('pay-01', 'Sanjay Verma', 'sanjay.verma@acme.co', 'Finance', 'Payroll Officer', NULL, 'payroll', 145000),
  ('emp-01', 'Sadiya Mulla', 'sadiya.mulla@acme.co', 'Engineering', 'Software Engineer', 'mgr-01', 'employee', 120000),
  ('emp-02', 'Rohan Mehta', 'rohan.mehta@acme.co', 'Engineering', 'QA Engineer', 'mgr-01', 'employee', 95000),
  ('emp-03', 'Ananya Patel', 'ananya.patel@acme.co', 'Engineering', 'Frontend Engineer', 'mgr-01', 'employee', 110000),
  ('emp-04', 'Kabir Nair', 'kabir.nair@acme.co', 'Product', 'Product Designer', 'mgr-01', 'employee', 105000),
  ('emp-05', 'Priya Sharma', 'priya.sharma@acme.co', 'Operations', 'Operations Lead', 'mgr-01', 'employee', 80000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  designation = EXCLUDED.designation,
  manager_id = EXCLUDED.manager_id,
  base_role = EXCLUDED.base_role,
  monthly_salary = EXCLUDED.monthly_salary;

-- Initial Leave Balances
INSERT INTO leave_balances (employee_id, casual, sick, earned)
VALUES
  ('emp-01', 8, 7, 14),
  ('emp-02', 6, 8, 12),
  ('emp-03', 10, 5, 15),
  ('emp-04', 7, 8, 13),
  ('emp-05', 9, 6, 11),
  ('mgr-01', 9, 8, 15),
  ('hr-01', 10, 8, 15),
  ('pay-01', 10, 8, 15)
ON CONFLICT (employee_id) DO NOTHING;

-- Initial Period Lock state for August 2026
INSERT INTO payroll_locks (period_start, period_end, locked)
VALUES ('2026-08-01', '2026-08-31', false)
ON CONFLICT (period_start, period_end) DO NOTHING;

-- Initial Seed Correction Requests
INSERT INTO correction_requests (id, employee_id, date, from_status, to_status, requested_check_in, requested_check_out, reason, state, submitted_at)
VALUES
  ('cor-1', 'emp-01', '2026-08-04', 'late', 'present', '09:05', '18:10', 'Biometric scanner delayed at lobby entrance during morning rush', 'pending', '2026-08-04T10:15:00Z'),
  ('cor-2', 'emp-02', '2026-08-11', 'absent', 'wfh', '09:15', '18:30', 'Forgot to mark WFH in portal due to urgent deployment', 'pending', '2026-08-12T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Initial Seed Leave Requests
INSERT INTO leave_requests (id, employee_id, type, from_date, to_date, days, reason, state, submitted_at)
VALUES
  ('lv-1', 'emp-01', 'casual', '2026-08-28', '2026-08-28', 1, 'Attending family function', 'pending', '2026-08-20T11:00:00Z'),
  ('lv-2', 'emp-03', 'sick', '2026-08-18', '2026-08-19', 2, 'Viral fever recovery', 'approved', '2026-08-17T08:30:00Z')
ON CONFLICT (id) DO NOTHING;
