-- ==============================================================================
-- NITI UP Custom Hiring Centre (CHC) — Safe Supabase Migration & Schema Fix
-- Fully Idempotent, Non-Destructive, Preserves All Imported Text IDs & Data
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. RECONCILE & EXPAND EXISTING TABLES (ALTER TABLE IF EXISTS)
-- ------------------------------------------------------------------------------

-- (A) CENTRES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'centres') THEN
        -- Add alias column 'id' as TEXT matching centre_id (never UUID)
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS id TEXT;
        UPDATE public.centres SET id = centre_id WHERE id IS NULL;

        -- Add application expected columns
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        UPDATE public.centres SET name = centre_name WHERE name IS NULL AND centre_name IS NOT NULL;

        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS code VARCHAR(50);
        UPDATE public.centres SET code = centre_id WHERE code IS NULL;

        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Uttar Pradesh';
        UPDATE public.centres SET state = 'Uttar Pradesh' WHERE state IS NULL;

        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';
        UPDATE public.centres SET status = 'ACTIVE' WHERE status IS NULL;

        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255);
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30);
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 26.8467;
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 80.9462;
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS operating_radius_km DOUBLE PRECISION DEFAULT 25.0;
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    ELSE
        -- Fallback table creation if starting fresh
        CREATE TABLE public.centres (
            centre_id TEXT PRIMARY KEY,
            id TEXT,
            centre_name VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            code VARCHAR(50) UNIQUE,
            district VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL DEFAULT 'Uttar Pradesh',
            region VARCHAR(100),
            village VARCHAR(150),
            owner_type VARCHAR(100),
            num_operators INTEGER DEFAULT 0,
            manager_name VARCHAR(255),
            contact_phone VARCHAR(30),
            contact_email VARCHAR(255),
            latitude DOUBLE PRECISION DEFAULT 26.8467,
            longitude DOUBLE PRECISION DEFAULT 80.9462,
            operating_radius_km DOUBLE PRECISION DEFAULT 25.0,
            status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        );
    END IF;
END $$;

-- (B) MACHINERY TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'machinery') THEN
        -- Add alias column 'id' as TEXT matching machine_id
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS id TEXT;
        UPDATE public.machinery SET id = machine_id WHERE id IS NULL;

        -- Reconcile application fields
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        UPDATE public.machinery SET name = machine_type WHERE name IS NULL AND machine_type IS NOT NULL;

        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS category VARCHAR(50);
        UPDATE public.machinery 
        SET category = CASE 
            WHEN machine_type ILIKE '%thresher%' THEN 'post-harvest'
            WHEN machine_type ILIKE '%harvester%' OR machine_type ILIKE '%combine%' THEN 'harvesters'
            WHEN machine_type ILIKE '%rotavator%' THEN 'rotavators'
            WHEN machine_type ILIKE '%sprayer%' THEN 'sprayers'
            WHEN machine_type ILIKE '%leveler%' OR machine_type ILIKE '%leveller%' THEN 'land-prep'
            WHEN machine_type ILIKE '%seeder%' OR machine_type ILIKE '%drill%' THEN 'seed-drills'
            WHEN machine_type ILIKE '%tiller%' THEN 'power-tillers'
            ELSE 'tractors'
        END
        WHERE category IS NULL;

        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS rate NUMERIC(10, 2);
        UPDATE public.machinery 
        SET rate = COALESCE(hourly_rate_inr, rate_per_acre_inr) 
        WHERE rate IS NULL;

        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS rate_unit VARCHAR(20);
        UPDATE public.machinery 
        SET rate_unit = CASE WHEN billing_basis ILIKE 'acre' THEN 'Acre' ELSE 'Hour' END 
        WHERE rate_unit IS NULL;

        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Available';
        UPDATE public.machinery SET status = 'Available' WHERE status IS NULL;

        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
        UPDATE public.machinery SET registration_number = machine_id WHERE registration_number IS NULL;

        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS horsepower DOUBLE PRECISION;
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS operator_included BOOLEAN DEFAULT true;
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS fuel_included BOOLEAN DEFAULT false;
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS district VARCHAR(100);
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Uttar Pradesh';
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS village VARCHAR(150);
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '/assets/card-e.jpg';
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.machinery ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    ELSE
        CREATE TABLE public.machinery (
            machine_id TEXT PRIMARY KEY,
            id TEXT,
            centre_id TEXT REFERENCES public.centres(centre_id) ON DELETE CASCADE,
            machine_type VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            category VARCHAR(50),
            hourly_rate_inr NUMERIC(10, 2),
            rate_per_acre_inr NUMERIC(10, 2),
            billing_basis VARCHAR(50) DEFAULT 'hour',
            rate NUMERIC(10, 2),
            rate_unit VARCHAR(20) DEFAULT 'Hour',
            status VARCHAR(30) NOT NULL DEFAULT 'Available',
            horsepower DOUBLE PRECISION,
            registration_number VARCHAR(100),
            operator_included BOOLEAN DEFAULT true,
            fuel_included BOOLEAN DEFAULT false,
            district VARCHAR(100),
            state VARCHAR(100) DEFAULT 'Uttar Pradesh',
            village VARCHAR(150),
            image_url TEXT DEFAULT '/assets/card-e.jpg',
            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        );
    END IF;
