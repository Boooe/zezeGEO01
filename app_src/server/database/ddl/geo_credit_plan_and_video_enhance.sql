-- 算力套餐配置表
CREATE TABLE IF NOT EXISTS geo_credit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name VARCHAR(100) NOT NULL,
  plan_code VARCHAR(50) NOT NULL UNIQUE,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC NOT NULL DEFAULT 0,
  description VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by USER_PROFILE,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by USER_PROFILE
);

CREATE INDEX IF NOT EXISTS idx_geo_credit_plans_active ON geo_credit_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_geo_credit_plans_sort ON geo_credit_plans(sort_order);

-- 视频任务表补充字段
ALTER TABLE geo_video_tasks ADD COLUMN IF NOT EXISTS purpose VARCHAR(50) NOT NULL DEFAULT 'store_intro';
ALTER TABLE geo_video_tasks ADD COLUMN IF NOT EXISTS style VARCHAR(50);
ALTER TABLE geo_video_tasks ADD COLUMN IF NOT EXISTS script_text TEXT;

-- 图片素材表补充字段（用途、风格、提示词，用于图片生成记录）
ALTER TABLE geo_materials ADD COLUMN IF NOT EXISTS purpose VARCHAR(50);
ALTER TABLE geo_materials ADD COLUMN IF NOT EXISTS image_style VARCHAR(50);
ALTER TABLE geo_materials ADD COLUMN IF NOT EXISTS prompt_text TEXT;

-- 品牌套餐绑定：品牌当前生效的套餐
ALTER TABLE geo_credit_accounts ADD COLUMN IF NOT EXISTS current_plan_id UUID;
ALTER TABLE geo_credit_accounts ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ(3);
ALTER TABLE geo_credit_accounts ADD COLUMN IF NOT EXISTS total_recharged NUMERIC NOT NULL DEFAULT 0;

-- 算力流水补充：关联套餐、收款金额备注
ALTER TABLE geo_credit_transactions ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE geo_credit_transactions ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2);

-- 初始套餐数据（幂等插入）
INSERT INTO geo_credit_plans (plan_name, plan_code, price, credit_amount, description, sort_order)
SELECT '基础版', 'basic', 9800, 300000, '适合小型商户，每月基础内容产出', 1
WHERE NOT EXISTS (SELECT 1 FROM geo_credit_plans WHERE plan_code = 'basic');

INSERT INTO geo_credit_plans (plan_name, plan_code, price, credit_amount, description, sort_order)
SELECT '标准版', 'standard', 19800, 800000, '适合中型客户，多渠道内容覆盖', 2
WHERE NOT EXISTS (SELECT 1 FROM geo_credit_plans WHERE plan_code = 'standard');

INSERT INTO geo_credit_plans (plan_name, plan_code, price, credit_amount, description, sort_order)
SELECT '旗舰版', 'premium', 39800, 2000000, '适合大型客户，全渠道海量内容', 3
WHERE NOT EXISTS (SELECT 1 FROM geo_credit_plans WHERE plan_code = 'premium');
