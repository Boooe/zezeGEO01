-- 品牌诊断表
CREATE TABLE IF NOT EXISTS geo_diagnosis_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES geo_brands(id) ON DELETE CASCADE,
  brand_name varchar(200) NOT NULL,
  website varchar(500),
  industry varchar(100),
  core_keywords text[] DEFAULT '{}',
  status varchar(20) NOT NULL DEFAULT 'pending',
  report_id uuid,
  error text,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

COMMENT ON COLUMN geo_diagnosis_tasks.core_keywords IS '@type string[]';

ALTER TABLE geo_diagnosis_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_dt ON geo_diagnosis_tasks
  TO service_role USING (true);

CREATE POLICY "修改全部数据_dt" ON geo_diagnosis_tasks
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_dt" ON geo_diagnosis_tasks
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_diagnosis_tasks_brand ON geo_diagnosis_tasks(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_diagnosis_tasks_status ON geo_diagnosis_tasks(status);

-- 诊断报告表
CREATE TABLE IF NOT EXISTS geo_diagnosis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES geo_diagnosis_tasks(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  overall_score int DEFAULT 0,
  seo_score int DEFAULT 0,
  content_score int DEFAULT 0,
  keyword_score int DEFAULT 0,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_token varchar(100),
  share_expires_at TIMESTAMP(3) WITH TIME ZONE,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

COMMENT ON COLUMN geo_diagnosis_reports.report_data IS '@type { summary: string, strengths: string[], weaknesses: string[], recommendations: { title: string, detail: string, priority: string }[] }';

ALTER TABLE geo_diagnosis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_dr ON geo_diagnosis_reports
  TO service_role USING (true);

CREATE POLICY "修改全部数据_dr" ON geo_diagnosis_reports
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_dr" ON geo_diagnosis_reports
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_diagnosis_reports_brand ON geo_diagnosis_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_diagnosis_reports_task ON geo_diagnosis_reports(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_diagnosis_reports_share ON geo_diagnosis_reports(share_token) WHERE share_token IS NOT NULL;

-- 词池表
CREATE TABLE IF NOT EXISTS geo_keyword_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  keyword varchar(100) NOT NULL,
  keyword_type varchar(20) NOT NULL DEFAULT 'longtail',
  group_id uuid REFERENCES geo_keyword_groups(id) ON DELETE SET NULL,
  source varchar(50) DEFAULT 'manual',
  search_volume int,
  competition decimal(3,2),
  added_at TIMESTAMP(3) WITH TIME ZONE,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

ALTER TABLE geo_keyword_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_kp ON geo_keyword_pool
  TO service_role USING (true);

CREATE POLICY "修改全部数据_kp" ON geo_keyword_pool
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_kp" ON geo_keyword_pool
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_keyword_pool_brand ON geo_keyword_pool(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_keyword_pool_keyword ON geo_keyword_pool(keyword);

-- 发布记录表
CREATE TABLE IF NOT EXISTS geo_publish_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  task_id uuid REFERENCES geo_creation_tasks(id) ON DELETE SET NULL,
  content_type varchar(20) NOT NULL DEFAULT 'article',
  title varchar(200),
  external_url varchar(500),
  platform varchar(100),
  status varchar(20) NOT NULL DEFAULT 'pending',
  publish_date TIMESTAMP(3) WITH TIME ZONE,
  notes text,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

ALTER TABLE geo_publish_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_pr ON geo_publish_records
  TO service_role USING (true);

CREATE POLICY "修改全部数据_pr" ON geo_publish_records
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_pr" ON geo_publish_records
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_publish_records_brand ON geo_publish_records(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_publish_records_status ON geo_publish_records(status);

-- 知识库表
CREATE TABLE IF NOT EXISTS geo_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES geo_brands(id) ON DELETE CASCADE,
  category varchar(100) DEFAULT 'general',
  title varchar(200) NOT NULL,
  content text NOT NULL,
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

COMMENT ON COLUMN geo_knowledge_base.tags IS '@type string[]';

ALTER TABLE geo_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_kb ON geo_knowledge_base
  TO service_role USING (true);

CREATE POLICY "修改全部数据_kb" ON geo_knowledge_base
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_kb" ON geo_knowledge_base
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_knowledge_base_brand ON geo_knowledge_base(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_knowledge_base_category ON geo_knowledge_base(category);

-- 官网设置表
CREATE TABLE IF NOT EXISTS geo_website_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL UNIQUE REFERENCES geo_brands(id) ON DELETE CASCADE,
  domain varchar(500),
  site_name varchar(200),
  site_description text,
  contact_info jsonb DEFAULT '{}'::jsonb,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

COMMENT ON COLUMN geo_website_settings.contact_info IS '@type { phone: string, email: string, address: string }';

ALTER TABLE geo_website_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_ws ON geo_website_settings
  TO service_role USING (true);

CREATE POLICY "修改全部数据_ws" ON geo_website_settings
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_ws" ON geo_website_settings
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

-- TDK 模板表
CREATE TABLE IF NOT EXISTS geo_tdk_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  title_template text NOT NULL,
  description_template text NOT NULL,
  keywords_template text NOT NULL,
  page_type varchar(50),
  is_default boolean DEFAULT false,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

ALTER TABLE geo_tdk_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_tdk ON geo_tdk_templates
  TO service_role USING (true);

CREATE POLICY "修改全部数据_tdk" ON geo_tdk_templates
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_tdk" ON geo_tdk_templates
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_tdk_templates_brand ON geo_tdk_templates(brand_id);

-- 站群表
CREATE TABLE IF NOT EXISTS geo_site_network (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  site_name varchar(200) NOT NULL,
  domain varchar(500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  cms_type varchar(50),
  notes text,
  creator_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
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

ALTER TABLE geo_site_network ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_sn ON geo_site_network
  TO service_role USING (true);

CREATE POLICY "修改全部数据_sn" ON geo_site_network
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_sn" ON geo_site_network
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX IF NOT EXISTS idx_geo_site_network_brand ON geo_site_network(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_site_network_status ON geo_site_network(status);

-- 账号信息扩展表
CREATE TABLE IF NOT EXISTS geo_account_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES geo_users(id) ON DELETE CASCADE,
  company_name varchar(200),
  industry varchar(100),
  region varchar(100),
  contact_name varchar(100),
  contact_phone varchar(50),
  _created_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE geo_account_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_ap ON geo_account_profiles
  TO service_role USING (true);

CREATE POLICY "修改全部数据_ap" ON geo_account_profiles
  AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "查看全部数据_ap" ON geo_account_profiles
  AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
