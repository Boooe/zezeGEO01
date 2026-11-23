-- 确保有6个品牌
INSERT INTO geo_brands (name, industry, contact_person, contact_phone, status)
SELECT '本地生活A品牌', 'local_life', '张经理', '13800138001', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '本地生活A品牌');

INSERT INTO geo_brands (name, industry, contact_person, contact_phone, status)
SELECT '教育B品牌', 'education', '李主管', '13800138002', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '教育B品牌');

INSERT INTO geo_brands (name, industry, contact_person, contact_phone, status)
SELECT '医疗C品牌', 'medical', '王院长', '13800138003', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '医疗C品牌');

INSERT INTO geo_brands (name, industry, contact_person, contact_phone, status)
SELECT '家装D品牌', 'home_decor', '赵总监', '13800138004', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '家装D品牌');

INSERT INTO geo_brands (name, industry, contact_person, contact_phone, status)
SELECT '餐饮E品牌', 'catering', '陈店长', '13800138005', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '餐饮E品牌');

INSERT INTO geo_brands (name, industry, contact_person, contact_phone, status)
SELECT '旅游F品牌', 'travel', '刘经理', '13800138006', 'active'
WHERE NOT EXISTS (SELECT 1 FROM geo_brands WHERE name = '旅游F品牌');
