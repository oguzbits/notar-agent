import { SupabaseClient } from '@supabase/supabase-js';
import {
  AuditAction,
  AuditIntegrityResult,
  AuditIntegrityResultSchema,
  AuditLogDetails,
  AuditLogEntry,
} from '@/types/audit';
import { DB_TABLES, Database, TableRow } from '@/types/database';

type Row = TableRow<typeof DB_TABLES.AUDIT_LOGS>;

export interface AppendAuditParams {
  documentId: string;
  organizationId?: string;
  action: AuditAction;
  actor: string;
  details?: AuditLogDetails;
}

export interface IAuditRepository {
  appendEvent(params: AppendAuditParams): Promise<AuditLogEntry>;
  getHistory(documentId: string, organizationId?: string): Promise<AuditLogEntry[]>;
  verifyIntegrity(documentId: string): Promise<AuditIntegrityResult>;
}

/**
 * Supabase Audit Repository als Single Source of Truth (SSOT).
 * Schreibt revisionssicher in die audit_logs-Tabelle mit striktem Fail-Fast bei Datenbankfehlern.
 */
export class SupabaseAuditRepository implements IAuditRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async appendEvent(params: AppendAuditParams): Promise<AuditLogEntry> {
    // Sequenz, Hash, Zeitstempel und Akteur-ID setzt die Datenbank (Trigger trg_audit_logs_chain).
    const { data, error } = await this.supabase
      .from(DB_TABLES.AUDIT_LOGS)
      .insert({
        document_id: params.documentId,
        organization_id: params.organizationId ?? null,
        action: params.action,
        actor: params.actor,
        details: params.details ?? {},
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(
        `Supabase audit insert error: ${error?.message || 'Kein Datensatz zurückgegeben'}`
      );
    }
    return toEntry(data);
  }

  async getHistory(documentId: string, organizationId?: string): Promise<AuditLogEntry[]> {
    let query = this.supabase.from(DB_TABLES.AUDIT_LOGS).select('*').eq('document_id', documentId);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.order('sequence_number', { ascending: true });

    if (error) {
      throw new Error(`Supabase getHistory error: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map(toEntry);
  }

  async verifyIntegrity(documentId: string): Promise<AuditIntegrityResult> {
    const { data, error } = await this.supabase.rpc('verify_audit_chain', {
      p_document_id: documentId,
    });
    if (error) {
      throw new Error(`Supabase verifyIntegrity error: ${error.message}`);
    }
    return AuditIntegrityResultSchema.parse(data);
  }
}

function toEntry(row: Row): AuditLogEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    documentId: row.document_id,
    sequenceNumber: row.sequence_number,
    action: row.action,
    timestamp: row.timestamp,
    actor: row.actor,
    previousHash: row.previous_hash,
    currentHash: row.current_hash,
    details: row.details || {},
  };
}
