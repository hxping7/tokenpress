/**
 * 0014: 早期版本在这里为轮播写入三个默认设置项
 * （hero_carousel_use_articles / hero_carousel_article_source / hero_carousel_max_items）。
 *
 * 这些值现在**不再写库**，原因有二：
 *  1. 它们是纯功能默认值，消费端已全部自带等价兜底（见 app/page.tsx：
 *     `=== 'true'`、`|| 'latest'`、`|| 5`），写进 DB 属于冗余；
 *  2. 写进 DB 后，全新库会带着这些键，导致安装向导安装风格包自带的演示内容时，
 *     被「按 key 幂等跳过已存在项」挡住 —— 例如演示内容里的
 *     `hero_carousel_use_articles = true` 会被这条默认的 false 顶掉，
 *     新站点首页的「文章封面填补轮播」于是不生效。
 *
 * 注：已存在的部署不受影响（本迁移不再改动任何既有数据）。
 */
export async function migrate(): Promise<void> {
  // 有意留空：仅保留迁移序号，避免与既有部署的迁移顺序错位。
}
