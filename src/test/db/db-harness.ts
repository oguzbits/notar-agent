import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';

interface LocalSupabaseEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

/** Liest URL und Schlüssel der lokal laufenden Supabase (`supabase start`), nie aus produktiven Variablen. */
function readLocalEnv(): LocalSupabaseEnv {
  const raw = execFileSync('npx', ['--yes', 'supabase@2.120.0', 'status', '-o', 'env'], {
    encoding: 'utf8',
  });
  const values = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) values.set(match[1], match[2]);
  }
  const apiUrl = values.get('API_URL');
  const anonKey = values.get('ANON_KEY');
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY');
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Lokale Supabase nicht erreichbar. Bitte `npx supabase start` ausführen.');
  }
  return { apiUrl, anonKey, serviceRoleKey };
}

export interface TestUser {
  id: string;
  client: SupabaseClient;
}

export interface DbHarness {
  admin: SupabaseClient;
  anon: SupabaseClient;
  createUser: () => Promise<TestUser>;
  createAnonymousClient: () => SupabaseClient;
  createOrganizationWithMember: (userId: string, role?: string) => Promise<string>;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

export function createDbHarness(): DbHarness {
  const env = readLocalEnv();
  const admin = createClient(env.apiUrl, env.serviceRoleKey, clientOptions);
  const anon = createClient(env.apiUrl, env.anonKey, clientOptions);

  return {
    admin,
    anon,
    createAnonymousClient() {
      return createClient(env.apiUrl, env.anonKey, clientOptions);
    },
    async createUser() {
      const email = `${randomUUID()}@db-test.invalid`;
      const password = randomUUID();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw created.error ?? new Error('createUser');
      const client = createClient(env.apiUrl, env.anonKey, clientOptions);
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      return { id: created.data.user.id, client };
    },
    async createOrganizationWithMember(userId, role: string = NOTARY_ROLES.NOTAR) {
      const org = await admin
        .from(DB_TABLES.ORGANIZATIONS)
        .insert({ name: `Test ${randomUUID()}`, official_seat: 'Test', chamber_district: 'Test' })
        .select('id')
        .single();
      if (org.error) throw org.error;
      const member = await admin
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .insert({ organization_id: org.data.id, user_id: userId, role });
      if (member.error) throw member.error;
      return org.data.id as string;
    },
  };
}
