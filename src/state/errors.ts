// Routes (src/app) may not import src/data, but they need to catch repo errors by class; this re-export is their door.
export { ValidationError } from '@/data/errors';
