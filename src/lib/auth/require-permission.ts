import { SupabaseAuditRepository } from '@/lib/audit/audit-repository';
import { hasPermission } from '@/lib/auth/rbac';
import {
  createServerAuthClient,
  resolveSessionActor,
  resolveSessionOrganizationId,
} from '@/lib/supabase/server-auth';
import { AUDIT_ACTIONS } from '@/types/audit';
import { PermissionAction, SessionContext, SessionContextSchema } from '@/types/auth';

export class AuthzError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string
  ) {
    super(message);
  }
}

type AuthClient = Awaited<ReturnType<typeof createServerAuthClient>>;

interface RequirePermissionOptions {
  requestedOrgId?: string;
  route?: string;
}

/**
 * Prüft serverseitig, ob die Rolle des Nutzers in der aktiven Kanzlei die Aktion erlaubt.
 * Verweigerungen werden append-only im Audit-Trail festgehalten; Datenbankfehler werden nie zu 401/403.
 */
export async function requirePermission(
  supabase: AuthClient,
  action: PermissionAction,
  options: RequirePermissionOptions = {}
): Promise<SessionContext> {
  const organizationId = await resolveSessionOrganizationId(supabase, options.requestedOrgId, {
    requireExplicit: true,
  });
  const actor =
    supabase && organizationId ? await resolveSessionActor(supabase, organizationId) : undefined;
  if (!supabase || !organizationId || !actor) {
    throw new AuthzError(401, 'Nicht authentifiziert oder keine Kanzlei zugeordnet.');
  }

  const ctx = SessionContextSchema.parse({
    userId: actor.userId,
    organizationId,
    role: actor.role,
    actorLabel: actor.label,
  });

  if (!hasPermission(ctx.role, action)) {
    await new SupabaseAuditRepository(supabase).appendEvent({
      documentId: `access-denied:${organizationId}`,
      organizationId,
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      actor: ctx.actorLabel,
      details: { deniedAction: action, route: options.route, actorRole: ctx.role },
    });
    throw new AuthzError(403, 'Keine Berechtigung für diese Aktion.');
  }
  return ctx;
}
