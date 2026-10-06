CREATE TABLE IF NOT EXISTS sksa_attendance_months (
  teacher_ic TEXT NOT NULL CHECK (teacher_ic ~ '^[0-9]{12}$'),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  class_key TEXT NOT NULL,
  class_name TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  captured_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL,
  PRIMARY KEY (teacher_ic, year, class_key, month)
);
