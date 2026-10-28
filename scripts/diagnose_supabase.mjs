import fs from 'fs';
import dns from 'dns/promises';
import { createClient } from '@supabase/supabase-js';

// Load .env and .env.local
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.substring(0, eqIdx).trim();
      let v = trimmed.substring(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
  return env;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('====================================================');
console.log(' SURAKSHAGIS SUPABASE CONNECTION DIAGNOSTIC');
console.log('====================================================');

console.log('\n[1] Environment Variable Inspection:');
console.log('  .env exists:', fs.existsSync('.env'));
console.log('  .env.local exists:', fs.existsSync('.env.local'));
console.log('  VITE_SUPABASE_URL:', url ? url : '(NOT SET)');
if (key) {
  const masked = key.slice(0, 15) + '...' + (key.length > 20 ? ` (length: ${key.length})` : '');
  console.log(
    '  Configured Key Type:',
    key.startsWith('eyJ')
      ? 'Legacy JWT (anon)'
      : key.startsWith('sb_publishable_')
      ? 'New Publishable Key (sb_publishable_...)'
      : 'Other format'
  );
  console.log('  Configured Key Masked:', masked);
} else {
  console.log('  Configured Key: (NOT SET)');
}

if (!url || !key) {
  console.log('\n[!] Missing URL or Key. Cannot proceed with remote tests.');
  process.exit(1);
}

// 2. DNS Resolution Test
let hostname = '';
try {
  const parsed = new URL(url);
  hostname = parsed.hostname;
  console.log('\n[2] DNS & Host Reachability:');
  console.log('  Parsed Hostname:', hostname);
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    console.log('  DNS Lookup Succeeded:');
    addresses.forEach(a => console.log(`    -> IP: ${a.address} (family: IPv${a.family})`));
  } catch (err) {
    console.error('  DNS Lookup Failed:', err.code, err.message);
  }
} catch (err) {
  console.error('  Invalid URL format:', err.message);
  process.exit(1);
}

// 3. Supabase JS Client Tests
console.log('\n[3] Supabase JS Client Live Diagnostic:');
try {
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  // Table checks
  const tablesToCheck = [
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

  console.log('\n  Checking Remote Database Tables:');
  const tableResults = {};
  for (const table of tablesToCheck) {
    try {
      const res = await supabase.from(table).select('id').limit(1);
      if (res.error) {
        tableResults[table] = {
          status: 'MISSING',
          code: res.error.code,
          message: res.error.message,
        };
      } else {
        tableResults[table] = {
          status: 'EXISTS',
          code: '200',
          rowsReturned: res.data?.length ?? 0,
        };
      }
    } catch (err) {
      tableResults[table] = { status: 'EXCEPTION', message: err.message };
    }
  }
  console.table(tableResults);

  // RPC checks with explicit parameter signatures
  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  const rpcsToCheck = [
    { name: 'fn_compute_red_zones', params: {} },
    { name: 'fn_assess_carrying_capacity', params: { p_site_id: dummyUuid } },
    { name: 'fn_rank_relocation_priority', params: {} },
    { name: 'fn_get_habitations_within_hazard_buffer', params: { p_hazard_id: dummyUuid } },
    { name: 'fn_get_spatial_metrics', params: {} },
  ];

  console.log('\n  Checking PostGIS RPC Functions:');
  for (const rpc of rpcsToCheck) {
    try {
      const { data, error } = await supabase.rpc(rpc.name, rpc.params);
      if (error) {
        // If error is 42P01, the RPC function exists and was executed, but references a table that hasn't been created yet!
        if (error.code === '42P01') {
          console.log(`    ✔ RPC '${rpc.name}': INSTALLED on database (Runtime dependency: ${error.message})`);
        } else if (error.code === 'PGRST202') {
          console.log(`    ✖ RPC '${rpc.name}': NOT FOUND in schema cache`);
        } else {
          console.log(`    ? RPC '${rpc.name}': [${error.code}] ${error.message}`);
        }
      } else {
        console.log(`    ✔ RPC '${rpc.name}': INSTALLED & EXECUTED successfully`);
      }
    } catch (err) {
      console.log(`    ! RPC '${rpc.name}': Exception - ${err.message}`);
    }
  }

  // Safe read test
  console.log('\n[4] Safe Remote Read Verification:');
  const readRes = await supabase.from('candidate_relocation_sites').select('id, site_code').limit(1);
  if (readRes.error) {
    console.log(`  Read blocked: [${readRes.error.code}] ${readRes.error.message}`);
    console.log('  -> Active Persistence Mode: local_fallback (Browser LocalStorage)');
  } else {
    console.log('  Read successful! Remote Supabase persistence active.');
  }

} catch (err) {
  console.error('\n[!] Supabase client initialization error:', err.message);
}

console.log('\n====================================================');
