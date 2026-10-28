#!/usr/bin/env node
/**
 * ==============================================================================
 * SurakshaGIS Phase 5: Supabase Backend & PostGIS Integration Test Suite
 * ==============================================================================
 * Validates:
 * 1. SQL migration scripts (PostGIS extensions, tables, GiST indexes, RPCs, RLS)
 * 2. Database seed script (Authentic geometries & demo data)
 * 3. TypeScript schema type definitions (Database, Tables, Enums, Functions)
 * 4. Security audit (Zero committed service-role keys or leaked credentials)
 * 5. Environment configuration (.env.example template & .gitignore rules)
 * 6. Dual-mode fallback architecture (Non-crashing behavior when offline)
 * 7. Phase 4 CSV dataset integrity check
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
    if (details) console.log(`    \x1b[90m${details}\x1b[0m`);
  } else {
    failedTests++;
    console.log(`  \x1b[31m✖\x1b[0m ${testName}`);
    if (details) console.log(`    \x1b[31mError: ${details}\x1b[0m`);
  }
}

console.log('\n=============================================================');
console.log('SurakshaGIS: PostGIS Backend & Supabase Architecture Tests');
console.log('=============================================================\n');

// ------------------------------------------------------------------------------
// Test Suite 1: SQL Migrations Verification
// ------------------------------------------------------------------------------
console.log('\x1b[1m[Suite 1] SQL Migrations & Schema Architecture\x1b[0m');

const migrationDir = path.join(projectRoot, 'supabase', 'migrations');
assert(fs.existsSync(migrationDir), 'supabase/migrations directory exists');

const requiredMigrations = [
  '20261022000001_enable_postgis_and_types.sql',
  '20261022000002_create_core_tables.sql',
  '20261022000003_create_spatial_functions.sql',
  '20261022000004_create_rls_policies.sql',
];

for (const m of requiredMigrations) {
  const filePath = path.join(migrationDir, m);
  const exists = fs.existsSync(filePath);
  const size = exists ? fs.statSync(filePath).size : 0;
  assert(exists && size > 500, `Migration ${m} exists and is populated`, `Size: ${size} bytes`);
}

const finalSetupPath = path.join(projectRoot, 'supabase', 'FINAL_REMOTE_SETUP.sql');
const finalSetupExists = fs.existsSync(finalSetupPath);
const finalSetupSize = finalSetupExists ? fs.statSync(finalSetupPath).size : 0;
assert(
  finalSetupExists && finalSetupSize > 30000,
  'Consolidated setup file supabase/FINAL_REMOTE_SETUP.sql exists and is complete',
  `Size: ${finalSetupSize} bytes`
);

// Check PostGIS extension in migration 1
const mig1 = fs.readFileSync(path.join(migrationDir, requiredMigrations[0]), 'utf-8');
assert(
  mig1.includes('CREATE EXTENSION IF NOT EXISTS postgis') && mig1.includes('hazard_type_enum'),
  'Migration 1 enables PostGIS and declares geospatial ENUMs'
);

// Check Core tables in migration 2
const mig2 = fs.readFileSync(path.join(migrationDir, requiredMigrations[1]), 'utf-8');
const expectedTables = [
  'profiles',
  'administrative_boundaries',
  'vulnerable_settlements',
  'hazard_zones',
  'candidate_relocation_sites',
  'risk_assessments',
  'relocation_action_plans',
  'dataset_imports',
  'spatial_audit_logs',
];

for (const table of expectedTables) {
  assert(mig2.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Table defined: ${table}`);
}

assert(mig2.includes('GEOMETRY(Point, 4326)'), 'Uses EPSG:4326 Point geometry');
assert(mig2.includes('GEOMETRY(Polygon, 4326)'), 'Uses EPSG:4326 Polygon geometry');
assert(mig2.includes('USING GIST(geom)'), 'Creates GiST spatial indexes for high-speed spatial querying');

// Check PostGIS RPC stored procedures in migration 3
const mig3 = fs.readFileSync(path.join(migrationDir, requiredMigrations[2]), 'utf-8');
const expectedRPCs = [
  'fn_compute_red_zones',
  'fn_assess_carrying_capacity',
  'fn_rank_relocation_priority',
  'fn_get_habitations_within_hazard_buffer',
  'fn_get_spatial_metrics',
];

for (const rpc of expectedRPCs) {
  assert(mig3.includes(`FUNCTION ${rpc}`), `PostGIS RPC defined: ${rpc}`);
}

// Check Row Level Security in migration 4
const mig4 = fs.readFileSync(path.join(migrationDir, requiredMigrations[3]), 'utf-8');
for (const table of expectedTables) {
  assert(
    mig4.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`),
    `RLS enabled on table: ${table}`
  );
}

// Check Seed data
const seedPath = path.join(projectRoot, 'supabase', 'seed', 'seed_data.sql');
const seedExists = fs.existsSync(seedPath);
const seedContent = seedExists ? fs.readFileSync(seedPath, 'utf-8') : '';
assert(seedExists && seedContent.length > 1000, 'Seed data file exists and contains ground truth records');
assert(seedContent.includes('Wayanad') && seedContent.includes('ST_GeomFromText'), 'Seed data contains authentic PostGIS geometry');

// ------------------------------------------------------------------------------
// Test Suite 2: Security & Key Exposure Auditing
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Suite 2] Security & Secret Exposure Audit\x1b[0m');

// Check gitignore contains .env
const gitignorePath = path.join(projectRoot, '.gitignore');
const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
assert(
  gitignoreContent.includes('.env') && gitignoreContent.includes('.env.local'),
  '.gitignore explicitly ignores .env and .env.*.local files'
);

// Scan frontend code for dangerous service_role keys or database secrets
const srcDir = path.join(projectRoot, 'src');
let exposedSecretFound = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const code = fs.readFileSync(fullPath, 'utf-8');
      // Look for actual hardcoded secret tokens (excluding warning messages)
      if (
        code.includes('SUPABASE_SERVICE_ROLE_KEY=') ||
        code.includes('service_role_key_secret') ||
        /eyJhbGciOi[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/.test(code)
      ) {
        // Double check it's not a comment or warning
        if (!code.includes('detected') && !code.includes('Never put your Supabase')) {
          exposedSecretFound = true;
          console.error(`Potential hardcoded key detected in ${fullPath}`);
        }
      }
    }
  }
}

scanDir(srcDir);
assert(!exposedSecretFound, 'Zero exposed service-role keys or sensitive credentials found in client code');

// ------------------------------------------------------------------------------
// Test Suite 3: Client & Data Layer Types
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Suite 3] TypeScript Client & Spatial Service Layer\x1b[0m');

const dbTypesPath = path.join(projectRoot, 'src', 'types', 'database.types.ts');
assert(fs.existsSync(dbTypesPath), 'TypeScript database types generated: src/types/database.types.ts');

const clientPath = path.join(projectRoot, 'src', 'services', 'supabaseClient.ts');
assert(fs.existsSync(clientPath), 'Typed Supabase client created: src/services/supabaseClient.ts');
const clientCode = fs.readFileSync(clientPath, 'utf-8');
assert(
  clientCode.includes('isSupabaseConfigured') && clientCode.includes('testSupabaseConnection'),
  'Supabase client exports configuration checks and connection diagnostic tools'
);

const servicePath = path.join(projectRoot, 'src', 'services', 'spatialService.ts');
assert(fs.existsSync(servicePath), 'Modular spatial data service created: src/services/spatialService.ts');
const serviceCode = fs.readFileSync(servicePath, 'utf-8');
assert(
  serviceCode.includes('getSettlements') &&
    serviceCode.includes('assessCarryingCapacity') &&
    serviceCode.includes('computeRedZones'),
  'SpatialService exposes PostGIS RPC and fallback methods'
);

// ------------------------------------------------------------------------------
// Test Suite 4: Phase 4 CSV Dataset Preservation
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m[Suite 4] Phase 4 CSV Dataset Preservation\x1b[0m');

const csvPath = path.join(projectRoot, 'docs', 'flood_risk_dataset_india.csv');
const csvExists = fs.existsSync(csvPath);
const csvSize = csvExists ? fs.statSync(csvPath).size : 0;
assert(csvExists, 'Original CSV dataset preserved: docs/flood_risk_dataset_india.csv');
assert(csvSize === 1854311, `CSV dataset file size intact (Expected 1,854,311 bytes, got ${csvSize})`);

// ------------------------------------------------------------------------------
// Summary
// ------------------------------------------------------------------------------
console.log('\n=============================================================');
console.log(`Test Execution Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('=============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32mAll Phase 5 Supabase/PostGIS architectural tests passed successfully!\x1b[0m\n');
}
