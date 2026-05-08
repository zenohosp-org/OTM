-- Revert patient_id from UUID back to bigint to match HMS Patient.id (Integer/auto-increment)
-- Run manually on Supabase if Flyway is not active:
--   ALTER TABLE ot_bookings DROP COLUMN patient_id;
--   ALTER TABLE ot_bookings ADD COLUMN patient_id bigint;

ALTER TABLE ot_bookings
    ALTER COLUMN patient_id SET DATA TYPE bigint USING NULL;
