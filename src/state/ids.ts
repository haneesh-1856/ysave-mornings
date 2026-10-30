import * as Crypto from 'expo-crypto';

/** A new random UUID v4. Ids are created here (state layer), never in domain. */
export function newId(): string {
  return Crypto.randomUUID();
}
