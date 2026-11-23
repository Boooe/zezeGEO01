-- 给6个品牌创建算力账户并写入套餐赠送流水（前2基础版、中间2标准版、最后2旗舰版）
-- 品牌按name排序取前6个（新增的A-F品牌）

-- 先查套餐ID（手动写死plan_code匹配）
-- basic=30万, standard=80万, premium=200万

-- 品牌1（按name排序第1个）：基础版
INSERT INTO geo_credit_accounts (brand_id, balance, total_used, total_recharged, current_plan_id, plan_expires_at)
SELECT b.id, '300000', '0', '300000', p.id, NOW() + INTERVAL '1 year'
FROM geo_brands b
CROSS JOIN geo_credit_plans p
WHERE b.name = (SELECT name FROM geo_brands ORDER BY name LIMIT 1 OFFSET 0)
  AND p.plan_code = 'basic'
  AND NOT EXISTS (SELECT 1 FROM geo_credit_accounts WHERE brand_id = b.id);

-- 品牌2：基础版
INSERT INTO geo_credit_accounts (brand_id, balance, total_used, total_recharged, current_plan_id, plan_expires_at)
SELECT b.id, '300000', '0', '300000', p.id, NOW() + INTERVAL '1 year'
FROM geo_brands b
CROSS JOIN geo_credit_plans p
WHERE b.name = (SELECT name FROM geo_brands ORDER BY name LIMIT 1 OFFSET 1)
  AND p.plan_code = 'basic'
  AND NOT EXISTS (SELECT 1 FROM geo_credit_accounts WHERE brand_id = b.id);

-- 品牌3：标准版
INSERT INTO geo_credit_accounts (brand_id, balance, total_used, total_recharged, current_plan_id, plan_expires_at)
SELECT b.id, '800000', '0', '800000', p.id, NOW() + INTERVAL '1 year'
FROM geo_brands b
CROSS JOIN geo_credit_plans p
WHERE b.name = (SELECT name FROM geo_brands ORDER BY name LIMIT 1 OFFSET 2)
  AND p.plan_code = 'standard'
  AND NOT EXISTS (SELECT 1 FROM geo_credit_accounts WHERE brand_id = b.id);

-- 品牌4：标准版
INSERT INTO geo_credit_accounts (brand_id, balance, total_used, total_recharged, current_plan_id, plan_expires_at)
SELECT b.id, '800000', '0', '800000', p.id, NOW() + INTERVAL '1 year'
FROM geo_brands b
CROSS JOIN geo_credit_plans p
WHERE b.name = (SELECT name FROM geo_brands ORDER BY name LIMIT 1 OFFSET 3)
  AND p.plan_code = 'standard'
  AND NOT EXISTS (SELECT 1 FROM geo_credit_accounts WHERE brand_id = b.id);

-- 品牌5：旗舰版
INSERT INTO geo_credit_accounts (brand_id, balance, total_used, total_recharged, current_plan_id, plan_expires_at)
SELECT b.id, '2000000', '0', '2000000', p.id, NOW() + INTERVAL '1 year'
FROM geo_brands b
CROSS JOIN geo_credit_plans p
WHERE b.name = (SELECT name FROM geo_brands ORDER BY name LIMIT 1 OFFSET 4)
  AND p.plan_code = 'premium'
  AND NOT EXISTS (SELECT 1 FROM geo_credit_accounts WHERE brand_id = b.id);

-- 品牌6：旗舰版
INSERT INTO geo_credit_accounts (brand_id, balance, total_used, total_recharged, current_plan_id, plan_expires_at)
SELECT b.id, '2000000', '0', '2000000', p.id, NOW() + INTERVAL '1 year'
FROM geo_brands b
CROSS JOIN geo_credit_plans p
WHERE b.name = (SELECT name FROM geo_brands ORDER BY name LIMIT 1 OFFSET 5)
  AND p.plan_code = 'premium'
  AND NOT EXISTS (SELECT 1 FROM geo_credit_accounts WHERE brand_id = b.id);
