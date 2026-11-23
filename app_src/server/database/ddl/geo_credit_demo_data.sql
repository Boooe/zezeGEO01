-- 确保有6个品牌（已有的保留，不足的补）
INSERT INTO geo_brands (id, name, industry, contact_person, contact_phone, status)
SELECT gen_random_uuid(), '本地生活A品牌', 'local_life', '张经理', '13800138001', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '本地生活A品牌');

INSERT INTO geo_brands (id, name, industry, contact_person, contact_phone, status)
SELECT gen_random_uuid(), '教育B品牌', 'education', '李主管', '13800138002', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '教育B品牌');

INSERT INTO geo_brands (id, name, industry, contact_person, contact_phone, status)
SELECT gen_random_uuid(), '医疗C品牌', 'medical', '王院长', '13800138003', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '医疗C品牌');

INSERT INTO geo_brands (id, name, industry, contact_person, contact_phone, status)
SELECT gen_random_uuid(), '家装D品牌', 'home_decor', '赵总监', '13800138004', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '家装D品牌');

INSERT INTO geo_brands (id, name, industry, contact_person, contact_phone, status)
SELECT gen_random_uuid(), '餐饮E品牌', 'catering', '陈店长', '13800138005', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '餐饮E品牌');

INSERT INTO geo_brands (id, name, industry, contact_person, contact_phone, status)
SELECT gen_random_uuid(), '旅游F品牌', 'travel', '刘经理', '13800138006', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '旅游F品牌');

-- 给每个品牌创建算力账户（基础版/标准版/旗舰版各2个），并写入初始套餐赠送流水
DO $$
DECLARE
  r RECORD;
  plan_id UUID;
  account_id UUID;
  plan_code TEXT;
  credit_amount NUMERIC;
  plan_amount NUMERIC;
  idx INTEGER := 0;
BEGIN
  FOR r IN SELECT id, name FROM geo_brands ORDER BY name LIMIT 6 LOOP
    idx := idx + 1;
    
    -- 分配套餐：1-2基础版, 3-4标准版, 5-6旗舰版
    IF idx <= 2 THEN
      plan_code := 'basic';
      credit_amount := 300000;
      plan_amount := 9800;
    ELSIF idx <= 4 THEN
      plan_code := 'standard';
      credit_amount := 800000;
      plan_amount := 19800;
    ELSE
      plan_code := 'premium';
      credit_amount := 2000000;
      plan_amount := 39800;
    END IF;
    
    SELECT id INTO plan_id FROM geo_credit_plans WHERE plan_code = plan_code LIMIT 1;
    
    -- 创建账户
    INSERT INTO geo_credit_accounts (brand_id, balance, total_used, total_recharged, current_plan_id, plan_expires_at)
    VALUES (r.id, credit_amount::TEXT::NUMERIC, 0, credit_amount::TEXT::NUMERIC, plan_id, NOW() + INTERVAL '1 year')
    ON CONFLICT (brand_id) DO NOTHING;
    
    -- 获取账户ID
    SELECT id INTO account_id FROM geo_credit_accounts WHERE brand_id = r.id LIMIT 1;
    
    -- 如果账户已存在且没有流水，写入一条套餐赠送流水
    IF NOT EXISTS (SELECT 1 FROM geo_credit_transactions WHERE brand_id = r.id AND transaction_type = 'plan_grant' LIMIT 1) THEN
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, related_id, remark)
      VALUES (r.id, account_id, 'plan_grant', credit_amount::TEXT::NUMERIC, credit_amount::TEXT::NUMERIC, 'plan', plan_id, '套餐赠送：' || plan_code);
    END IF;
    
    -- 给每个品牌加若干扣减流水（模拟本月消费），余额和流水对得上
    -- 基础版：文章10篇(100000) + 图片30张(60000) + 视频1条(50000) = 210000
    -- 标准版：文章20篇(200000) + 图片60张(120000) + 视频3条(150000) = 470000
    -- 旗舰版：文章50篇(500000) + 图片100张(200000) + 视频8条(400000) = 1100000
    IF idx <= 2 THEN
      -- 基础版模拟消费
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'article_generate', -100000, (credit_amount - 100000)::TEXT::NUMERIC, 'article', '文章生成 10 篇');
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'image_generate', -60000, (credit_amount - 160000)::TEXT::NUMERIC, 'image', '图片生成 30 张');
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'video_generate', -50000, (credit_amount - 210000)::TEXT::NUMERIC, 'video', '视频生成 1 条');
      -- 更新余额
      UPDATE geo_credit_accounts SET balance = (credit_amount - 210000)::TEXT::NUMERIC, total_used = 210000::TEXT::NUMERIC WHERE id = account_id;
    ELSIF idx <= 4 THEN
      -- 标准版模拟消费
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'article_generate', -200000, (credit_amount - 200000)::TEXT::NUMERIC, 'article', '文章生成 20 篇');
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'image_generate', -120000, (credit_amount - 320000)::TEXT::NUMERIC, 'image', '图片生成 60 张');
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'video_generate', -150000, (credit_amount - 470000)::TEXT::NUMERIC, 'video', '视频生成 3 条');
      UPDATE geo_credit_accounts SET balance = (credit_amount - 470000)::TEXT::NUMERIC, total_used = 470000::TEXT::NUMERIC WHERE id = account_id;
    ELSE
      -- 旗舰版模拟消费
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'article_generate', -500000, (credit_amount - 500000)::TEXT::NUMERIC, 'article', '文章生成 50 篇');
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'image_generate', -200000, (credit_amount - 700000)::TEXT::NUMERIC, 'image', '图片生成 100 张');
      INSERT INTO geo_credit_transactions (brand_id, account_id, transaction_type, amount, balance_after, related_type, remark)
      VALUES (r.id, account_id, 'video_generate', -400000, (credit_amount - 1100000)::TEXT::NUMERIC, 'video', '视频生成 8 条');
      UPDATE geo_credit_accounts SET balance = (credit_amount - 1100000)::TEXT::NUMERIC, total_used = 1100000::TEXT::NUMERIC WHERE id = account_id;
    END IF;
  END LOOP;
END $$;
