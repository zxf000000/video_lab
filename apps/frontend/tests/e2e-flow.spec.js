import { test, expect } from "@playwright/test";

// ── Homepage ────────────────────────────────────────────────────

test.describe("首页", () => {
  test("显示项目工作台标题和项目列表", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "项目工作台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible();
  });

  test("新建项目按钮打开抽屉", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "+ 新建项目" }).first().click();
    // 抽屉出现：显示步骤标题和抽屉标题
    await expect(page.getByText("基本信息")).toBeVisible();
    await expect(page.getByRole("heading", { name: "新建视频项目" })).toBeVisible();
  });
});

// ── Prompts page ────────────────────────────────────────────────

test.describe("提示词配置页", () => {
  test("加载并显示 7 个 Tab", async ({ page }) => {
    await page.goto("/prompts");
    await expect(page.getByRole("heading", { name: "提示词配置" })).toBeVisible({ timeout: 10000 });

    // 等待数据加载完成（textareas 出现）
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 15000 });

    // 检查所有 Tab 按钮
    await expect(page.getByRole("button", { name: "剧情生成" })).toBeVisible();
    await expect(page.getByRole("button", { name: "拆镜头" })).toBeVisible();
    await expect(page.getByRole("button", { name: "角色提取" })).toBeVisible();
    await expect(page.getByRole("button", { name: "场景提取" })).toBeVisible();
    await expect(page.getByRole("button", { name: "图片生成" })).toBeVisible();
    await expect(page.getByRole("button", { name: "视频生成" })).toBeVisible();
    await expect(page.getByRole("button", { name: "故事改写" })).toBeVisible();
  });

  test("默认 Tab 显示 System Prompt 和 User Prompt", async ({ page }) => {
    await page.goto("/prompts");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 15000 });

    // 剧情生成 tab 默认激活，应有两个 textarea（System + User）
    await expect(page.getByText("System Prompt")).toBeVisible();
    await expect(page.getByText("User Prompt")).toBeVisible();
    const textareas = page.locator("textarea");
    await expect(textareas).toHaveCount(2);
  });

  test("切换 Tab 切换内容", async ({ page }) => {
    await page.goto("/prompts");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 15000 });

    // 点击"图片生成"Tab — 只有 1 个 textarea
    await page.getByRole("button", { name: "图片生成" }).click();
    await expect(page.locator("textarea")).toHaveCount(1);
    await expect(page.getByText("Image Prompt")).toBeVisible();
  });

  test("编辑 prompt 并保存", async ({ page }) => {
    await page.goto("/prompts");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10000 });

    // 编辑第一个 textarea（System Prompt）
    const systemTextarea = page.locator("textarea").first();
    const originalValue = await systemTextarea.inputValue();
    const testSuffix = "\n\n## E2E 测试附加内容";
    await systemTextarea.fill(originalValue + testSuffix);

    // 应显示"已修改"标记
    await expect(page.getByText("已修改")).toBeVisible();

    // 点击保存
    await page.getByRole("button", { name: "保存提示词" }).click();

    // 验证成功消息
    await expect(page.getByText("提示词已保存，即时生效。")).toBeVisible({ timeout: 10000 });

    // 还原：重置为默认再保存
    await page.getByRole("button", { name: "重置为默认" }).click();
    await page.getByRole("button", { name: "保存提示词" }).click();
    await expect(page.getByText("提示词已保存，即时生效。")).toBeVisible({ timeout: 10000 });
  });

  test("可用变量显示正确", async ({ page }) => {
    await page.goto("/prompts");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 15000 });

    // 剧情生成 tab 的可用变量应包含 title, prompt, style 等（在 code 标签中）
    await expect(page.getByText("{title}", { exact: true })).toBeVisible();
    await expect(page.getByText("{prompt}", { exact: true })).toBeVisible();
    await expect(page.getByText("{style}", { exact: true })).toBeVisible();
  });
});

// ── Navigation ──────────────────────────────────────────────────

test.describe("导航", () => {
  test("提示词页返回首页", async ({ page }) => {
    await page.goto("/prompts");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 15000 });

    await page.getByRole("link", { name: "返回" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { name: "项目工作台" })).toBeVisible();
  });
});

// ── Create project via drawer (slow test, last) ─────────────────

test.describe("创建项目抽屉", () => {
  test("三步走完创建项目并跳转详情", async ({ page, request }) => {
    test.setTimeout(30_000); // 异步创建，不再阻塞
    await page.goto("/");

    // 打开抽屉
    await page.getByRole("button", { name: "+ 新建项目" }).first().click();
    await expect(page.getByText("基本信息")).toBeVisible();

    // Step 1: 填写标题和需求
    const titleInput = page.locator("input").first();
    await titleInput.fill("E2E 自动测试项目");

    const promptTextarea = page.locator("textarea");
    await promptTextarea.fill("一个宇航员在火星表面发现神秘信号源，追踪信号穿越红色沙漠");

    // 下一步
    await page.getByRole("button", { name: "下一步" }).click();

    // Step 2: 生成参数（默认值即可）
    await expect(page.getByText("生成参数")).toBeVisible();
    await page.getByRole("button", { name: "下一步" }).click();

    // Step 3: 确认创建
    await expect(page.getByText("确认创建")).toBeVisible();

    // 点击开始生成（异步，立即跳转）
    await page.getByRole("button", { name: "开始生成" }).click();

    // 应立即跳转到项目详情页
    await page.waitForURL(/\/projects\/(\d+)/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "E2E 自动测试项目" }).first()).toBeVisible({ timeout: 10000 });

    // 提取项目 ID，测试完毕后永久删除
    const url = page.url();
    const match = url.match(/\/projects\/(\d+)/);
    if (match) {
      const projectId = match[1];
      await request.delete(`http://127.0.0.1:8000/api/projects/${projectId}/permanent`);
    }
  });
});
