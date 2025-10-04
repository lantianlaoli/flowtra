# Rules
1. pnpm as the default packages manager
2. code, document, comments is English. chat with chinese


# Repository Guidelines

本文件为本仓库的贡献者指南，请在提交前通读并遵循以下规范。

## Project Structure & Module Organization
- `app/` Next.js App Router（server/client components、layouts、`middleware.ts` 入口）。
- `components/` 可复用 UI（PascalCase），`contexts/`，`hooks/`（React hooks），`lib/`（服务客户端），`utils/`（纯函数）。
- `public/` 静态资产，`supabase/` 配置；根配置：`next.config.ts`、`tsconfig.json`、`middleware.ts`。
- 环境：先复制 `.env.example` 为 `.env` 后再本地运行。

## Build, Test, and Development Commands
- 默认包管理器：`pnpm`。
- 开发：`pnpm dev`（启动本地开发服务器）。
- 构建：`pnpm build`（Next.js 生产构建）；运行产物：`pnpm start`。
- 质量：`pnpm lint`（ESLint），`pnpm type-check`（TypeScript 类型检查）。
- E2E：`npx playwright test` 运行全部；指定用例：`npx playwright test tests/example.spec.ts`。

## Coding Style & Naming Conventions
- 语言：TypeScript；缩进：2 空格；保持现有 import 风格。
- 命名：组件 PascalCase（如 `components/MyCard.tsx`），Hooks `useX`（如 `hooks/useCredits.ts`），Utils camelCase，Types/Enums PascalCase。
- 路由段使用 kebab-case；TailwindCSS v4 就近书写样式，条件类使用 `clsx`/`tailwind-merge`。
- 提交前请运行：`pnpm lint --fix`。

## Testing Guidelines
- 框架：Playwright（`@playwright/test`）；测试放在 `e2e/` 或 `tests/`，命名 `*.spec.ts`/`*.test.ts`。
- 选择器优先使用稳定的 `data-testid` 而非文本。
- 运行全部：`npx playwright test`；调试：`npx playwright test --ui`。

## Commit & Pull Request Guidelines
- 提交信息遵循 Conventional Commits：`feat:`、`fix:`、`refactor:`、`chore:`、`docs:` 等。
- PR 要求：清晰描述、关联 issues、UI 变更附截图/GIF、注明 env/config 变化。
- 必需通过：`pnpm lint` 与 `pnpm type-check`；保持 PR 聚焦且小。

## Security & Configuration
- 切勿提交任何密钥。使用 `.env`（参考 `.env.example`），典型包含 Clerk 与 Supabase（`NEXT_PUBLIC_*`、服务密钥）。
- 通过 `process.env.*` 访问配置，避免日志中输出敏感信息。

