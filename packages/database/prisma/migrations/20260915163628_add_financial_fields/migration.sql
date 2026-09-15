-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "iof_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 7.38,
ADD COLUMN     "monthly_revenue_goal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "expiring_premium" DECIMAL(12,2);
