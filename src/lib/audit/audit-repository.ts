import { SupabaseClient } from '@supabase/supabase-js';
import { AuditAction, AuditIntegrityResult, AuditLogEntry } from '@/types/audit';
import { calculateAuditRecordHash, GENESIS_HASH, verifyAuditChain } from './audit-crypto';

export interface AppendAuditParams {
  documentId: string;
  organizationId?: string;
  action: AuditAction;
  actor: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface IAuditRepository {
  appendEvent(params: AppendAuditParams): Promise<AuditLogEntry>;
  getHistory(documentId: string, organizationId?: string): Promise<AuditLogEntry[]>;
  verifyIntegrity(documentId: string, organizationId?: string): Promise<AuditIntegrityResult>;
}

/**
 * Supabase Audit Repository als Single Source of Truth (SSOT).
 * Schreibt revisionssicher in die audit_logs-Tabelle mit striktem Fail-Fast bei Datenbankfehlern.
 */
export class SupabaseAuditRepository implements IAuditRepository {
  constructor(private supabase: SupabaseClient) {}

  async appendEvent(params: AppendAuditParams): Promise<AuditLogEntry> {
    // 1. Letzten Eintrag abfragen zur Ermittlung von previousHash & sequenceNumber
    const { data: latestRecords, error: fetchErr } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('document_id', params.documentId)
      .order('sequence_number', { ascending: false })
      .limit(1);

    if (fetchErr) {
      throw new Error(`Supabase audit fetch error: ${fetchErr.message}`);
    }

    const lastRow = Array.isArray(latestRecords) && latestRecords[0] ? latestRecords[0] : null;
    const sequenceNumber = lastRow ? Number(lastRow.sequence_number) + 1 : 0;
    const previousHash = lastRow ? String(lastRow.current_hash) : GENESIS_HASH;
    const timestamp = params.timestamp || new Date().toISOString();
    const details = params.details || {};

    const currentHash = calculateAuditRecordHash({
      documentId: params.documentId,
      sequenceNumber,
      action: params.action,
      timestamp,
      actor: params.actor,
      previousHash,
      details,
    });

    const newId = crypto.randomUUID();

    const insertPayload: Record<string, unknown> = {
      id: newId,
      document_id: params.documentId,
      sequence_number: sequenceNumber,
      action: params.action,
      timestamp,
      actor: params.actor,
      previous_hash: previousHash,
      current_hash: currentHash,
      details,
    };
    if (params.organizationId) {
      insertPayload.organization_id = params.organizationId;
    }

    const { data: inserted, error: insertErr } = await this.supabase
      .from('audit_logs')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertErr || !inserted) {
      throw new Error(
        `Supabase audit insert error: ${insertErr?.message || 'Kein Datensatz zurückgegeben'}`
      );
    }

    return {
      id: inserted.id,
      organizationId: inserted.organization_id,
      documentId: inserted.document_id,
      sequenceNumber: inserted.sequence_number,
      action: inserted.action,
      timestamp: inserted.timestamp,
      actor: inserted.actor,
      previousHash: inserted.previous_hash,
      currentHash: inserted.current_hash,
      details: inserted.details || {},
    };
  }

  async getHistory(documentId: string, organizationId?: string): Promise<AuditLogEntry[]> {
    let query = this.supabase.from('audit_logs').select('*').eq('document_id', documentId);

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

    return data.map((row) => ({
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
    }));
  }

  async verifyIntegrity(
    documentId: string,
    organizationId?: string
  ): Promise<AuditIntegrityResult> {
    const list = await this.getHistory(documentId, organizationId);
    return verifyAuditChain(list);
  }
}
