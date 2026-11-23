// ---- plugin:geo_image_generate_1 ----
// ============================================================
// 插件 geo_image_generate_1 (geo_image_generate) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type GeoImageGenerateOneInput = {
  /** 图片主题描述，如封面图主题、产品场景内容、海报主题等 */
  image_subject: string;
  /** 图片类型，可选值：封面图、产品场景图、海报 */
  image_type: string;
  /** 风格要求，如写实摄影、插画、3D渲染、简约科技等 */
  style_requirements?: string;
  /** 图片比例，支持的值：1:1、4:3、3:4、16:9、9:16、3:2、2:3 */
  ratio?: string;
};

/**
 * const input: GeoImageGenerateOneInput = { image_subject, image_type, style_requirements, ... };
 * capabilityClient.load('geo_image_generate_1').call<GeoImageGenerateOneOutput>('textToImage', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { images } = result;
 * 返回值形如：
 *   {"images":["示例文本"]}
 */
export type GeoImageGenerateOneOutput = {
  images: string[];
};
// ---- end:geo_image_generate_1 ----

// ---- plugin:geo_text_generate_1 ----
// ============================================================
// 插件 geo_text_generate_1 (geo_text_generate) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export type GeoTextGenerateOneInput = {
  /** 内容类型，如SEO文章、视频脚本、营销文案等 */
  content_type: string;
  /** 目标受众群体描述 */
  target_audience?: string;
  /** 期望的内容字数或长度要求 */
  word_count?: string;
  /** 额外的内容要求或补充说明（可选） */
  additional_requirements?: string;
  /** 内容主题或核心关键词，用于生成SEO文章或视频脚本的核心主题 */
  content_topic: string;
};

/**
 * const input: GeoTextGenerateOneInput = { content_type, target_audience, word_count, ... };
 * capabilityClient.load('geo_text_generate_1').callStream<GeoTextGenerateOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 GeoTextGenerateOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"response":"示例文本","content":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.response ?? ''; }
 */
export type GeoTextGenerateOneOutput = {
  response?: string;
  content: string;
};
// ---- end:geo_text_generate_1 ----