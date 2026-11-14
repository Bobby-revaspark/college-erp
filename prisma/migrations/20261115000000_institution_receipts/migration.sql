ALTER TABLE `FeeTransaction`
  ADD COLUMN `requestId` VARCHAR(191) NULL,
  ADD COLUMN `balanceAfter` DECIMAL(12,2) NULL;
CREATE UNIQUE INDEX `FeeTransaction_requestId_key` ON `FeeTransaction`(`requestId`);
CREATE TABLE `Institution` (
  `id` VARCHAR(191) NOT NULL DEFAULT 'college',
  `name` VARCHAR(191) NOT NULL,
  `address` TEXT NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `website` VARCHAR(191) NOT NULL,
  `logoUrl` MEDIUMTEXT NOT NULL,
  `academicYear` VARCHAR(191) NOT NULL,
  `receiptNote` TEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
