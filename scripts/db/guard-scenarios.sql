-- Szenarien für die Datenbank-Wächter (Prüfvermerk, Job-Zwischenergebnis). Nur gegen eine lokale Wegwerf-Datenbank
-- ausführen, NIE gegen die Live-Datenbank (legt Testdaten an):
--   docker run -d --name notar-sqltest -e POSTGRES_PASSWORD=pw -p 54999:5432 public.ecr.aws/supabase/postgres:17.11.0.006
--   alle Migrationen einspielen, dann: docker exec -i notar-sqltest psql -U postgres -d postgres -q < scripts/db/guard-scenarios.sql
-- Erwartet: Fehler "Keine Berechtigung für den Prüfvermerk" unter den Überschriften "muss scheitern", sonst keine.
\set ON_ERROR_STOP 0
INSERT INTO auth.users (id, email) VALUES
 ('11111111-1111-4111-8111-111111111111','admin@x.de'),
 ('22222222-2222-4222-8222-222222222222','sach@x.de') ON CONFLICT DO NOTHING;
INSERT INTO organizations (id, name, official_seat, chamber_district) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Kanzlei','Hannover','Celle') ON CONFLICT DO NOTHING;
INSERT INTO organization_members (organization_id, user_id, role) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','ADMIN'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','SACHBEARBEITER') ON CONFLICT DO NOTHING;
INSERT INTO documents (id, organization_id, title, content) VALUES
 ('d1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','T','{"fields":{"verkaeufer":{"status":"VERIFIED","review":{"confirmedBy":"Notar","confirmedAt":"2026-01-01"}},"kaeufer":{"status":"NEEDS_REVIEW"}}}');

\echo '--- ADMIN: unveraenderter Vermerk bleibt erlaubt (Status aendern)'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
UPDATE documents SET content='{"fields":{"verkaeufer":{"status":"NEEDS_REVIEW","review":{"confirmedBy":"Notar","confirmedAt":"2026-01-01"}},"kaeufer":{"status":"NEEDS_REVIEW"}}}' WHERE id='d1'; ROLLBACK;
\echo '--- ADMIN: neuer Vermerk an anderem Feld muss scheitern'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
UPDATE documents SET content='{"fields":{"verkaeufer":{"status":"VERIFIED","review":{"confirmedBy":"Notar","confirmedAt":"2026-01-01"}},"kaeufer":{"status":"VERIFIED","review":{"confirmedBy":"Fake","confirmedAt":"2026-02-02"}}}}' WHERE id='d1'; ROLLBACK;
\echo '--- ADMIN: geaenderter Vermerk muss scheitern'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
UPDATE documents SET content='{"fields":{"verkaeufer":{"status":"VERIFIED","review":{"confirmedBy":"Fake","confirmedAt":"2026-01-01"}}}}' WHERE id='d1'; ROLLBACK;
\echo '--- ADMIN: Vermerk entfernen erlaubt'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
UPDATE documents SET content='{"fields":{"verkaeufer":{"status":"VERIFIED"}}}' WHERE id='d1'; ROLLBACK;
\echo '--- ADMIN: INSERT mit Vermerk muss scheitern'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO documents (id, organization_id, title, content) VALUES ('d2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','T','{"fields":{"a":{"review":{"confirmedBy":"Fake"}}}}'); ROLLBACK;
\echo '--- ADMIN: INSERT ohne Vermerk erlaubt'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO documents (id, organization_id, title, content) VALUES ('d3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','T','{"fields":{"a":{"status":"MISSING"}}}'); ROLLBACK;
\echo '--- SACHBEARBEITER: neuer Vermerk erlaubt'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
UPDATE documents SET content='{"fields":{"kaeufer":{"status":"VERIFIED","review":{"confirmedBy":"Sach","confirmedAt":"2026-02-02"}}}}' WHERE id='d1'; ROLLBACK;
\echo '--- ADMIN: Content ohne fields-Objekt erlaubt'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
UPDATE documents SET content='{"fields":[1,2]}' WHERE id='d1'; ROLLBACK;
\echo '--- Jobs: ADMIN Insert mit stage1Output muss scheitern'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO dossier_jobs (id, organization_id, status, payload) VALUES ('j1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PENDING','{"stage1Output":{"fields":{}}}'); ROLLBACK;
\echo '--- Jobs: ADMIN Insert ohne stage1Output erlaubt, Update mit Checkpoint erlaubt'
BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO dossier_jobs (id, organization_id, status, payload) VALUES ('j2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PENDING','{"files":[]}');
UPDATE dossier_jobs SET payload='{"stage1Output":{}}' WHERE id='j2'; ROLLBACK;
\echo '--- Service-Rolle (ohne Sitzung): erlaubt'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO dossier_jobs (id, organization_id, status, payload) VALUES ('j3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PENDING','{"stage1Output":{}}'); ROLLBACK;
