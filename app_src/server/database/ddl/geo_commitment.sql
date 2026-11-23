-- 承诺书版本表
CREATE TABLE IF NOT EXISTS geo_commitment_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_code varchar(20) NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_commitment_versions_code ON geo_commitment_versions(version_code);

-- 承诺书签署记录表
CREATE TABLE IF NOT EXISTS geo_commitment_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES geo_users(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES geo_brands(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES geo_commitment_versions(id),
  version_code varchar(20) NOT NULL,
  sign_method varchar(20) NOT NULL DEFAULT 'checkbox',
  client_ip varchar(50),
  user_agent text,
  signed_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  needs_resign boolean NOT NULL DEFAULT false,
  last_reminded_at TIMESTAMP(3) WITH TIME ZONE,
  remind_count integer NOT NULL DEFAULT 0,
  _created_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_at TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_geo_commitment_signatures_user ON geo_commitment_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_commitment_signatures_brand ON geo_commitment_signatures(brand_id);
CREATE INDEX IF NOT EXISTS idx_geo_commitment_signatures_version ON geo_commitment_signatures(version_id);

-- 启用RLS
ALTER TABLE geo_commitment_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_commitment_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_bypass_policy_cv ON geo_commitment_versions TO service_role USING (true);
CREATE POLICY service_role_bypass_policy_cs ON geo_commitment_signatures TO service_role USING (true);

CREATE POLICY "承诺书版本查看全部" ON geo_commitment_versions AS PERMISSIVE FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "承诺书版本修改全部" ON geo_commitment_versions AS PERMISSIVE FOR ALL TO authenticated USING (true);

CREATE POLICY "承诺书签署查看全部" ON geo_commitment_signatures AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "承诺书签署修改全部" ON geo_commitment_signatures AS PERMISSIVE FOR ALL TO authenticated USING (true);

-- 初始化v1.0版本
INSERT INTO geo_commitment_versions (version_code, content, is_active)
SELECT 'v1.0', '# 客户信息真实性承诺书

## 一、信息真实性承诺

承诺人在此郑重承诺：
1. 所提供的企业信息、资质证明文件、品牌资料、产品及服务介绍等全部信息均真实、准确、完整，不存在虚假记载、误导性陈述或重大遗漏；
2. 提供的营业执照、经营许可证、商标注册证、授权文件等各类资质文件均在有效期内，且承诺人为合法持有方；
3. 提供的图文素材、视频资料、数据指标等内容均来源合法，不存在侵犯任何第三方知识产权、肖像权、名誉权等合法权益的情形；
4. 上述信息如有任何变更或更新，承诺人将在3个工作日内以书面形式告知服务提供方，并同步更新相关资料。

## 二、合法宣传承诺

承诺人承诺，在使用本平台服务进行内容创作、营销推广等活动时，将严格遵守中华人民共和国相关法律法规，包括但不限于：
1. 遵守《中华人民共和国广告法》《中华人民共和国反不正当竞争法》《中华人民共和国消费者权益保护法》《网络安全法》等法律法规规定；
2. 不进行虚假宣传、夸大宣传或引人误解的商业宣传，不虚构点击量、播放量、阅读量、点赞量、评论量、粉丝量等数据指标；
3. 不发布含有损害国家尊严或利益、危害国家安全、扰乱社会秩序、违背公序良俗的内容；
4. 不发布含有淫秽、色情、赌博、暴力、恐怖、邪教、迷信等违反社会主义核心价值观的内容；
5. 不发布侵犯他人知识产权、商业秘密、个人隐私等合法权益的内容；
6. 所有发布内容均符合行业监管要求，涉及特殊行业（医疗、金融、教育等）的内容均具备相应资质。

## 三、法律责任承担

承诺人充分理解并确认：
1. 服务提供方仅对承诺人提交的内容进行形式审查，该形式审查不免除承诺人对内容真实性、合法性应承担的全部法律责任；
2. 因承诺人提供虚假信息、不实资料或发布违法违规内容所引发的任何投诉、举报、索赔、诉讼或行政处罚，均由承诺人自行承担全部法律责任和经济赔偿责任；
3. 如因此给服务提供方造成任何损失（包括但不限于直接损失、间接损失、名誉损失、律师费、诉讼费、赔偿金、行政罚款等），承诺人应予以全额赔偿；
4. 服务提供方有权根据投诉举报或监管要求，对涉嫌违法违规的内容采取删除、屏蔽、终止服务等措施，由此产生的损失由承诺人自行承担。

## 四、其他条款

1. 本承诺书自承诺人勾选确认并提交之日起生效，与双方签订的主服务合同具有同等法律效力；
2. 本承诺书的签署方式为在线电子勾选确认，承诺人确认该签署方式符合《中华人民共和国电子签名法》等相关法律规定，具有法律效力；
3. 本承诺书的解释、履行及争议解决，均适用主服务合同约定的准据法和争议解决方式；
4. 本承诺书未尽事宜，以主服务合同约定为准。

承诺人已仔细阅读并完全理解本承诺书的全部内容，自愿作出上述承诺并承担相应法律责任。
', true
WHERE NOT EXISTS (SELECT 1 FROM geo_commitment_versions WHERE version_code = 'v1.0');
