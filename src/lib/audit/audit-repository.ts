import { SupabaseClient } from '@supabase/supabase-js';
import { AuditAction, AuditIntegrityResult, AuditLogEntry } from '@/types/audit';
import { calculateAuditRecordHash, GENESIS_HASH, verifyAuditChain } from './audit-crypto';

export interface AppendAuditParams {
  documentId: string;
  action: AuditAction;
  actor: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface IAuditRepository {
  appendEvent(params: AppendAuditParams): Promise<AuditLogEntry>;
  getHistory(documentId: string): Promise<AuditLogEntry[]>;
  verifyIntegrity(documentId: string): Promise<AuditIntegrityResult>;
}

/**
 * Bounded In-Memory Audit Repository mit mathematischer Hash-Kette.
 */
export class InMemoryAuditRepository implements IAuditRepository {
  private eventsByDocId = new Map<string, AuditLogEntry[]>();
  private readonly maxEntriesPerDoc: number;

  constructor(maxEntriesPerDoc = 100) {
    this.maxEntriesPerDoc = maxEntriesPerDoc;
  }

  async appendEvent(params: AppendAuditParams): Promise<AuditLogEntry> {
    const list = this.eventsByDocId.get(params.documentId) || [];
    const sequenceNumber = list.length;
    const lastEntry = list[list.length - 1];
    const previousHash = lastEntry ? lastEntry.currentHash : GENESIS_HASH;
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

    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      documentId: params.documentId,
      sequenceNumber,
      action: params.action,
      timestamp,
      actor: params.actor,
      previousHash,
      currentHash,
      details,
    };

    list.push(entry);
    if (list.length > this.maxEntriesPerDoc) {
      list.shift(); // FIFO: Älteste Einträge verdrängen, falls Memory-Grenze erreicht
    }

    this.eventsByDocId.set(params.documentId, list);
    return entry;
  }

  async getHistory(documentId: string): Promise<AuditLogEntry[]> {
    const list = this.eventsByDocId.get(documentId) || [];
    return [...list];
  }

  async verifyIntegrity(documentId: string): Promise<AuditIntegrityResult> {
    const list = await this.getHistory(documentId);
    return verifyAuditChain(list);
  }
}

/**
 * Supabase Audit Repository mit Fallback auf InMemory bei Datenbankausfällen.
 */
export class SupabaseAuditRepository implements IAuditRepository {
  constructor(
    private supabase: SupabaseClient,
    private fallbackRepo: InMemoryAuditRepository
  ) {}

  async appendEvent(params: AppendAuditParams): Promise<AuditLogEntry> {
    try {
      // 1. Letzten Eintrag abfragen zur Ermittlung von previousHash & sequenceNumber
      const { data: latestRecords, error: fetchErr } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('document_id', params.documentId)
        .order('sequence_number', { ascending: false })
        .limit(1);

      if (fetchErr) {
        console.warn('Supabase audit fetch error, using fallback:', fetchErr.message);
        return this.fallbackRepo.appendEvent(params);
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

      const { data: inserted, error: insertErr } = await this.supabase
        .from('audit_logs')
        .insert({
          id: newId,
          document_id: params.documentId,
          sequence_number: sequenceNumber,
          action: params.action,
          timestamp,
          actor: params.actor,
          previous_hash: previousHash,
          current_hash: currentHash,
          details,
        })
        .select('*')
        .single();

      if (insertErr || !inserted) {
        console.warn('Supabase audit insert error, using fallback:', insertErr?.message);
        return this.fallbackRepo.appendEvent(params);
      }

      return {
        id: inserted.id,
        documentId: inserted.document_id,
        sequenceNumber: inserted.sequence_number,
        action: inserted.action,
        timestamp: inserted.timestamp,
        actor: inserted.actor,
        previousHash: inserted.previous_hash,
        currentHash: inserted.current_hash,
        details: inserted.details || {},
      };
    } catch (err) {
      console.warn('Supabase audit exception, using fallback:', err);
      return this.fallbackRepo.appendEvent(params);
    }
  }

  async getHistory(documentId: string): Promise<AuditLogEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('document_id', documentId)
        .order('sequence_number', { ascending: true });

      if (error || !data) {
        return this.fallbackRepo.getHistory(documentId);
      }

      return data.map((row) => ({
        id: row.id,
        documentId: row.document_id,
        sequenceNumber: row.sequence_number,
        action: row.action,
        timestamp: row.timestamp,
        actor: row.actor,
        previousHash: row.previous_hash,
        currentHash: row.current_hash,
        details: row.details || {},
      }));
    } catch (err) {
      console.warn('Supabase getHistory exception, using fallback:', err);
      return this.fallbackRepo.getHistory(documentId);
    }
  }

  async verifyIntegrity(documentId: string): Promise<AuditIntegrityResult> {
    const list = await this.getHistory(documentId);
    return verifyAuditChain(list);
  }
}
