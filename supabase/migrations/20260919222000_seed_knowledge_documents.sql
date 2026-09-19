-- ============================================================================
-- Migration: 20260919222000_seed_knowledge_documents.sql
-- Ziel: Database-First SSOT für gesetzliche Prüfnormen, DNotI-Gutachten & Präzedenzen
-- Gemäß AGENTS.md Invariante 2 (Kernel-Level RLS) & Invariante 5 (Zero Domain Knowledge in Code)
-- ============================================================================

-- Globale gesetzliche Prüfnormen und DNotI-Gutachten (organization_id = NULL)
INSERT INTO knowledge_documents (
    id,
    organization_id,
    category,
    legal_basis,
    court_or_authority,
    title,
    content,
    trigger_keywords,
    created_at,
    updated_at
) VALUES
    -- 1. GEG 10 Jahre Energieausweis
    (
        'd0000000-0000-4000-8000-000000000001',
        NULL,
        'GESETZLICHE_NORM',
        '§ 80 Abs. 2 GEG',
        NULL,
        'Gültigkeit von Energieausweisen (10 Jahre)',
        'Energieausweise sind gem. § 80 Abs. 2 GEG genau 10 Jahre ab Ausstellungsdatum gültig. Liegt das Ablaufdatum vor dem Bearbeitungsstichtag, MUSS das Feld als OUTDATED (isExpired: true) markiert werden.',
        ARRAY['energieausweis', 'bedarfsausweis', 'verbrauchsausweis'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 2. § 21 BeurkG Grundbuchstand
    (
        'd0000000-0000-4000-8000-000000000002',
        NULL,
        'GESETZLICHE_NORM',
        '§ 21 BeurkG',
        NULL,
        'Grundbuchstand & Amtliche Einsicht',
        'Grundbuchauszüge verfallen nicht kalendarisch und belegen den Aktenstand (VERIFIED). Liegt das Auszugsdatum länger zurück, ist ein neutraler Hinweis auf die vor Beurkundung erforderliche amtliche Grundbucheinsicht gem. § 21 BeurkG in note zu vermerken.',
        ARRAY['grundbuch', 'grundbuchauszug', 'blatt'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 3. MoPeG / eGbR
    (
        'd0000000-0000-4000-8000-000000000003',
        NULL,
        'GESETZLICHE_NORM',
        '§ 707 BGB, § 47 Abs. 2 GBO n.F. (MoPeG)',
        NULL,
        'eGbR-Voreintragungspflicht bei Immobiliengeschäften',
        'Seit Inkrafttreten des MoPeG muss eine rechtsfähige GbR im neuen Gesellschaftsregister (eGbR) eingetragen sein, um im Grundbuch als Eigentümerin eingetragen zu werden oder über ein Grundstück zu verfügen (§ 47 Abs. 2 GBO). Fehlt der Registerauszug (GsR) oder der Namenszusatz "eGbR", ist das Feld auf NEEDS_REVIEW zu setzen und ein Nachweis der Eintragung nachzufordern.',
        ARRAY['gbr', 'gesellschaft bürgerlichen rechts', 'egbr'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 4. § 12 HGB Vertretungsnachweis
    (
        'd0000000-0000-4000-8000-000000000004',
        NULL,
        'GESETZLICHE_NORM',
        '§ 12 HGB, § 21 BNotO',
        NULL,
        'Vertretungsnachweis juristischer Personen',
        'Bei eingetragenen Handelsgesellschaften (GmbH, UG, AG, KG, OHG) muss ein amtlicher Handelsregisterauszug vorliegen und die Vertretungsbefugnis (Einzel- vs. Gesamtvertretung) feststehen. Fehlt der Registerauszug, ist das Feld auf NEEDS_REVIEW zu setzen und eine gezielte Nachforderung (inquiry) zu stellen.',
        ARRAY['gmbh', 'ug', 'ag', 'kg', 'ohg', 'gmbh & co'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 5. MaBV Ratenstaffel
    (
        'd0000000-0000-4000-8000-000000000005',
        NULL,
        'GESETZLICHE_NORM',
        '§ 3 MaBV, § 650u BGB',
        NULL,
        'MaBV-Ratenstaffel bei Bauträgerverträgen',
        'Werden Raten nach Baufortschritt vereinbart, müssen die Fälligkeitsstufen zwingend den gesetzlichen Prozentsätzen des § 3 MaBV entsprechen. Weicht die Ratenstaffel ab oder fehlen Baufortschritts-Nachweise, ist das Feld kaufpreis auf NEEDS_REVIEW zu setzen.',
        ARRAY['bauträger', 'baufortschritt', 'mabv', 'raten', 'teilzahlungen'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 6. § 566 BGB Kauf bricht nicht Miete
    (
        'd0000000-0000-4000-8000-000000000006',
        NULL,
        'GESETZLICHE_NORM',
        '§ 566, § 566a BGB',
        NULL,
        'Kauf bricht nicht Miete & Kautionsübergang',
        'Der Erwerber tritt gem. § 566 BGB kraft Gesetzes in bestehende Mietverträge ein. Liegen nur geschwärzte Mietlisten oder keine Belege über Kautionskonten (§ 566a BGB) vor, ist das Feld mietverhaeltnisse auf NEEDS_REVIEW zu setzen.',
        ARRAY['miete', 'mietvertrag', 'vermietet', 'kaution', 'mietverhaeltnisse'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 7. DNotI-Report MoPeG
    (
        'd0000001-0000-4000-8000-000000000001',
        NULL,
        'DNOTI_GUTACHTEN',
        'DNotI-Report 2023/18 (MoPeG)',
        'Deutsches Notarinstitut (DNotI)',
        'Voreintragung der eGbR im Gesellschaftsregister (§ 47 Abs. 2 GBO n.F.)',
        'Seit dem 01.01.2024 (MoPeG) kann eine Gesellschaft bürgerlichen Rechts (GbR) über ein im Grundbuch eingetragenes Recht nur verfügen oder ein Recht erwerben, wenn sie zuvor im Gesellschaftsregister eingetragen und sodann im Grundbuch als "eGbR" berichtigt ist.',
        ARRAY['gbr', 'mopeg', 'voreintragung', 'gesellschaftsregister', 'egbr'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 8. AG Hamburg Handelsregisterauszug
    (
        'd0000001-0000-4000-8000-000000000002',
        NULL,
        'AMTSGERICHT_PRAXIS',
        '§ 12 HGB / AG Hamburg Az. 14 HRB',
        'Amtsgericht Hamburg (Registergericht)',
        'Aktualität von Handelsregisterauszügen bei Vertretungshandlungen',
        'Wird bei der Veräußerung oder Belastung einer Liegenschaft eine juristische Person (GmbH, UG, AG, KG) vertreten, verlangt das Registergericht sowie das Grundbuchamt Hamburg zwingend den Nachweis der Vertretungsmacht durch einen tagesaktuellen (maximal 14 Tage alten) beglaubigten Registerauszug.',
        ARRAY['gmbh', 'ug', 'kg', 'ag', 'hamburg', 'registerauszug', 'vertretungsmacht'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 9. DNotI Sanierungsvermerk
    (
        'd0000001-0000-4000-8000-000000000003',
        NULL,
        'DNOTI_GUTACHTEN',
        'DNotI-Gutachten Dok.-Nr. 184592 (§ 144 BauGB)',
        'Deutsches Notarinstitut (DNotI)',
        'Genehmigungspflicht bei Sanierungs- und Entwicklungsvermerken',
        'Befindet sich das Flurstück in einem förmlich festgelegten Sanierungsgebiet (§ 142 BauGB), bedarf der Kaufvertrag sowie die Auflassung der schriftlichen Genehmigung der Gemeinde gem. § 144 Abs. 2 BauGB vor Vollzug.',
        ARRAY['sanierungsvermerk', 'entwicklungsvermerk', 'baugb', 'gemeindegenehmigung'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 10. OLG München Erbnachweis
    (
        'd0000001-0000-4000-8000-000000000004',
        NULL,
        'AMTSGERICHT_PRAXIS',
        '§ 35 GBO / OLG München 34 Wx',
        'OLG München / AG München (Grundbuchamt)',
        'Erbnachweis bei unberichtigtem Grundbuch',
        'Ist im Grundbuch noch der Erblasser eingetragen, kann der Nachweis der Erbfolge gegenüber dem Grundbuchamt nur durch Erbschein oder europäisches Nachlasszeugnis bzw. notarielles Testament mit Eröffnungsprotokoll geführt werden (§ 35 Abs. 1 GBO).',
        ARRAY['erblasser', 'erbschein', 'erbfall', 'testament', 'nachlass'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    )
ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    legal_basis = EXCLUDED.legal_basis,
    court_or_authority = EXCLUDED.court_or_authority,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    trigger_keywords = EXCLUDED.trigger_keywords,
    updated_at = now();