END $$;

-- (C) OPERATORS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operators') THEN
        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS id TEXT;
        UPDATE public.operators SET id = operator_id WHERE id IS NULL;

        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS skills TEXT;
        UPDATE public.operators SET skills = machine_skills WHERE skills IS NULL AND machine_skills IS NOT NULL;

        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
        UPDATE public.operators SET is_available = true WHERE is_available IS NULL;

        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);
        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION;
        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS total_jobs_completed INTEGER;
        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    ELSE
        CREATE TABLE public.operators (
            operator_id TEXT PRIMARY KEY,
            id TEXT,
            centre_id TEXT REFERENCES public.centres(centre_id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            village VARCHAR(150),
            district VARCHAR(100),
            machine_skills TEXT,
            skills TEXT,
            experience_years DOUBLE PRECISION,
            is_available BOOLEAN NOT NULL DEFAULT true,
            phone_number VARCHAR(30),
            license_number VARCHAR(50),
            rating DOUBLE PRECISION,
            total_jobs_completed INTEGER DEFAULT 0,
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        );
    END IF;
END $$;

-- (D) FARMERS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'farmers') THEN
        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS id TEXT;
        UPDATE public.farmers SET id = farmer_id WHERE id IS NULL;

        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
        UPDATE public.farmers SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS farm_size DOUBLE PRECISION;
        UPDATE public.farmers SET farm_size = land_area_acre WHERE farm_size IS NULL AND land_area_acre IS NOT NULL;

        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS farm_size_unit VARCHAR(20) DEFAULT 'acres';
        UPDATE public.farmers SET farm_size_unit = 'acres' WHERE farm_size_unit IS NULL;

        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS primary_crops TEXT;
        UPDATE public.farmers SET primary_crops = main_crop WHERE primary_crops IS NULL AND main_crop IS NOT NULL;

        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Uttar Pradesh';
        UPDATE public.farmers SET state = 'Uttar Pradesh' WHERE state IS NULL;

        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'hi';
        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    ELSE
        CREATE TABLE public.farmers (
            farmer_id TEXT PRIMARY KEY,
            id TEXT,
            name VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            village VARCHAR(150),
            district VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL DEFAULT 'Uttar Pradesh',
            region VARCHAR(100),
            land_area_acre DOUBLE PRECISION,
            farm_size DOUBLE PRECISION,
            farm_size_unit VARCHAR(20) DEFAULT 'acres',
            main_crop VARCHAR(100),
            primary_crops TEXT,
            phone_number VARCHAR(30),
            email VARCHAR(255),
            preferred_language VARCHAR(10) DEFAULT 'hi',
            onboarding_completed BOOLEAN DEFAULT false,
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        );
    END IF;
END $$;

