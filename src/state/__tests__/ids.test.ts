import { randomUUID } from 'node:crypto';

import { newId } from '../ids';

// jest-expo stubs the native module (randomUUID returns undefined), so back it with Node's real v4 generator.
// (Variables prefixed `mock` may be referenced inside a hoisted jest.mock factory.)
const mockRandomUUID = randomUUID;
jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

describe('newId', () => {
  it('returns a UUID v4 string', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns a different id each call', () => {
    expect(newId()).not.toBe(newId());
  });
});
