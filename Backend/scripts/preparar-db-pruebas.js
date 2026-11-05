// Siempre fija la base de pruebas; no permite ejecutar migraciones sobre la base habitual.
require('dotenv').config();
process.env.DB_NAME = 'codexia_test';

require('./migrate');
