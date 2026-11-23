-- ============================================================
--  视频生成任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS geo_video_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  task_name VARCHAR(200) NOT NULL,
  topic TEXT NOT NULL,
  duration VARCHAR(20) NOT NULL DEFAULT '30s',
  ratio VARCHAR(20) NOT NULL DEFAULT '9:16',
  cover_image TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  external_task_id VARCHAR(100),
  video_url TEXT,
  video_cover_url TEXT,
  cost_credits NUMERIC NOT NULL DEFAULT 0,
  error TEXT,
  creator_id UUID NOT NULL REFERENCES geo_users(id),
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id'::text, true) = ''::text THEN NULL
      ELSE concat('(', current_setting('app.user_id'::text, true), ')')::user_profile
    END
  ),
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id'::text, true) = ''::text THEN NULL
      ELSE concat('(', current_setting('app.user_id'::text, true), ')')::user_profile
    END
  ),

CREATE INDEX IF NOT EXISTS idx_geo_video_tasks_brand ON geo_video_tasks(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_video_tasks_status ON geo_video_tasks(status);
CREATE INDEX IF NOT EXISTS idx_geo_video_tasks_creator ON geo_video_tasks(creator_id);

-- ============================================================
--  视频服务配置表（单条记录）
-- ============================================================
CREATE TABLE IF NOT EXISTS geo_video_service_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url VARCHAR(500) NOT NULL,
  api_key VARCHAR(200) NOT NULL,
  model VARCHAR(100) NOT NULL,
  callback_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id'::text, true) = ''::text THEN NULL
      ELSE concat('(', current_setting('app.user_id'::text, true), ')')::user_profile
    END
  ),
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id'::text, true) = ''::text THEN NULL
      ELSE concat('(', current_setting('app.user_id'::text, true), ')')::user_profile
    END
  ),

-- ============================================================
--  图片服务配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS geo_image_service_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url VARCHAR(500) NOT NULL,
  api_key VARCHAR(200) NOT NULL,
  model VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id'::text, true) = ''::text THEN NULL
      ELSE concat('(', current_setting('app.user_id'::text, true), ')')::user_profile
    END
  ),
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id'::text, true) = ''::text THEN NULL
      ELSE concat('(', current_setting('app.user_id'::text, true), ')')::user_profile
    END
  ),

-- ============================================================
--  RLS 策略（沿用现有 geo 表模式）
-- ============================================================
ALTER TABLE geo_video_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_video_service_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_image_service_config ENABLE ROW LEVEL SECURITY;

-- geo_video_tasks：全部查看 + 全部修改（按品牌/角色在业务层过滤）
DROP POLICY IF EXISTS geo_video_tasks_all ON geo_video_tasks;
CREATE POLICY geo_video_tasks_all ON geo_video_tasks
  FOR ALL USING (true) WITH CHECK (true);

-- geo_video_service_config：admin only（业务层控制，这里全开）
DROP POLICY IF EXISTS geo_video_service_config_all ON geo_video_service_config;
CREATE POLICY geo_video_service_config_all ON geo_video_service_config
  FOR ALL USING (true) WITH CHECK (true);

-- geo_image_service_config：admin only（业务层控制，这里全开）
DROP POLICY IF EXISTS geo_image_service_config_all ON geo_image_service_config;
CREATE POLICY geo_image_service_config_all ON geo_image_service_config
  FOR ALL USING (true) WITH CHECK (true);
