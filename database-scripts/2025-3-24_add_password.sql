
ALTER TABLE system_user
ADD COLUMN password VARCHAR(255) NULL;


UPDATE system_user
SET password = '$2b$10$YFgdsCJC0d8y1kPIX.bOEOBicbxO/GTJx.P3hlAeq6m.0nyeQREtu'
WHERE id = 14;

UPDATE system_user
SET password = '$2b$10$anotherhashedpasswordexample'
WHERE id = 15;


