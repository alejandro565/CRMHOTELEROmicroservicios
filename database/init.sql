-- Crear bases de datos si no existen
SELECT 'CREATE DATABASE saas_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'saas_db')\gexec
SELECT 'CREATE DATABASE auth_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db')\gexec
SELECT 'CREATE DATABASE hotels_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hotels_db')\gexec
SELECT 'CREATE DATABASE guest_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'guest_db')\gexec
SELECT 'CREATE DATABASE reservation_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reservation_db')\gexec
SELECT 'CREATE DATABASE billing_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'billing_db')\gexec
SELECT 'CREATE DATABASE audit_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'audit_db')\gexec
SELECT 'CREATE DATABASE reporting_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reporting_db')\gexec

-- Otorgar privilegios
GRANT ALL PRIVILEGES ON DATABASE saas_db TO saas_user;
GRANT ALL PRIVILEGES ON DATABASE auth_db TO saas_user;
GRANT ALL PRIVILEGES ON DATABASE hotels_db TO saas_user;
GRANT ALL PRIVILEGES ON DATABASE guest_db TO saas_user;
GRANT ALL PRIVILEGES ON DATABASE reservation_db TO saas_user;
GRANT ALL PRIVILEGES ON DATABASE billing_db TO saas_user;
GRANT ALL PRIVILEGES ON DATABASE audit_db TO saas_user;
GRANT ALL PRIVILEGES ON DATABASE reporting_db TO saas_user;