import { test, expect } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000";

async function createTestProject(page, title, storyPrompt) {
  const response = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      story_prompt: storyPrompt,
      style: "cinematic",
      aspect_ratio: "16:9",
      target_duration: 30,
    }),
  });
  const data = await response.json();
  return data.project.id;
}

test.describe("首页", () => {
  test("显示页面标题和新建项目表单", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Video Lab")).toBeVisible();
    await expect(page.getByText("新建项目")).toBeVisible();
    await expect(page.getByRole("button", { name: "创建项目并进入详情" })).toBeVisible();
  });

  test("显示项目列表区域", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible();
  });

  test("API 地址展示", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(API_BASE)).toBeVisible();
  });
});

test.describe("创建项目流程", () => {
  test("填写表单并创建项目，跳转到项目详情页", async ({ page }) => {
    await page.goto("/");

    const titleInput = page.locator("input").first();
    await titleInput.fill("Playwright 自动测试项目");

    const storyTextarea = page.locator("textarea");
    await storyTextarea.fill("一个机器人在废墟城市中寻找记忆碎片");

    await page.getByRole("button", { name: "创建项目并进入详情" }).click();
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 });

    await expect(page.locator("h1").getByText("Playwright 自动测试项目")).toBeVisible();
  });
});

test.describe("项目详情页 - Tab 布局", () => {
  test("默认显示步骤指示器和剧本 Tab", async ({ page }) => {
    const pid = await createTestProject(page, "Tab 布局测试", "宇航员在火星发现信号源");
    await page.goto(`/projects/${pid}`);

    // 步骤指示器
    await expect(page.getByRole("button", { name: "剧本" })).toBeVisible();
    await expect(page.getByRole("button", { name: "角色&场景" })).toBeVisible();
    await expect(page.getByRole("button", { name: "分镜板" })).toBeVisible();
    await expect(page.getByRole("button", { name: "时间轴" })).toBeVisible();

    // 默认 Tab 内容：剧本
    await expect(page.getByRole("heading", { name: "剧情段落" })).toBeVisible();
  });

  test("点击 Tab 切换并 URL 参数更新", async ({ page }) => {
    const pid = await createTestProject(page, "Tab 切换测试", "少年在图书馆找到隐藏的门");
    await page.goto(`/projects/${pid}`);

    // 切换到分镜板
    await page.getByRole("button", { name: "分镜板" }).click();
    await expect(page).toHaveURL(new RegExp(`tab=storyboard`));
    await expect(page.getByRole("heading", { name: "分镜板" })).toBeVisible();

    // 切换到时间轴
    await page.getByRole("button", { name: "时间轴" }).click();
    await expect(page).toHaveURL(new RegExp(`tab=timeline`));
    await expect(page.getByRole("heading", { name: "时间轴" })).toBeVisible();

    // 切换到角色&场景
    await page.getByRole("button", { name: "角色&场景" }).click();
    await expect(page).toHaveURL(new RegExp(`tab=characters`));
    await expect(page.getByRole("heading", { name: "角色列表" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "场景列表" })).toBeVisible();
  });

  test("URL 直接访问指定 Tab", async ({ page }) => {
    const pid = await createTestProject(page, "URL Tab 测试", "潜水员在深海发现古代遗迹");
    await page.goto(`/projects/${pid}?tab=timeline`);

    await expect(page.getByRole("heading", { name: "时间轴" })).toBeVisible();
  });

  test("无效 tab 参数回退到剧本", async ({ page }) => {
    const pid = await createTestProject(page, "无效 Tab 测试", "火车穿越雪山隧道");
    await page.goto(`/projects/${pid}?tab=invalid`);

    await expect(page.getByRole("heading", { name: "剧情段落" })).toBeVisible();
  });
});

