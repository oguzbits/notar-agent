import { z } from 'zod';
import { AuditAction, AuditLogDetails } from './audit';
import { Dossier } from './dossier';
import { CreateJobPayload, JobProgressDetails } from './jobs';
import { NotaryRole } from './organization';

export const DB_TABLES = {
  ORGANIZATIONS: 'organizations',
  ORGANIZATION_MEMBERS: 'organization_members',
  PROFILES: 'profiles',
  DOCUMENTS: 'documents',
  DOSSIER_JOBS: 'dossier_jobs',
  AUDIT_LOGS: 'audit_logs',
  KNOWLEDGE_DOCUMENTS: 'knowledge_documents',
} as const;

export const DbTableSchema = z.enum([
  DB_TABLES.ORGANIZATIONS,
  DB_TABLES.ORGANIZATION_MEMBERS,
  DB_TABLES.PROFILES,
  DB_TABLES.DOCUMENTS,
  DB_TABLES.DOSSIER_JOBS,
  DB_TABLES.AUDIT_LOGS,
  DB_TABLES.KNOWLEDGE_DOCUMENTS,
]);
export type DbTable = (typeof DB_TABLES)[keyof typeof DB_TABLES];

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          official_seat: string;
          chamber_district: string;
          tax_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          official_seat: string;
          chamber_district: string;
          tax_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          official_seat?: string;
          chamber_district?: string;
          tax_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          role: NotaryRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          role?: NotaryRole;
          joined_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          role?: NotaryRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          status: string;
          content: Dossier;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          title: string;
          status: string;
          content: Dossier;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          status?: string;
          content?: Dossier;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dossier_jobs: {
        Row: {
          id: string;
          organization_id: string | null;
          status: string;
          stage: string | null;
          progress_details: JobProgressDetails | null;
          payload: CreateJobPayload;
          result_dossier_id: string | null;
          error_message: string | null;
          retry_count: number;
          max_retries: number;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          status: string;
          stage?: string | null;
          progress_details?: JobProgressDetails | null;
          payload: CreateJobPayload;
          result_dossier_id?: string | null;
          error_message?: string | null;
          retry_count?: number;
          max_retries?: number;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          status?: string;
          stage?: string | null;
          progress_details?: JobProgressDetails | null;
          payload?: CreateJobPayload;
          result_dossier_id?: string | null;
          error_message?: string | null;
          retry_count?: number;
          max_retries?: number;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          document_id: string;
          sequence_number: number;
          action: AuditAction;
          timestamp: string;
          actor: string;
          previous_hash: string;
          current_hash: string;
          details: AuditLogDetails;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          document_id: string;
          sequence_number: number;
          action: AuditAction;
          timestamp: string;
          actor: string;
          previous_hash: string;
          current_hash: string;
          details?: AuditLogDetails;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          document_id?: string;
          sequence_number?: number;
          action?: AuditAction;
          timestamp?: string;
          actor?: string;
          previous_hash?: string;
          current_hash?: string;
          details?: AuditLogDetails;
        };
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          organization_id: string | null;
          category: string;
          legal_basis: string;
          court_or_authority: string | null;
          title: string;
          content: string;
          trigger_keywords: string[];
          embedding: number[] | null;
          tsv: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          category: string;
          legal_basis: string;
          court_or_authority?: string | null;
          title: string;
          content: string;
          trigger_keywords?: string[];
          embedding?: number[] | null;
          tsv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          category?: string;
          legal_basis?: string;
          court_or_authority?: string | null;
          title?: string;
          content?: string;
          trigger_keywords?: string[];
          embedding?: number[] | null;
          tsv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_new_organization: {
        Args: {
          org_name: string;
          org_seat: string;
          org_chamber: string;
        };
        Returns: Database['public']['Tables']['organizations']['Row'];
      };
      create_organization_with_owner: {
        Args: {
          p_org_name: string;
          p_official_seat: string;
          p_chamber_district: string;
        };
        Returns: Database['public']['Tables']['organizations']['Row'];
      };
      match_knowledge_documents: {
        Args: {
          p_query_text: string;
          p_query_embedding?: number[] | null;
          p_organization_id?: string | null;
          p_category?: string | null;
          p_match_count?: number;
          p_vector_weight?: number;
        };
        Returns: Array<{
          id: string;
          organization_id: string | null;
          category: string;
          legal_basis: string;
          court_or_authority: string | null;
          title: string;
          content: string;
          trigger_keywords: string[];
          bm25_score: number;
          vector_score: number;
          combined_score: number;
          match_source: string;
          created_at: string;
          updated_at: string;
        }>;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T];
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
