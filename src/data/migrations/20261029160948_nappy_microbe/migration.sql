CREATE TABLE `day_tasks` (
	`id` text PRIMARY KEY,
	`dayKey` text NOT NULL,
	`taskId` text,
	`topicId` text NOT NULL,
	`name` text NOT NULL,
	`colorKey` text NOT NULL,
	`kind` text NOT NULL,
	`budgetSec` integer NOT NULL,
	`cue` text,
	`treat` text,
	`forwardedFromDayKey` text,
	`completedAt` integer,
	`closeOutcome` text,
	`sortOrder` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_day_tasks_dayKey_days_dayKey_fk` FOREIGN KEY (`dayKey`) REFERENCES `days`(`dayKey`),
	CONSTRAINT `fk_day_tasks_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`)
);
--> statement-breakpoint
CREATE TABLE `days` (
	`dayKey` text PRIMARY KEY,
	`planConfirmedAt` integer,
	`closedAt` integer,
	`closedBy` text,
	`dayStartHour` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`dayTaskId` text NOT NULL,
	`startedAt` integer NOT NULL,
	`endedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_sessions_dayTaskId_day_tasks_id_fk` FOREIGN KEY (`dayTaskId`) REFERENCES `day_tasks`(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY,
	`topicId` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`minutes` integer NOT NULL,
	`repeatMask` integer NOT NULL,
	`isDefault` integer NOT NULL,
	`cue` text,
	`treat` text,
	`note` text NOT NULL,
	`sortOrder` integer NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_tasks_topicId_topics_id_fk` FOREIGN KEY (`topicId`) REFERENCES `topics`(`id`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`colorKey` text NOT NULL,
	`sortOrder` integer NOT NULL,
	`isOpen` integer NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_tasks_day_task_unique` ON `day_tasks` (`dayKey`,`taskId`) WHERE "day_tasks"."taskId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `day_tasks_dayKey_idx` ON `day_tasks` (`dayKey`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_one_open` ON `sessions` (("endedAt" IS NULL)) WHERE "sessions"."endedAt" IS NULL;--> statement-breakpoint
CREATE INDEX `sessions_dayTaskId_idx` ON `sessions` (`dayTaskId`);