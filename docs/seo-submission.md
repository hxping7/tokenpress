# Token00 搜索引擎与 AI 爬虫提交指南

本文说明如何把 token00.com 提交给搜索引擎与 AI 爬虫，提升站点在常规搜索与生成式引擎（GEO）中的可发现性。

## 1. 提交 sitemap

Sitemap 地址（统一使用 www 域名）：

```
https://www.token00.com/sitemap.xml
```

### Google Search Console
1. 打开 https://search.google.com/search-console 并添加属性 `https://www.token00.com`。
2. 左侧「站点地图」→ 填写 `sitemap.xml` → 提交。
3. 也可通过 ping 即时通知：
   ```
   https://www.google.com/ping?sitemap=https://www.token00.com/sitemap.xml
   ```

### Bing Webmaster Tools
1. 打开 https://www.bing.com/webmasters 添加站点。
2. 「站点地图」→ 提交 `https://www.token00.com/sitemap.xml`。
3. 通过 ping 通知：
   ```
   https://www.bing.com/ping?sitemap=https://www.token00.com/sitemap.xml
   ```

### 百度搜索资源平台（含主动推送 API）
1. 打开 https://ziyuan.baidu.com 验证站点 `https://www.token00.com`。
2. 「数据提交 → sitemap」中提交 sitemap 地址。
3. **主动推送（实时）**：在平台「链接提交 → 主动推送」页获取 `token`，调用接口逐条推送 URL：
   ```
   curl -H "Content-Type: text/plain" \
        -X POST \
        "http://data.zz.baidu.com/sitesubmit/index?site=https://www.token00.com&token=你的TOKEN" \
        --data-binary @urls.txt
   ```
   其中 `urls.txt` 每行一个待收录 URL（可从 sitemap 提取 `<loc>`）。
4. 仓库已提供一键脚本 `scripts/submit-sitemap.sh`，自动 ping Google/Bing 并从 sitemap 提取 URL 推送给百度：
   ```bash
   BAIDU_PUSH_TOKEN=你的TOKEN bash scripts/submit-sitemap.sh
   ```
   > 脚本需在可访问公网的环境运行；未设置 `BAIDU_PUSH_TOKEN` 时仅执行 Google/Bing ping。

## 2. robots.txt 已放行主流 AI 爬虫

`robots.txt` 已允许以下生成式引擎爬虫抓取（不阻断正文，便于被大模型直接索引）：

- `GPTBot`（OpenAI）
- `Google-Extended`（Google Gemini）
- `ClaudeBot`（Anthropic）
- `PerplexityBot`（Perplexity）
- `Applebot-Extended`（Apple）
- `Bytespider`（字节/豆包）
- `CCBot`（Common Crawl）

常规搜索引擎爬虫（Googlebot、Bingbot 等）同样放行。

## 3. 为 LLM 直接提供正文

站点额外暴露两个纯文本端点，供长上下文模型直接读取全站内容：

- `/llms.txt`：摘要版（文章标题、链接、简介），适合概览。
- `/llms-full.txt`：全量版，包含最多最近 100 篇的文章正文（Markdown），供模型抓取全站正文。

示例：
```
https://www.token00.com/llms.txt
https://www.token00.com/llms-full.txt
```

## 4. 注意事项

- **Canonical 统一使用 www 域名**：所有 canonical、OpenGraph `url`、Twitter `url` 及 sitemap 中的 `<loc>` 均使用 `https://www.token00.com`，避免非 www 与 www 重复内容分散权重。
- 提交后通常需数小时至数天被抓取，可在各平台后台查看抓取与索引状态。
- 内容更新后重新运行 `scripts/submit-sitemap.sh` 即可再次通知搜索引擎。
