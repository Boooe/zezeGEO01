-- 关键词分组表
CREATE TABLE IF NOT EXISTS geo_keyword_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  _created_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id', TRUE) = '' THEN NULL
      ELSE concat('(', current_setting('app.user_id', TRUE), ')')::user_profile
    END
  ),
  _updated_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id', TRUE) = '' THEN NULL
      ELSE concat('(', current_setting('app.user_id', TRUE), ')')::user_profile
    END
  )
);

ALTER TABLE geo_keyword_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_kg ON geo_keyword_groups
  TO service_role USING (true);

CREATE POLICY "修改全部数据_kg" ON geo_keyword_groups
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_kg" ON geo_keyword_groups
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_keyword_groups_brand ON geo_keyword_groups(brand_id);

-- 关键词表加 group_id
ALTER TABLE geo_keywords ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES geo_keyword_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_geo_keywords_group ON geo_keywords(group_id);

-- 统一创作任务表
CREATE TABLE IF NOT EXISTS geo_creation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
  task_type varchar(20) NOT NULL DEFAULT 'image',
  task_name varchar(200) NOT NULL,
  title varchar(200),
  content text,
  keywords text[] DEFAULT '{}',
  longtail_keywords text[] DEFAULT '{}',
  group_id uuid REFERENCES geo_keyword_groups(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  ratio varchar(20) DEFAULT '1:1',
  duration varchar(20),
  resolution varchar(20) DEFAULT 'hd',
  subtitle_enabled boolean DEFAULT false,
  subtitle_style varchar(50),
  bgm_url text,
  bgm_volume int DEFAULT 50,
  voice_id varchar(100),
  voice_name varchar(100),
  original_audio_enabled boolean DEFAULT true,
  image_mode varchar(20) DEFAULT 'ai_generate',
  image_prompt text,
  image_count int DEFAULT 1,
  reference_images text[] DEFAULT '{}',
  material_image_ids uuid[] DEFAULT '{}',
  uploaded_image_urls text[] DEFAULT '{}',
  video_prompt text,
  video_reference_images text[] DEFAULT '{}',
  video_material_id uuid,
  result_images text[] DEFAULT '{}',
  result_video_url text,
  result_cover_url text,
  external_task_id varchar(200),
  status varchar(20) NOT NULL DEFAULT 'pending',
  error text,
  cost_credits int NOT NULL DEFAULT 0,
  duration_ms int,
  started_at TIMESTAMP(3) WITH TIME ZONE,
  completed_at TIMESTAMP(3) WITH TIME ZONE,
  _created_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id', TRUE) = '' THEN NULL
      ELSE concat('(', current_setting('app.user_id', TRUE), ')')::user_profile
    END
  ),
  _updated_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile DEFAULT (
    CASE
      WHEN current_setting('app.user_id', TRUE) = '' THEN NULL
      ELSE concat('(', current_setting('app.user_id', TRUE), ')')::user_profile
    END
  )
);

COMMENT ON COLUMN geo_creation_tasks.keywords IS '@type string[]';
COMMENT ON COLUMN geo_creation_tasks.longtail_keywords IS '@type string[]';
COMMENT ON COLUMN geo_creation_tasks.tags IS '@type string[]';
COMMENT ON COLUMN geo_creation_tasks.reference_images IS '@type string[]';
COMMENT ON COLUMN geo_creation_tasks.material_image_ids IS '@type string[]';
COMMENT ON COLUMN geo_creation_tasks.uploaded_image_urls IS '@type string[]';
COMMENT ON COLUMN geo_creation_tasks.video_reference_images IS '@type string[]';
COMMENT ON COLUMN geo_creation_tasks.result_images IS '@type string[]';

ALTER TABLE geo_creation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_ct ON geo_creation_tasks
  TO service_role USING (true);

CREATE POLICY "修改全部数据_ct" ON geo_creation_tasks
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_ct" ON geo_creation_tasks
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_creation_tasks_brand ON geo_creation_tasks(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_creation_tasks_type ON geo_creation_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_geo_creation_tasks_status ON geo_creation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_geo_creation_tasks_creator ON geo_creation_tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_geo_creation_tasks_created ON geo_creation_tasks(_created_at DESC);
