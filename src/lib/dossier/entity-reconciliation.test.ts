import { describe, it, expect } from 'vitest';
import { normalizePersonName, normalizeCompanyName, isEntityMatch } from './entity-reconciliation';

describe('Entity Reconciliation (Deterministic Matching)', () => {
  it('normalizes academic titles and punctuation in person names', () => {
    expect(normalizePersonName('Dr. med. Hans-Peter Müller')).toBe('hans peter müller');
    expect(normalizePersonName('Prof. Dr. Erika Schmidt')).toBe('erika schmidt');
  });

  it('normalizes company legal forms and ampersands', () => {
    expect(normalizeCompanyName('Muster Invest GmbH & Co. KG')).toBe('muster invest und');
    expect(normalizeCompanyName('Muster Invest GmbH und Co. KG')).toBe('muster invest und');
  });

  it('matches persons across variations with titles and middle names', () => {
    expect(isEntityMatch('Dr. Hans-Peter Müller', 'Hans Peter Müller')).toBe(true);
    expect(isEntityMatch('Erika Schmidt', 'Erika Schmidt-May')).toBe(true);
    expect(isEntityMatch('Max Mustermann', 'Erika Musterfrau')).toBe(false);
  });

  it('matches companies across legal form variations', () => {
    expect(isEntityMatch('Bauwerk GmbH & Co. KG', 'Bauwerk GmbH')).toBe(true);
  });
});