test.describe("剧本 Tab", () => {
  test("显示剧情内容和操作按钮", async ({ page }) => {
    const pid = await createTestProject(page, "剧本 Tab 测试", "猫咪在屋顶看日落");
    await page.goto(`/projects/${pid}?tab=script`);

    await expect(page.getByRole("heading", { name: "剧情段落" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "项目信息" })).toBeVisible();
    await expect(page.getByRole("button", { name: "重生成剧情" })).toBeVisible();
    await expect(page.getByRole("button", { name: "重拆镜头" })).toBeVisible();
    await expect(page.getByRole("button", { name: "编辑剧情" })).toBeVisible();
  });

  test("显示项目元数据", async ({ page }) => {
    const pid = await createTestProject(page, "元数据测试", "舞者在舞台上表演");
    await page.goto(`/projects/${pid}?tab=script`);

    await expect(page.getByText("状态", { exact: true })).toBeVisible();
    await expect(page.getByText("风格", { exact: true })).toBeVisible();
    await expect(page.getByText("比例", { exact: true })).toBeVisible();
    await expect(page.getByText("目标时长", { exact: true })).toBeVisible();
  });

  test("编辑剧情并保存", async ({ page }) => {
    const pid = await createTestProject(page, "剧情编辑测试", "探险家在丛林中发现古庙");
    await page.goto(`/projects/${pid}?tab=script`);

    await page.getByRole("button", { name: "编辑剧情" }).click();
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("修改后的剧情内容：探险家小心翼翼地推开石门。");
    await page.getByRole("button", { name: "保存剧情" }).click();
    await page.waitForTimeout(1500);
  });

  test("查看剧情版本历史", async ({ page }) => {
    const pid = await createTestProject(page, "版本历史测试", "宇航员在月球基地");
    await page.goto(`/projects/${pid}?tab=script`);

    await page.getByRole("button", { name: "查看版本历史" }).click();
    await page.waitForTimeout(1000);
    // 版本列表应该显示
    await expect(page.getByText("v1")).toBeVisible();
  });
});

