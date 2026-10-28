import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

/**
 * SURAKSHAGIS SUPABASE CLIENT
 *
 * Strongly-typed PostGIS / PostgreSQL client configured strictly with
 * client-safe public keys:
 * - Legacy anonymous JWT key (VITE_SUPABASE_ANON_KEY: eyJ...)
 * - Modern publishable key (VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY: sb_publishable_...)
 *
 * SECURITY REQUIREMENT:
 * Under no circumstances should service-role keys (sb_secret_..., service_role) or database master
 * passwords ever be imported, referenced, or exposed in client-facing browser bundles.
 */

const rawUrl = (
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ||
  ''
).trim();

const rawKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  ''
).trim();

export type SupabaseKeyType = 'publishable' | 'legacy_jwt' | 'custom' | 'none';

/**
 * Identifies the configured public key type without exposing key content
 */
export function getSupabaseKeyType(): SupabaseKeyType {
  if (!rawKey) return 'none';
  if (rawKey.startsWith('sb_publishable_')) return 'publishable';
  if (rawKey.startsWith('eyJ')) return 'legacy_jwt';
  return 'custom';
}

/**
 * Determines whether valid Supabase credentials have been configured in .env or .env.local
 */
export function isSupabaseConfigured(): boolean {
  if (!rawUrl || !rawKey) return false;

  if (rawUrl === '' || rawKey === '') return false;
  if (rawUrl.includes('your-project-id') || rawKey.includes('your-public-anon-key')) return false;
  if (!rawUrl.startsWith('https://') && !rawUrl.startsWith('http://localhost')) return false;

  // Accept valid Supabase key types (modern publishable key or legacy anon JWT)
  return rawKey.length >= 20;
}

/**
 * Safeguard against accidental service-role / secret key leakage in browser environment
 */
function validateSecurityGuardrails(key: string): void {
  // Flag potential secret keys (service_role, sb_secret_, or high-privilege master tokens)
  if (
    key.includes('service_role') ||
    key.startsWith('sb_secret_') ||
    (key.length > 50 && key.startsWith('sbp_'))
  ) {
    console.warn(
      '⚠️ [SurakshaGIS Security Alert]: Detected potential privileged service/secret key in frontend environment. Only use the public anon/publishable key.'
    );
  }
}

let supabaseInstance: SupabaseClient<Database> | null = null;

if (isSupabaseConfigured()) {
  validateSecurityGuardrails(rawKey);

  try {
    supabaseInstance = createClient<Database>(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    supabaseInstance = null;
  }
}

/**
 * Access the typed Supabase client (or null if unconfigured)
 */
export const supabase: SupabaseClient<Database> | null = supabaseInstance;

/**
 * Helper to obtain the active client or throw a structured error
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase client is not initialized. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY are set in .env or .env.local'
    );
  }
  return supabaseInstance;
}

export type ConnectionCategory =
  | 'CONNECTED'
  | 'SCHEMA_MISSING_TABLES'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'UNCONFIGURED'
  | 'DATABASE_ERROR';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  category?: ConnectionCategory;
  details?: Record<string, unknown>;
}

/**
 * Tests the live reachability of the Supabase backend and PostGIS extension.
 * Distinguishes invalid credentials, network/DNS failures, and missing schema tables.
 */
export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  if (!isSupabaseConfigured() || !supabaseInstance) {
    return {
      success: false,
      message: 'Supabase credentials are not configured in .env or .env.local. Running in local CSV/benchmark fallback mode.',
      category: 'UNCONFIGURED',
    };
  }

  const startTime = performance.now();
  try {
    // Perform a real read on vulnerable_settlements to verify both connectivity and schema presence
    // NOTE: Avoid head: true because HTTP HEAD can return 204 No Content even when the table is missing from schema cache!
    const { data, error, status } = await supabaseInstance
      .from('vulnerable_settlements')
      .select('id')
      .limit(1);

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      // 1. Schema cache error: Table missing (Migrations not yet applied)
      if (
        error.code === 'PGRST205' ||
        error.message?.includes('schema cache') ||
        error.code === '42P01'
      ) {
        return {
          success: false,
          message: `Connected to Supabase endpoint (${latencyMs}ms), but core tables are missing (PGRST205). Migration 02 (create_core_tables.sql) must be run in Supabase SQL editor.`,
          latencyMs,
          category: 'SCHEMA_MISSING_TABLES',
          details: { code: error.code, status, hint: error.hint },
        };
      }

      // 2. Authentication error: Invalid or expired key
      if (
        status === 401 ||
        error.code === 'PGRST301' ||
        error.message?.toLowerCase().includes('jwt') ||
        error.message?.toLowerCase().includes('unauthorized') ||
        error.message?.toLowerCase().includes('api key')
      ) {
        return {
          success: false,
          message: `Supabase authentication failed (${status}): Invalid API key or expired credentials. Check VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY.`,
          latencyMs,
          category: 'AUTH_FAILED',
          details: { code: error.code, status },
        };
      }

      // 3. Other database / PostgREST error
      return {
        success: false,
        message: `Supabase returned an error: ${error.message} (${error.code || status || 'UNKNOWN'})`,
        latencyMs,
        category: 'DATABASE_ERROR',
        details: { code: error.code, status, hint: error.hint, details: error.details },
      };
    }

    // Real remote query succeeded!
    return {
      success: true,
      message: `Successfully connected to live Supabase PostGIS backend (${latencyMs}ms). Verified remote tables and access.`,
      latencyMs,
      category: 'CONNECTED',
      details: { rowCount: data?.length ?? 0, status },
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : 'Unknown network failure connecting to Supabase';

    // Distinguish network/DNS error
    const isNetworkError =
      msg.includes('Failed to fetch') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('NetworkError') ||
      msg.includes('getaddrinfo');

    return {
      success: false,
      message: isNetworkError
        ? `Network connectivity issue reaching Supabase (${latencyMs}ms): host unreachable or offline. Falling back to local mode.`
        : `Supabase client error: ${msg}`,
      latencyMs,
      category: isNetworkError ? 'NETWORK_ERROR' : 'DATABASE_ERROR',
    };
  }
}
