import { describe, it, expect } from 'vitest';
import { normalizeVoter } from '../lib/api/voters.api';

describe('Voter Data Normalization Suite', () => {
  it('correctly maps uppercase FAKE database enum to TitleCase Fake', () => {
    const rawVoter: any = {
      id: 'uuid-1',
      epicNumber: 'ABC1234567',
      name: 'Ravi Kumar',
      voterStatus: 'FAKE',
      politicalPreference: 'TDP',
    };

    const normalized = normalizeVoter(rawVoter);
    expect(normalized.voterStatus).toBe('Fake');
    expect(normalized.epicNumber).toBe('ABC1234567');
    expect(normalized.politicalPreference).toBe('TDP');
  });

  it('correctly maps uppercase DUPLICATE database enum to TitleCase Duplicate', () => {
    const rawVoter: any = {
      id: 'uuid-2',
      epicNumber: 'XYZ9876543',
      name: 'Lakshmi Devi',
      voterStatus: 'DUPLICATE',
    };

    const normalized = normalizeVoter(rawVoter);
    expect(normalized.voterStatus).toBe('Duplicate');
  });

  it('handles already TitleCase voter status without mutation', () => {
    const rawVoter: any = {
      id: 'uuid-3',
      voterStatus: 'Active',
    };

    const normalized = normalizeVoter(rawVoter);
    expect(normalized.voterStatus).toBe('Active');
  });
});