test.describe("分镜板 Tab", () => {
  test("显示镜头列表和批量操作按钮", async ({ page }) => {
    const pid = await createTestProject(page, "分镜板测试", "画家在画室创作巨幅油画");
    await page.goto(`/projects/${pid}?tab=storyboard`);

    await expect(page.getByRole("heading", { name: "分镜板", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "一键生成全部首尾帧" })).toBeVisible();
    await expect(page.getByRole("button", { name: "一键生成全部视频" })).toBeVisible();
    await expect(page.getByRole("button", { name: "添加镜头" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "镜头 1" })).toBeVisible();
  });

  test("添加新镜头", async ({ page }) => {
    const pid = await createTestProject(page, "添加镜头测试", "渔夫在暴风雨中航行");
    await page.goto(`/projects/${pid}?tab=storyboard`);

    const initialCount = await page.getByRole("heading", { name: /^镜头 \d+$/ }).count();
    await page.getByRole("button", { name: "添加镜头" }).click();
    await page.waitForTimeout(1500);
    const newCount = await page.getByRole("heading", { name: /^镜头 \d+$/ }).count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test("点击批量生成首尾帧触发任务", async ({ page }) => {
    const pid = await createTestProject(page, "批量首尾帧测试", "飞行员驾驶飞船穿越小行星带");
    await page.goto(`/projects/${pid}?tab=storyboard`);

    await page.getByRole("button", { name: "一键生成全部首尾帧" }).click();
    await page.waitForTimeout(1500);
  });

  test("点击批量生成视频触发任务", async ({ page }) => {
    const pid = await createTestProject(page, "批量视频测试", "渔夫在暴风雨中航行");
    await page.goto(`/projects/${pid}?tab=storyboard`);

    await page.getByRole("button", { name: "一键生成全部视频" }).click();
    await page.waitForTimeout(1500);
  });

  test("镜头卡片显示结构化字段", async ({ page }) => {
    const pid = await createTestProject(page, "结构化字段测试", "舞者在舞台上表演");
    await page.goto(`/projects/${pid}?tab=storyboard`);

    // 应该能看到镜头 Prompt textarea
    await expect(page.locator("textarea").first()).toBeVisible();
    // 应该能看到状态标签
    await expect(page.getByText("planned").first()).toBeVisible();
  });
});

test.describe("角色&场景 Tab", () => {
  test("显示角色和场景列表", async ({ page }) => {
    const pid = await createTestProject(page, "角色场景测试", "机器人照顾花园");
    await page.goto(`/projects/${pid}?tab=characters`);

    await expect(page.getByRole("heading", { name: "角色列表" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "场景列表" })).toBeVisible();
  });

  test("添加角色", async ({ page }) => {
    const pid = await createTestProject(page, "添加角色测试", "猫咪在屋顶看日落");
    await page.goto(`/projects/${pid}?tab=characters`);

    await page.getByRole("button", { name: "添加角色" }).first().click();
    const nameInput = page.locator("input[placeholder='例：主角']");
    await nameInput.fill("测试角色");
    const descInput = page.locator("textarea").first();
    await descInput.fill("黑色长发，戴着眼镜");
    await page.getByRole("button", { name: "创建角色" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("测试角色")).toBeVisible();
  });

  test("添加场景", async ({ page }) => {
    const pid = await createTestProject(page, "添加场景测试", "厨师准备盛宴");
    await page.goto(`/projects/${pid}?tab=characters`);

    // 点击场景区域的添加按钮
    await page.getByRole("button", { name: "添加场景" }).click();
    const nameInput = page.locator("input[placeholder='例：城市夜景']");
    await nameInput.fill("测试场景");
    const descInput = page.locator("textarea").first();
    await descInput.fill("明亮的厨房环境");
    await page.getByRole("button", { name: "创建场景" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("测试场景")).toBeVisible();
  });
});

test.describe("时间轴 Tab", () => {
  test("显示时间条和汇总信息", async ({ page }) => {
    const pid = await createTestProject(page, "时间轴测试", "探险家攀登冰川");
    await page.goto(`/projects/${pid}?tab=timeline`);

    await expect(page.getByRole("heading", { name: "时间轴", exact: true })).toBeVisible();
    await expect(page.getByText("总镜头数")).toBeVisible();
    await expect(page.getByText("实际总时长")).toBeVisible();
    await expect(page.getByText("目标时长")).toBeVisible();
    await expect(page.getByText("镜头 1").first()).toBeVisible();
  });

  test("显示自动拼接区域", async ({ page }) => {
    const pid = await createTestProject(page, "时间轴标识测试", "厨师准备盛宴");
    await page.goto(`/projects/${pid}?tab=timeline`);

    await expect(page.getByRole("heading", { name: "自动拼接 & 导出" })).toBeVisible();
  });
});

test.describe("镜头详情页", () => {
  test("显示镜头信息和 prompt 编辑框", async ({ page }) => {
    const pid = await createTestProject(page, "镜头详情测试", "猫咪在屋顶看日落");
    const detailRes = await fetch(`${API_BASE}/api/projects/${pid}`);
    const detail = await detailRes.json();
    const shotId = detail.project.shots[0].id;

    await page.goto(`/projects/${pid}/shots/${shotId}`);

    await expect(page.getByText("镜头 Prompt")).toBeVisible();
    await expect(page.getByText("首帧")).toBeVisible();
    await expect(page.getByText("尾帧", { exact: true })).toBeVisible();
    await expect(page.getByText("视频结果", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存 Prompt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "生成首尾帧" })).toBeVisible();
    await expect(page.getByRole("button", { name: "生成视频" })).toBeVisible();
  });

  test("编辑 prompt 并保存", async ({ page }) => {
    const pid = await createTestProject(page, "Prompt 编辑测试", "飞行员驾驶飞船穿越小行星带");
    const detailRes = await fetch(`${API_BASE}/api/projects/${pid}`);
    const detail = await detailRes.json();
    const shotId = detail.project.shots[0].id;

    await page.goto(`/projects/${pid}/shots/${shotId}`);

    const promptTextarea = page.locator("textarea");
    await promptTextarea.fill("修改后的镜头描述：飞船急速掠过小行星，光影交错");
    await page.getByRole("button", { name: "保存 Prompt" }).click();
    await expect(page.getByRole("button", { name: "保存 Prompt" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("导航", () => {
  test("从项目详情页返回首页", async ({ page }) => {
    const pid = await createTestProject(page, "导航测试", "火车穿越雪山隧道");
    await page.goto(`/projects/${pid}`);
    await page.getByText("返回项目首页").click();
    await page.waitForURL("/");
    await expect(page.getByText("新建项目")).toBeVisible();
  });

  test("从镜头详情页返回项目详情页", async ({ page }) => {
    const pid = await createTestProject(page, "镜头导航测试", "渔夫在暴风雨中航行");
    const detailRes = await fetch(`${API_BASE}/api/projects/${pid}`);
    const detail = await detailRes.json();
    const shotId = detail.project.shots[0].id;

    await page.goto(`/projects/${pid}/shots/${shotId}`);
    await page.getByText("返回项目详情").click();
    await page.waitForURL(`/projects/${pid}`);
    // 默认回到剧本 Tab
    await expect(page.getByRole("heading", { name: "剧情段落" })).toBeVisible();
  });
});
