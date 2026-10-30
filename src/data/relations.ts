import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

// Drizzle v1 takes `relations` (not `schema`) when creating a db instance. No relations are
// declared: repos use plain select/join queries and return domain types.
export const relations = defineRelations(schema);
