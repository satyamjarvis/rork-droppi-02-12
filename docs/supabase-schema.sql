-- Supabase Schema for Delivery App
-- Run this SQL in your Supabase SQL Editor to create all necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('business', 'courier', 'manager');
CREATE TYPE delivery_status AS ENUM ('waiting', 'taken', 'completed');

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role user_role NOT NULL,
  email TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Courier profiles table
CREATE TABLE IF NOT EXISTS courier_profiles (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id TEXT NOT NULL UNIQUE,
  age INTEGER NOT NULL CHECK (age >= 18),
  email TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  is_available BOOLEAN DEFAULT false,
  id_number TEXT,
  current_latitude NUMERIC(10,7),
  current_longitude NUMERIC(10,7),
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT courier_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_courier_profiles_user_id ON courier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_courier_profiles_is_available ON courier_profiles(is_available);

-- Business profiles table
CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT business_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id);

-- Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  business_id TEXT NOT NULL REFERENCES users(id),
  courier_id TEXT REFERENCES users(id),
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status delivery_status DEFAULT 'waiting',
  preparation_time_minutes INTEGER,
  estimated_arrival_minutes INTEGER,
  business_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  business_ready BOOLEAN DEFAULT false,
  picked_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  payment NUMERIC(10,2) DEFAULT 25,
  distance_km NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_business_id ON deliveries(business_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id ON deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courier_profiles_updated_at
  BEFORE UPDATE ON courier_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_profiles_updated_at
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we're using anon key without Supabase Auth)
-- In production, you might want to implement proper authentication
CREATE POLICY "Allow public read access to users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to users" ON users FOR DELETE USING (true);

CREATE POLICY "Allow public read access to courier_profiles" ON courier_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to courier_profiles" ON courier_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to courier_profiles" ON courier_profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to courier_profiles" ON courier_profiles FOR DELETE USING (true);

CREATE POLICY "Allow public read access to business_profiles" ON business_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to business_profiles" ON business_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to business_profiles" ON business_profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to business_profiles" ON business_profiles FOR DELETE USING (true);

CREATE POLICY "Allow public read access to deliveries" ON deliveries FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to deliveries" ON deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to deliveries" ON deliveries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to deliveries" ON deliveries FOR DELETE USING (true);

-- Customers table (for storing customer details by phone number)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  floor TEXT,
  notes TEXT,
  business_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);

-- Add trigger for customers updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policies for customers table
CREATE POLICY "Allow public read access to customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to customers" ON customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to customers" ON customers FOR DELETE USING (true);

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE courier_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE business_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- Insert seed data (default users)
INSERT INTO users (id, name, phone, password, role, email) VALUES
  ('manager-root', 'מנהל ראשי', '+972500000000', '1234', 'manager', 'admin@droppi.co.il'),
  ('manager-operations', 'תמיכה מנהלתית', '+972500000009', '5678', 'manager', 'operations@droppi.co.il'),
  ('manager-central', 'מנהלת סניף מרכז', '+972500000123', '2468', 'manager', 'central@droppi.co.il'),
  ('courier-default', 'דניאל כהן', '+972500000200', '1234', 'courier', 'courier@droppi.co.il'),
  ('courier-noam', 'נועם לוי', '+972500000201', '1234', 'courier', 'noam@droppi.co.il'),
  ('business-default', 'מסעדת הדובדבן', '+972500000300', '1234', 'business', 'hadubdevan@restaurant.co.il'),
  ('business-hummus', 'חומוס אליהו', '+972500000301', '1234', 'business', 'eliyahu@hummus.co.il')
ON CONFLICT (id) DO NOTHING;

-- Insert courier profiles for courier users
INSERT INTO courier_profiles (user_id, age, email, vehicle, is_available) VALUES
  ('courier-default', 28, 'courier@droppi.co.il', 'אופנוע', false),
  ('courier-noam', 25, 'noam@droppi.co.il', 'אופניים חשמליים', false)
ON CONFLICT (user_id) DO NOTHING;

-- Insert business profiles for business users
INSERT INTO business_profiles (user_id, address, email) VALUES
  ('business-default', 'רחוב דיזנגוף 100, תל אביב (32.0853, 34.7818)', 'hadubdevan@restaurant.co.il'),
  ('business-hummus', 'רחוב בן יהודה 45, תל אביב (32.0802, 34.7706)', 'eliyahu@hummus.co.il')
ON CONFLICT (user_id) DO NOTHING;
