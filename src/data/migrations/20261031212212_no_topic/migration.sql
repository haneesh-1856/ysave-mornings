-- ADR-012: the built-in "No topic" topic. Fixed id, listed after every user topic (large sortOrder), idempotent.
INSERT OR IGNORE INTO `topics` (`id`, `name`, `colorKey`, `sortOrder`, `isOpen`, `deletedAt`, `createdAt`, `updatedAt`)
VALUES ('no-topic', 'No topic', 'none', 1000000, 1, NULL, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
