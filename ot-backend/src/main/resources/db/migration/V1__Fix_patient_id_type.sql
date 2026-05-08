-- Fix patient_id column type to UUID (from Integer)
-- This migration ensures patient_id is the correct type to match the entity definition

ALTER TABLE ot_bookings
ALTER COLUMN patient_id SET DATA TYPE uuid USING patient_id::uuid;
