import { hasPermission } from '@/lib/auth/rbac';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { SessionContext } from '@/types/auth';
import { NOTARY_ROLES, NotaryRole } from '@/types/organization';

export const TEST_ORG_ID = 'a0000000-0000-4000-8000-000000000001';

/** Ersatz für `requirePermission` in Route-Tests: echte Matrix, echter AuthzError, kein Datenbankzugriff. */
export function fakeRequirePermission(
  role: NotaryRole = NOTARY_ROLES.NOTAR
): typeof requirePermission {
  return async (_client, action, options): Promise<SessionContext> => {
    if (!hasPermission(role, action)) {
      throw new AuthzError(403, 'Keine Berechtigung für diese Aktion.');
    }
    return {
      userId: 'c0000000-0000-4000-8000-0000000000c1',
      organizationId: options?.requestedOrgId ?? TEST_ORG_ID,
      role,
      actorLabel: 'Test Notar',
    };
  };
}
