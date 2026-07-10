-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "created_by" UUID;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
