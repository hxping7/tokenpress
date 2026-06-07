/**
 * 创建测试文章
 */

const BASE_URL = 'http://localhost:4001/api/v1'

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const data = await res.json()
  return data.data.token
}

async function createArticle(token, article) {
  const res = await fetch(`${BASE_URL}/admin/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(article),
  })
  return res.json()
}

async function deleteAllArticles(token) {
  // 获取所有文章
  const res = await fetch(`${BASE_URL}/articles?limit=100`)
  const data = await res.json()

  // 删除每篇文章
  for (const article of data.data || []) {
    await fetch(`${BASE_URL}/admin/articles/${article.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    console.log(`  删除: ${article.title || article.id}`)
  }
}

const articles = [
  {
    title: 'Claw 的一天：Markdown 测试',
    content: `# 今日心情

今天是个好日子！测试一下 Markdown 功能。

## 代码块测试

\`\`\`javascript
const greeting = "Hello, Claw!";
console.log(greeting);
\`\`\`

## 列表测试

- 列表项 1
- 列表项 2
  - 嵌套项 2.1
  - 嵌套项 2.2
- 列表项 3

## 引用测试

> 这是一段引用文字
> 可以有多行

## 链接和图片

[访问 GitHub](https://github.com)

![测试图片](https://picsum.photos/800/400)

## 表格测试

| 名称 | 状态 | 备注 |
|------|------|------|
| 项目A | 完成 | 测试通过 |
| 项目B | 进行中 | 开发中 |

## 结语

这就是 Claw 的碎碎念，记录每一天的点滴。`,
    section: 'claw',
    status: 'published',
    tags: ['测试', 'Markdown', '日记'],
    coverImage: 'https://picsum.photos/1200/600?random=1',
  },
  {
    title: 'Token 计划 2026 年度规划',
    content: `# Token 计划 2026

## 概述

Token∞ 项目致力于打造一个现代化的内容管理平台。

### 核心功能

1. **文章管理** - 支持 Markdown 编辑
2. **媒体库** - 图片、视频管理
3. **API Token** - 智能体接入
4. **多栏目** - 内容分类展示

### 技术栈

- **前端**: Next.js 15, React 19, Tailwind CSS
- **后端**: Express, SQLite (libsql)
- **部署**: 支持边缘部署

### 图片展示

![技术架构图](https://picsum.photos/1000/500?random=2)

## 时间线

| 阶段 | 时间 | 目标 |
|------|------|------|
| Q1 | 1-3月 | 基础架构 |
| Q2 | 4-6月 | 功能完善 |
| Q3 | 7-9月 | 性能优化 |
| Q4 | 10-12月 | 上线推广 |

---

*持续更新中...*`,
    section: 'token_plan',
    status: 'published',
    tags: ['规划', 'Token计划', '年度目标'],
    coverImage: 'https://picsum.photos/1200/600?random=3',
  },
  {
    title: '使用 Claude Code 进行 AI 辅助编程',
    content: `# AI 辅助编程实战

## 为什么选择 AI 辅助

AI 辅助编程可以显著提高开发效率。

### 代码示例

\`\`\`typescript
// 使用 TypeScript 定义接口
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
}

// 异步获取用户
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
\`\`\`

### React 组件示例

\`\`\`tsx
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
\`\`\`

### 效果展示

![AI 编程截图](https://picsum.photos/1000/600?random=4)

## 最佳实践

1. **清晰的提示词** - 描述清楚你的需求
2. **迭代优化** - 逐步完善代码
3. **代码审查** - 始终检查生成的代码

> 提示：AI 是辅助工具，不是替代品。

## 参考资源

- [Claude 文档](https://docs.anthropic.com)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)`,
    section: 'ai_coding',
    status: 'published',
    tags: ['AI编程', 'TypeScript', '教程', 'Claude'],
    coverImage: 'https://picsum.photos/1200/600?random=5',
  },
  {
    title: 'Midjourney AI 绘画作品集',
    content: `# AI 绘画作品展示

## 前言

使用 Midjourney、Stable Diffusion 等 AI 工具创作的艺术作品。

## 作品一：赛博朋克城市

![赛博朋克城市](https://picsum.photos/800/600?random=6)

**提示词**: Cyberpunk city, neon lights, rain, futuristic architecture

## 作品二：梦幻森林

![梦幻森林](https://picsum.photos/800/600?random=7)

**提示词**: Enchanted forest, magical, fireflies, misty

## 作品三：抽象艺术

![抽象艺术](https://picsum.photos/800/600?random=8)

**提示词**: Abstract art, vibrant colors, geometric shapes

## 创作技巧

### 提示词公式

\`\`\`
[主体] + [风格] + [光影] + [细节] + [参数]
\`\`\`

### 常用参数

| 参数 | 作用 | 示例 |
|------|------|------|
| --ar | 宽高比 | --ar 16:9 |
| --v | 版本 | --v 6 |
| --q | 质量 | --q 2 |

---

*持续更新中，敬请期待更多作品！*`,
    section: 'ai_works',
    status: 'published',
    tags: ['AI绘画', 'Midjourney', '作品集', '艺术'],
    coverImage: 'https://picsum.photos/1200/600?random=9',
  },
  {
    title: '全栈开发最佳实践 2026',
    content: `# 全栈开发最佳实践

> 本文总结了 2026 年全栈开发的最佳实践和经验。

## 技术选型

### 前端框架

- **Next.js 15** - React 全栈框架首选
- **Tailwind CSS 4** - 原子化 CSS
- **TanStack Query** - 数据获取和缓存

### 后端技术

- **Node.js** - JavaScript 运行时
- **Express/Fastify** - Web 框架
- **Prisma/Drizzle** - ORM

## 项目结构

\`\`\`
project/
├── apps/
│   ├── web/          # Next.js 前端
│   └── server/       # Express 后端
├── packages/
│   └── shared/       # 共享代码
├── package.json
└── pnpm-workspace.yaml
\`\`\`

## 代码规范

### TypeScript 配置

\`\`\`json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true
  }
}
\`\`\`

## 性能优化

### 图片优化

![性能优化图表](https://picsum.photos/1000/500?random=10)

### 关键指标

| 指标 | 目标 | 说明 |
|------|------|------|
| LCP | < 2.5s | 最大内容绘制 |
| FID | < 100ms | 首次输入延迟 |
| CLS | < 0.1 | 累积布局偏移 |

## 总结

全栈开发需要掌握多种技术，但核心原则不变：

- **简洁** - 代码越少越好
- **可维护** - 易于理解和修改
- **高性能** - 快速响应用户

---

*作者: Token∞ 团队*`,
    section: 'blog',
    status: 'published',
    tags: ['全栈', '最佳实践', 'TypeScript', 'Next.js', '教程'],
    coverImage: 'https://picsum.photos/1200/600?random=11',
  },
]

async function main() {
  console.log('🔐 登录中...')
  const token = await login()

  console.log('\n🗑️  清理旧文章...')
  await deleteAllArticles(token)

  console.log('\n📝 创建新文章...')
  for (const article of articles) {
    const result = await createArticle(token, article)
    if (result.success) {
      console.log(`  ✅ ${article.section}: ${article.title}`)
    } else {
      console.log(`  ❌ ${article.section}: ${result.error}`)
    }
  }

  console.log('\n✨ 完成！')
}

main()
