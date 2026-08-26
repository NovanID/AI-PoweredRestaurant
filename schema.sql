-- ==========================================================
-- PostgreSQL Database Schema for AI-Powered Restaurant MVP
-- Tenant-Aware Single & Multi-Tenant Ready
-- ==========================================================

-- 1. Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM Types
CREATE TYPE table_area_enum AS ENUM ('Indoor', 'Outdoor', 'VIP');
CREATE TYPE table_status_enum AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE menu_category_enum AS ENUM ('Lauk Utama', 'Sayur & Kuah', 'Pelengkap & Sambal', 'Minuman');
CREATE TYPE reservation_status_enum AS ENUM (
    'pending',
    'confirmed',
    'seated',
    'completed',
    'cancelled',
    'rejected',
    'no_show',
    'expired'
);
CREATE TYPE payment_status_enum AS ENUM ('unpaid', 'pending', 'settlement', 'expire', 'cancel');

-- 3. Restaurants / Tenant Table
CREATE TABLE restaurants (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    tagline VARCHAR(255),
    address TEXT NOT NULL,
    city VARCHAR(64) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    opening_hours VARCHAR(128) NOT NULL,
    open_time TIME NOT NULL DEFAULT '10:00:00',
    close_time TIME NOT NULL DEFAULT '22:00:00',
    description TEXT,
    policies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tables
CREATE TABLE tables (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES restaurants(tenant_id) ON DELETE CASCADE,
    table_number VARCHAR(16) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    area table_area_enum NOT NULL DEFAULT 'Indoor',
    status table_status_enum NOT NULL DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_table_number UNIQUE (tenant_id, table_number)
);

-- 5. Menu Items
CREATE TABLE menu_items (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES restaurants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    category menu_category_enum NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    description TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_popular BOOLEAN NOT NULL DEFAULT FALSE,
    spiciness_level SMALLINT DEFAULT 1 CHECK (spiciness_level BETWEEN 1 AND 3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customers
CREATE TABLE customers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES restaurants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    reservation_count INT NOT NULL DEFAULT 1,
    last_visit TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_customer_phone UNIQUE (tenant_id, phone)
);

-- 7. Reservations (With Anti-Double Booking Prevention & Operational Floor Tracking)
CREATE TABLE reservations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES restaurants(tenant_id) ON DELETE CASCADE,
    code VARCHAR(32) UNIQUE NOT NULL, -- e.g. RM-1001
    customer_name VARCHAR(128) NOT NULL,
    customer_phone VARCHAR(32) NOT NULL,
    table_id VARCHAR(64) NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
    table_number VARCHAR(16) NOT NULL,
    table_area table_area_enum NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    guest_count INT NOT NULL CHECK (guest_count > 0),
    status reservation_status_enum NOT NULL DEFAULT 'confirmed',
    auto_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    qr_token VARCHAR(255),
    seated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_status payment_status_enum NOT NULL DEFAULT 'unpaid',
    payment_amount DECIMAL(12, 2),
    payment_method VARCHAR(64),
    snap_token VARCHAR(255),
    payment_paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Audit Trail / Events Log
CREATE TABLE audit_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES restaurants(tenant_id) ON DELETE CASCADE,
    actor VARCHAR(128) NOT NULL, -- 'Customer Web', 'Staff Kasir (Budi)', 'AI Assistant'
    action VARCHAR(64) NOT NULL,  -- 'CREATE_RESERVATION', 'CONFIRM_RESERVATION', 'TOGGLE_MENU'
    entity VARCHAR(128) NOT NULL, -- 'Reservasi RM-1001', 'Menu Rendang'
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Performance & Anti Double-Booking Indexes
CREATE INDEX idx_reservations_lookup ON reservations(tenant_id, reservation_date, reservation_time, status);
CREATE INDEX idx_reservations_code ON reservations(code);
CREATE INDEX idx_menu_lookup ON menu_items(tenant_id, category, is_available);
CREATE INDEX idx_tables_availability ON tables(tenant_id, capacity, area, status);

-- ==========================================================
-- Seed Data Awal Restoran Padang (Raso Minang)
-- ==========================================================
INSERT INTO restaurants (id, tenant_id, name, tagline, address, city, phone, opening_hours, open_time, close_time, description, policies)
VALUES (
    'rest-01',
    'raso-minang-padang-01',
    'Raso Minang',
    'Masakan Padang Autentik & Hangat di Setiap Meja',
    'Jl. Rasa Nusantara No. 8, Kebayoran Baru',
    'Jakarta Selatan',
    '+62 812-3456-7890',
    'Setiap Hari: 10:00 – 22:00 WIB',
    '10:00:00',
    '22:00:00',
    'Menyajikan hidangan Minang otentik dengan racikan rempah warisan leluhur.',
    '["Reservasi meja berstatus pending hingga disetujui staff.", "Batas toleransi kedatangan 15 menit.", "Pembatalan maksimal 1 jam sebelum jadwal."]'::jsonb
);

-- Insert Tables
INSERT INTO tables (id, tenant_id, table_number, capacity, area, status) VALUES
('tbl-1', 'raso-minang-padang-01', 'M-01', 2, 'Indoor', 'available'),
('tbl-2', 'raso-minang-padang-01', 'M-02', 2, 'Indoor', 'available'),
('tbl-3', 'raso-minang-padang-01', 'M-03', 4, 'Indoor', 'available'),
('tbl-4', 'raso-minang-padang-01', 'M-04', 4, 'Indoor', 'available'),
('tbl-5', 'raso-minang-padang-01', 'M-05', 6, 'Indoor', 'available'),
('tbl-6', 'raso-minang-padang-01', 'M-06', 4, 'Outdoor', 'available'),
('tbl-7', 'raso-minang-padang-01', 'M-07', 4, 'Outdoor', 'available'),
('tbl-8', 'raso-minang-padang-01', 'M-08', 6, 'Outdoor', 'available'),
('tbl-9', 'raso-minang-padang-01', 'VIP-01', 8, 'VIP', 'available'),
('tbl-10', 'raso-minang-padang-01', 'VIP-02', 10, 'VIP', 'available');

-- Insert Sample Menu Items
INSERT INTO menu_items (id, tenant_id, name, category, price, description, is_available, is_popular, spiciness_level) VALUES
('menu-1', 'raso-minang-padang-01', 'Rendang Daging Sapi', 'Lauk Utama', 35000, 'Daging sapi pilihan dimasak perlahan 8 jam dengan santan kental dan 16 rempah Minang.', true, true, 2),
('menu-2', 'raso-minang-padang-01', 'Ayam Pop Spesial', 'Lauk Utama', 28000, 'Ayam kampung muda gurih lembut direbus air kelapa, disajikan sambal tomat pop.', true, true, 1),
('menu-3', 'raso-minang-padang-01', 'Dendeng Balado Batokok', 'Lauk Utama', 38000, 'Dendeng sapi renyah gurih dipukul pipih dengan cabai merah ulek kasar.', true, true, 3),
('menu-4', 'raso-minang-padang-01', 'Gulai Tunjang (Kikil)', 'Lauk Utama', 36000, 'Kikil sapi empuk dan kenyal dalam kuah gulai kuning gurih.', true, false, 2),
('menu-5', 'raso-minang-padang-01', 'Gulai Kepala Ikan Kakap', 'Lauk Utama', 65000, 'Kepala kakap merah segar kuah gulai asam pedas daun ruku-ruku.', true, true, 2),
('menu-6', 'raso-minang-padang-01', 'Sayur Daun Singkong & Nangka', 'Sayur & Kuah', 12000, 'Rebusan daun singkong segar berpadu gulai nangka muda gurih.', true, false, 1),
('menu-7', 'raso-minang-padang-01', 'Sambal Ijo Khas Padang', 'Pelengkap & Sambal', 8000, 'Cabai hijau kukus ulek kasar dengan minyak kelapa dan jeruk limau.', true, true, 2),
('menu-8', 'raso-minang-padang-01', 'Teh Talua (Teh Telur)', 'Minuman', 18000, 'Minuman stamina Minang: kocokan kuning telur bebek, gula aren, teh pekat.', true, true, 1),
('menu-9', 'raso-minang-padang-01', 'Es Tebak Tradisional', 'Minuman', 20000, 'Es campur Minang dengan olahan tepung beras tebak, tapai ketan, santan sirup.', true, true, 1);
