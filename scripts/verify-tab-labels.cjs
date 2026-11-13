/* Real navigator layout checks with isolated API responses; no live writes. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { backend } = require("./personalization/backend.cjs");
const { job, jid } = require("./personalization/fixtures.cjs");
const base = process.env.APP_URL || "http://localhost:8840";
const before = process.env.CAPTURE_BEFORE === "true";
const output = process.env.SCREENSHOT_DIR || "/tmp/tab-label-layout";
fs.mkdirSync(output, { recursive: true });
const labels = ["Home", "Jobs", "Gov jobs", "Saved", "More"];
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
  console.log("PASS " + message);
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    async function setup(width, bottom = 0) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      if (bottom)
        await context.addInitScript((bottom) => {
          const original = window.getComputedStyle.bind(window);
          window.getComputedStyle = (element, ...args) => {
            const style = original(element, ...args);
            if (
              element.style?.paddingBottom?.includes(
                "safe-area-inset-bottom",
              ) &&
              element.style?.visibility === "hidden"
            )
              return new Proxy(style, {
                get(target, key) {
                  if (key === "paddingBottom") return bottom + "px";
                  const value = Reflect.get(target, key, target);
                  return typeof value === "function"
                    ? value.bind(target)
                    : value;
                },
              });
            return style;
          };
        }, bottom);
      const b = backend();
      b.tables.jobs = Array.from({ length: 60 }, (_, i) => job(i + 1));
      await context.route(
        "**/ehwqqjqtevppsnmxximg.supabase.co/**",
        async (route) => {
          const req = route.request(),
            url = new URL(req.url());
          if (url.pathname.includes("/auth/"))
            return route.fulfill({ json: {} });
          const response = await b.fetch(
            "https://isolated.supabase.test" + url.pathname + url.search,
            { method: req.method(), headers: req.headers() },
          );
          return route.fulfill({
            status: response.status,
            body: await response.text(),
            headers: { "content-type": "application/json" },
          });
        },
      );
      await context.route("https://firstjobly.co.za/api/**", () => {
        throw Error("Signed-out layout checks must not call protected APIs");
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.setDefaultNavigationTimeout(120000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (
          m.type() === "error" &&
          !m.text().includes("Failed to load resource")
        )
          errors.push(m.text());
      });
      await page.goto(base);
      await page
        .locator('[data-testid="application-shell"]:not([inert])')
        .waitFor();
      await navTab(page, "Home").waitFor();
      return { context, page, errors };
    }
    function nav(page) {
      return page
        .locator('[role="tablist"]')
        .filter({ has: page.getByTestId("tab-label") });
    }
    function navTab(page, label) {
      return nav(page).getByRole("tab", {
        name: label,
        exact: true,
        includeHidden: true,
      });
    }
    async function metrics(page) {
      return nav(page)
        .getByRole("tab", { includeHidden: true })
        .evaluateAll((tabs) =>
          tabs.map((tab) => {
            const label = tab.querySelector('[data-testid="tab-label"]');
            const svg = tab.querySelector("svg");
            const icon = svg.parentElement;
            const slot = icon.parentElement.parentElement;
            const rect = (el) => {
              const r = el.getBoundingClientRect();
              return {
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                right: r.right,
                bottom: r.bottom,
              };
            };
            const range = document.createRange();
            range.selectNodeContents(label);
            return {
              name: tab.getAttribute("aria-label"),
              selected: tab.getAttribute("aria-selected"),
              tab: rect(tab),
              label: rect(label),
              ink: rect(range),
              icon: rect(icon),
              slot: rect(slot),
              text: label.textContent,
              scrollWidth: label.scrollWidth,
              clientWidth: label.clientWidth,
              lineHeight: getComputedStyle(label).lineHeight,
              font: getComputedStyle(label).fontSize,
            };
          }),
        );
    }
    const scenarios = before
      ? [[360, 0]]
      : [
          [320, 0],
          [360, 0],
          [390, 0],
          [360, 34],
        ];
    for (const [width, bottom] of scenarios) {
      const { context, page, errors } = await setup(width, bottom);
      let rows = await metrics(page);
      const key = width + "-" + bottom;
      await page.screenshot({
        path: output + "/" + (before ? "before" : "after") + "-" + key + ".png",
        clip: { x: 0, y: 760, width, height: 140 },
      });
      fs.writeFileSync(
        output + "/" + (before ? "before" : "after") + "-" + key + ".json",
        JSON.stringify(rows, null, 2),
      );
      if (before) {
        console.log(JSON.stringify({ baseline: rows }));
        await context.close();
        continue;
      }
      async function verify(state) {
        const rows = await metrics(page);
        check(JSON.stringify(rows.map(row=>row.name)) === JSON.stringify(labels), "same five destinations " + key + " " + state);
        for (const row of rows) {
          check(
            row.text === row.name,
            "full " + row.name + " " + key + " " + state,
          );
          check(
            row.label.y >= row.icon.bottom - 0.5 &&
              row.ink.y >= row.icon.bottom + 1.5,
            "label below icon " + row.name + " " + key + " " + state,
          );
          check(
            row.icon.y >= row.slot.y - 0.5 &&
              row.icon.bottom <= row.slot.bottom + 0.5,
            "icon fits navigator slot " + row.name + " " + key + " " + state,
          );
          check(
            row.label.x >= row.tab.x &&
              row.label.right <= row.tab.right + 0.5 &&
              row.label.bottom <= row.tab.bottom + 0.5,
            "label inside hit target " + row.name + " " + key + " " + state,
          );
          check(
            row.ink.x >= row.label.x - 0.5 &&
              row.ink.right <= row.label.right + 0.5 &&
              row.scrollWidth <= row.clientWidth + 1,
            "glyphs fit label frame " + row.name + " " + key + " " + state,
          );
          check(
            row.tab.width >= 48 && row.tab.height >= 48,
            "48dp touch target " + row.name + " " + key + " " + state,
          );
          check(
            row.tab.bottom <= 900 - bottom + 0.5,
            "gesture inset respected " + row.name + " " + key + " " + state,
          );
          check(
            parseFloat(row.font) >= 11,
            "font not shrunk " + row.name + " " + key + " " + state,
          );
        }
        for (let i = 0; i < rows.length - 1; i++)
          check(
            rows[i].tab.right <= rows[i + 1].tab.x + 0.5,
            "hit targets do not overlap " + key + " " + state,
          );
        return rows;
      }
      await verify("Home selected");
      for (const [label, path] of [
        ["Jobs", "/jobs"],
        ["Gov jobs", "/circular-jobs"],
        ["Saved", "/saved"],
      ]) {
        await navTab(page, label).click();
        await page.waitForURL(base + path);
        await page.waitForFunction(
          (label) =>
            [...document.querySelectorAll("[role=tab]")]
              .find((n) => n.getAttribute("aria-label") === label)
              ?.getAttribute("aria-selected") === "true",
          label,
        );
        await verify(label + " selected");
      }
      await navTab(page, "More").click();
      await page
        .getByRole("button", { name: "Close More", exact: true })
        .waitFor();
      await verify("More selected behind existing sheet");
      await page
        .getByRole("button", { name: "Close More", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll("[aria-modal=true]")].some(
            (n) => n.getBoundingClientRect().height > 0,
          ),
      );
      await verify("More dismissed");
      check(
        await navTab(page, "Saved").isEnabled(),
        "More releases touches " + key,
      );
      await navTab(page, "Home").click();
      await page.waitForURL(base + "/");
      const historyLength = await page.evaluate(() => history.length);
      await navTab(page, "Home").evaluate((el) => {
        el.click();
        el.click();
      });
      check(
        (await page.evaluate(() => history.length)) === historyLength,
        "reselecting current destination does not duplicate history " + key,
      );
      if (width === 360 && bottom === 0) {
        for (const [label, path] of [
          ["Community", "/community"],
          ["Profile", "/profile"],
        ]) {
          await navTab(page, "More").click();
          await page.getByRole("button", { name: label, exact: true }).click();
          await page.waitForURL(base + path);
          await verify(label + " via existing More");
        }
        await navTab(page, "Jobs").click();
        const input = page.getByRole("textbox").first();
        await input.fill("Opportunity");
        await page.setViewportSize({ width, height: 540 });
        const inputRect = await input.boundingBox();
        const top = (await metrics(page))[0].tab.y;
        check(
          inputRect.y + inputRect.height < top,
          "typing control stays above navigation in reduced viewport",
        );
        await page.setViewportSize({ width, height: 900 });
        // Exercise the real virtualised list through its final footer.
        const heading = page.getByText("Search jobs", { exact: true }).last();
        for (
          let step = 0;
          step < 30 &&
          !(await page
            .getByText("All matching opportunities shown", { exact: true })
            .count());
          step++
        ) {
          await heading.evaluate((el) => {
            let node = el.parentElement;
            while (node) {
              const style = getComputedStyle(node);
              if (
                (style.overflowY === "auto" || style.overflowY === "scroll") &&
                node.scrollHeight > node.clientHeight
              ) {
                node.scrollTop = node.scrollHeight;
                return;
              }
              node = node.parentElement;
            }
          });
          await page.waitForTimeout(100);
        }
        const end = page.getByText("All matching opportunities shown", {
          exact: true,
        });
        await end.scrollIntoViewIfNeeded();
        const endBox = await end.boundingBox();
        const barTop = await nav(page).evaluate(
          (el) => el.parentElement.getBoundingClientRect().top,
        );
        check(
          endBox.y + endBox.height <= barTop,
          "final list footer scrolls fully above navigation",
        );

        // Explicitly emulate enlarged page text. Navigation retains its existing non-scaling 11px policy.
        await page.addStyleTag({
          content:
            "#home-scroll [role=heading] {font-size:36px!important;line-height:48px!important;}",
        });
        await navTab(page, "Home").click();
        await verify("enlarged page text");
        await page.goto(base + "/jobs/" + jid(1));
        await page
          .getByText("Opportunity 1", { exact: true })
          .first()
          .waitFor();
        check(
          (await page.getByRole("tab").count()) === 0,
          "root job detail keeps navigation out of fixed Apply footer",
        );
        const apply = page
          .getByRole("button", { name: /Apply|Sign in to apply/i })
          .last();
        await apply.waitFor();
        const applyBox = await apply.boundingBox();
        check(
          applyBox.y + applyBox.height <= 900,
          "Apply footer remains reachable",
        );
      }
      check(
        errors.length === 0,
        "no runtime errors " + key + ": " + errors.join("; "),
      );
      await context.close();
    }
    console.log(`${checks} navigation layout checks passed`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