-- (E) BOOKINGS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS id TEXT;
        UPDATE public.bookings SET id = booking_id WHERE id IS NULL;

        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(50);
        UPDATE public.bookings SET booking_reference = booking_id WHERE booking_reference IS NULL;

        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_date DATE;
        UPDATE public.bookings 
        SET scheduled_date = booking_date::date 
        WHERE scheduled_date IS NULL AND booking_date IS NOT NULL;

        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_price NUMERIC(10, 2);
        UPDATE public.bookings 
        SET total_price = amount_inr 
        WHERE total_price IS NULL AND amount_inr IS NOT NULL;

        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC(10, 2);
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS farm_area DOUBLE PRECISION;
        UPDATE public.bookings 
        SET farm_area = area_worked_acre 
        WHERE farm_area IS NULL AND area_worked_acre IS NOT NULL;

        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Completed';
        UPDATE public.bookings SET status = 'Completed' WHERE status IS NULL;

        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS operation VARCHAR(100) DEFAULT 'Agricultural Operation';
        UPDATE public.bookings SET operation = 'Agricultural Operation' WHERE operation IS NULL;

        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(50) DEFAULT '08:00 – 12:00';
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS crop VARCHAR(100);
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS field_location TEXT;
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS fuel_included BOOLEAN DEFAULT false;
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS operator_included BOOLEAN DEFAULT true;
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS special_instructions TEXT;
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS offer_price_per_acre NUMERIC(10, 2);
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS offer_duration_hours VARCHAR(50);
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS offer_machine_model VARCHAR(255);
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS complaint_status VARCHAR(50);
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS complaint_category VARCHAR(100);
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS complaint_text TEXT;
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS complaint_created_at TIMESTAMPTZ;
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    ELSE
        CREATE TABLE public.bookings (
            booking_id TEXT PRIMARY KEY,
            id TEXT,
            booking_reference VARCHAR(50) UNIQUE,
            farmer_id TEXT REFERENCES public.farmers(farmer_id) ON DELETE CASCADE,
            centre_id TEXT REFERENCES public.centres(centre_id) ON DELETE RESTRICT,
            machine_id TEXT REFERENCES public.machinery(machine_id) ON DELETE RESTRICT,
            operator_id TEXT REFERENCES public.operators(operator_id) ON DELETE SET NULL,
            booking_date DATE,
            scheduled_date DATE,
            scheduled_time VARCHAR(50) DEFAULT '08:00 – 12:00',
            operation VARCHAR(100) NOT NULL DEFAULT 'Agricultural Operation',
            crop VARCHAR(100),
            area_worked_acre DOUBLE PRECISION,
            farm_area DOUBLE PRECISION,
            hours DOUBLE PRECISION,
            amount_inr NUMERIC(10, 2),
            total_price NUMERIC(10, 2),
            rate_per_unit NUMERIC(10, 2),
            farmer_rating INTEGER,
            status VARCHAR(50) NOT NULL DEFAULT 'Pending',
            fuel_included BOOLEAN DEFAULT false,
            operator_included BOOLEAN DEFAULT true,
            field_location TEXT,
            special_instructions TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. SYNCHRONIZATION TRIGGERS FOR DUAL-FIELD COMPATIBILITY
-- ------------------------------------------------------------------------------

-- Sync centres
CREATE OR REPLACE FUNCTION public.fn_sync_centres()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL AND NEW.centre_id IS NOT NULL THEN
        NEW.id := NEW.centre_id;
    ELSIF NEW.centre_id IS NULL AND NEW.id IS NOT NULL THEN
        NEW.centre_id := NEW.id;
    END IF;

    IF NEW.name IS NULL AND NEW.centre_name IS NOT NULL THEN
        NEW.name := NEW.centre_name;
    ELSIF NEW.centre_name IS NULL AND NEW.name IS NOT NULL THEN
        NEW.centre_name := NEW.name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_centres ON public.centres;
CREATE TRIGGER trg_sync_centres
BEFORE INSERT OR UPDATE ON public.centres
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_centres();

-- Sync machinery
CREATE OR REPLACE FUNCTION public.fn_sync_machinery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL AND NEW.machine_id IS NOT NULL THEN
        NEW.id := NEW.machine_id;
    ELSIF NEW.machine_id IS NULL AND NEW.id IS NOT NULL THEN
        NEW.machine_id := NEW.id;
    END IF;

    IF NEW.name IS NULL AND NEW.machine_type IS NOT NULL THEN
        NEW.name := NEW.machine_type;
    ELSIF NEW.machine_type IS NULL AND NEW.name IS NOT NULL THEN
        NEW.machine_type := NEW.name;
    END IF;

    IF NEW.rate IS NULL AND NEW.hourly_rate_inr IS NOT NULL THEN
        NEW.rate := NEW.hourly_rate_inr;
    ELSIF NEW.hourly_rate_inr IS NULL AND NEW.rate IS NOT NULL THEN
        NEW.hourly_rate_inr := NEW.rate;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_machinery ON public.machinery;
CREATE TRIGGER trg_sync_machinery
BEFORE INSERT OR UPDATE ON public.machinery
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_machinery();

-- Sync operators
CREATE OR REPLACE FUNCTION public.fn_sync_operators()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL AND NEW.operator_id IS NOT NULL THEN
        NEW.id := NEW.operator_id;
    ELSIF NEW.operator_id IS NULL AND NEW.id IS NOT NULL THEN
        NEW.operator_id := NEW.id;
    END IF;

    IF NEW.skills IS NULL AND NEW.machine_skills IS NOT NULL THEN
        NEW.skills := NEW.machine_skills;
    ELSIF NEW.machine_skills IS NULL AND NEW.skills IS NOT NULL THEN
        NEW.machine_skills := NEW.skills;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_operators ON public.operators;
CREATE TRIGGER trg_sync_operators
BEFORE INSERT OR UPDATE ON public.operators
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_operators();

-- Sync farmers
CREATE OR REPLACE FUNCTION public.fn_sync_farmers()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL AND NEW.farmer_id IS NOT NULL THEN
        NEW.id := NEW.farmer_id;
    ELSIF NEW.farmer_id IS NULL AND NEW.id IS NOT NULL THEN
        NEW.farmer_id := NEW.id;
    END IF;

    IF NEW.full_name IS NULL AND NEW.name IS NOT NULL THEN
        NEW.full_name := NEW.name;
    ELSIF NEW.name IS NULL AND NEW.full_name IS NOT NULL THEN
        NEW.name := NEW.full_name;
    END IF;

    IF NEW.farm_size IS NULL AND NEW.land_area_acre IS NOT NULL THEN
        NEW.farm_size := NEW.land_area_acre;
    ELSIF NEW.land_area_acre IS NULL AND NEW.farm_size IS NOT NULL THEN
        NEW.land_area_acre := NEW.farm_size;
    END IF;

    IF NEW.primary_crops IS NULL AND NEW.main_crop IS NOT NULL THEN
        NEW.primary_crops := NEW.main_crop;
    ELSIF NEW.main_crop IS NULL AND NEW.primary_crops IS NOT NULL THEN
        NEW.main_crop := NEW.primary_crops;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_farmers ON public.farmers;
CREATE TRIGGER trg_sync_farmers
BEFORE INSERT OR UPDATE ON public.farmers
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_farmers();

-- Sync bookings
CREATE OR REPLACE FUNCTION public.fn_sync_bookings()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL AND NEW.booking_id IS NOT NULL THEN
        NEW.id := NEW.booking_id;
    ELSIF NEW.booking_id IS NULL AND NEW.id IS NOT NULL THEN
        NEW.booking_id := NEW.id;
    END IF;

    IF NEW.booking_reference IS NULL AND NEW.booking_id IS NOT NULL THEN
        NEW.booking_reference := NEW.booking_id;
    END IF;

    IF NEW.total_price IS NULL AND NEW.amount_inr IS NOT NULL THEN
        NEW.total_price := NEW.amount_inr;
    ELSIF NEW.amount_inr IS NULL AND NEW.total_price IS NOT NULL THEN
        NEW.amount_inr := NEW.total_price;
    END IF;

    IF NEW.scheduled_date IS NULL AND NEW.booking_date IS NOT NULL THEN
        NEW.scheduled_date := NEW.booking_date::date;
    ELSIF NEW.booking_date IS NULL AND NEW.scheduled_date IS NOT NULL THEN
        NEW.booking_date := NEW.scheduled_date;
    END IF;

    IF NEW.farm_area IS NULL AND NEW.area_worked_acre IS NOT NULL THEN
        NEW.farm_area := NEW.area_worked_acre;
    ELSIF NEW.area_worked_acre IS NULL AND NEW.farm_area IS NOT NULL THEN
        NEW.area_worked_acre := NEW.farm_area;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bookings ON public.bookings;
CREATE TRIGGER trg_sync_bookings
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_bookings();

-- ------------------------------------------------------------------------------
-- 4. CHC OVERVIEW ANALYTICS VIEW (CTE Aggregation, ZERO Double-Counting)
-- ------------------------------------------------------------------------------
-- Drop existing view safely with CASCADE to prevent 42P16 column rename errors
DROP VIEW IF EXISTS public.chc_overview CASCADE;

CREATE OR REPLACE VIEW public.chc_overview AS
WITH machine_agg AS (
    SELECT 
        centre_id,
        COUNT(machine_id) AS total_machines
    FROM public.machinery
    GROUP BY centre_id
),
operator_agg AS (
    SELECT 
        centre_id,
        COUNT(operator_id) AS total_operators
    FROM public.operators
    GROUP BY centre_id
),
booking_agg AS (
    SELECT 
        centre_id,
        COUNT(booking_id) AS total_bookings,
        COALESCE(SUM(amount_inr), 0) AS total_booking_value,
        COALESCE(SUM(area_worked_acre), 0) AS total_area_worked,
        ROUND(AVG(NULLIF(farmer_rating, 0))::numeric, 2) AS avg_farmer_rating
    FROM public.bookings
    GROUP BY centre_id
)
SELECT 
    -- 1 to 12: Preserving the exact original column order, names, and data types
    c.centre_id,
    c.centre_name,
    c.village,
    c.district,
    c.region,
    c.owner_type,
    COALESCE(c.num_operators, o.total_operators, 0)::integer AS num_operators,
    COALESCE(m.total_machines, 0)::bigint AS total_machines,
    COALESCE(b.total_bookings, 0)::bigint AS total_bookings,
    COALESCE(b.total_booking_value, 0)::numeric AS total_booking_value,
    COALESCE(b.total_area_worked, 0)::numeric AS total_area_worked,
    COALESCE(b.avg_farmer_rating, 0)::numeric AS avg_farmer_rating,
    -- 13 to 23: Additional compatibility aliases for frontend application
    c.centre_id AS id,
    c.centre_name AS name,
    'Uttar Pradesh'::varchar(100) AS state,
    'ACTIVE'::varchar(30) AS centre_status,
    'ACTIVE'::varchar(30) AS status,
    COALESCE(m.total_machines, 0)::bigint AS active_machines,
    COALESCE(c.num_operators, o.total_operators, 0)::integer AS total_operators,
    COALESCE(c.num_operators, o.total_operators, 0)::integer AS available_operators,
    0::bigint AS pending_bookings,
    COALESCE(b.total_bookings, 0)::bigint AS completed_bookings,
    COALESCE(b.total_booking_value, 0)::numeric AS total_revenue
FROM public.centres c
LEFT JOIN machine_agg m ON m.centre_id = c.centre_id
LEFT JOIN operator_agg o ON o.centre_id = c.centre_id
LEFT JOIN booking_agg b ON b.centre_id = c.centre_id;

-- Grant permissions on the view
GRANT SELECT ON public.chc_overview TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machinery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Centres: Public read; authenticated centre manager update
DROP POLICY IF EXISTS "Public read centres" ON public.centres;
CREATE POLICY "Public read centres" ON public.centres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Managers update own centre" ON public.centres;
CREATE POLICY "Managers update own centre" ON public.centres FOR UPDATE USING (
    auth.uid() = user_id OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Managers insert own centre" ON public.centres;
CREATE POLICY "Managers insert own centre" ON public.centres FOR INSERT WITH CHECK (
    auth.uid() = user_id OR auth.role() = 'service_role' OR auth.role() = 'authenticated'
);

-- Machinery: Public read; assigned centre manager manage
DROP POLICY IF EXISTS "Public read machinery" ON public.machinery;
CREATE POLICY "Public read machinery" ON public.machinery FOR SELECT USING (true);

DROP POLICY IF EXISTS "CHC Managers manage machinery" ON public.machinery;
CREATE POLICY "CHC Managers manage machinery" ON public.machinery FOR ALL USING (
    centre_id IN (SELECT centre_id FROM public.centres WHERE user_id = auth.uid()) OR 
    auth.role() = 'service_role' OR 
    auth.role() = 'authenticated'
);

-- Operators: Public read; own profile or CHC manager update
DROP POLICY IF EXISTS "Public read operators" ON public.operators;
CREATE POLICY "Public read operators" ON public.operators FOR SELECT USING (true);

DROP POLICY IF EXISTS "Operators and Managers update operator" ON public.operators;
CREATE POLICY "Operators and Managers update operator" ON public.operators FOR UPDATE USING (
    auth.uid() = user_id OR 
    centre_id IN (SELECT centre_id FROM public.centres WHERE user_id = auth.uid()) OR 
    auth.role() = 'service_role'
);

-- Farmers: Own profile read & update; authenticated/anon insert
DROP POLICY IF EXISTS "Farmers read own profile" ON public.farmers;
CREATE POLICY "Farmers read own profile" ON public.farmers FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.role() = 'service_role' OR 
    auth.role() = 'anon' OR
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Farmers update own profile" ON public.farmers;
CREATE POLICY "Farmers update own profile" ON public.farmers FOR UPDATE USING (
    auth.uid() = user_id OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Farmers insert own profile" ON public.farmers;
CREATE POLICY "Farmers insert own profile" ON public.farmers FOR INSERT WITH CHECK (
    auth.uid() = user_id OR auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.role() = 'service_role'
);

-- Bookings: Authorized stakeholders read & manage
DROP POLICY IF EXISTS "Users read relevant bookings" ON public.bookings;
CREATE POLICY "Users read relevant bookings" ON public.bookings FOR SELECT USING (
    farmer_id IN (SELECT farmer_id FROM public.farmers WHERE user_id = auth.uid()) OR
    operator_id IN (SELECT operator_id FROM public.operators WHERE user_id = auth.uid()) OR
    centre_id IN (SELECT centre_id FROM public.centres WHERE user_id = auth.uid()) OR
    auth.role() = 'service_role' OR
    auth.role() = 'anon' OR
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users insert bookings" ON public.bookings;
CREATE POLICY "Users insert bookings" ON public.bookings FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Authorized update bookings" ON public.bookings;
CREATE POLICY "Authorized update bookings" ON public.bookings FOR UPDATE USING (
    farmer_id IN (SELECT farmer_id FROM public.farmers WHERE user_id = auth.uid()) OR
    operator_id IN (SELECT operator_id FROM public.operators WHERE user_id = auth.uid()) OR
    centre_id IN (SELECT centre_id FROM public.centres WHERE user_id = auth.uid()) OR
    auth.role() = 'service_role' OR
    auth.role() = 'anon' OR
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authorized delete bookings" ON public.bookings;
CREATE POLICY "Authorized delete bookings" ON public.bookings FOR DELETE USING (
    farmer_id IN (SELECT farmer_id FROM public.farmers WHERE user_id = auth.uid()) OR
    auth.role() = 'service_role' OR
    auth.role() = 'anon' OR
    auth.role() = 'authenticated'
);

