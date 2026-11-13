// Real app screenshots/checks with isolated backend responses. No live auth writes.
const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { backend } = require("./personalization/backend.cjs");
const { job } = require("./personalization/fixtures.cjs");
const base = process.env.APP_URL || "http://localhost:8810";
const before = process.env.CAPTURE_BEFORE === "true";
const output = process.env.SCREENSHOT_DIR || "/tmp/home-nav-login";
fs.mkdirSync(output, { recursive: true });
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  console.log("PASS " + label);
  checks++;
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    async function setup(width) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        }),
        b = backend(),
        errors = [];
      b.tables.jobs = [1, 2, 3, 4, 5, 6].map((i) => job(i));
      await context.route(
        "**/ehwqqjqtevppsnmxximg.supabase.co/**",
        async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.pathname.includes("/auth/"))
            return route.fulfill({ json: {} });
          const response = await b.fetch(
            "https://isolated.supabase.test" + url.pathname + url.search,
            { method: request.method(), headers: request.headers() },
          );
          return route.fulfill({
            status: response.status,
            body: await response.text(),
            headers: { "content-type": "application/json" },
          });
        },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      return { context, page, errors };
    }
    const widths = before ? [360] : [360, 390, 560, 768];
    for (const width of widths) {
      const { context, page, errors } = await setup(width);
      await page.goto(base);
      await page
        .locator('[data-testid="application-shell"]:not([inert])')
        .waitFor();
      await page.getByText("Opportunity 1", { exact: true }).waitFor();
      const brand = page.getByTestId("brand-wordmark");
      if (!before) {
        check(
          (await brand.innerText()).trim() === "FirstJobly",
          `complete brand at ${width}px`,
        );
        const colours = await brand.evaluate((el) => [
          getComputedStyle(el.querySelector('[data-testid="brand-first"]'))
            .color,
          getComputedStyle(el.querySelector('[data-testid="brand-jobly"]'))
            .color,
        ]);
        check(
          colours[0] === "rgb(225, 34, 95)" && colours[1] === "rgb(6, 26, 48)",
          `canonical brand colours at ${width}px`,
        );
        const b = await brand.boundingBox();
        check(
          b.x >= 0 && b.x + b.width <= width,
          `full wordmark stays in viewport at ${width}px`,
        );
      }
      if (!before) {
        const metrics = await brand.evaluate((el) => {
          const first = el.querySelector('[data-testid="brand-first"]'),
            last = el.querySelector('[data-testid="brand-jobly"]');
          const walker = document.createTreeWalker(last, NodeFilter.SHOW_TEXT);
          let node, final;
          while ((node = walker.nextNode())) final = node;
          const range = document.createRange();
          range.setStart(final, final.length - 1);
          range.setEnd(final, final.length);
          const glyph = range.getBoundingClientRect(),
            outer = el.getBoundingClientRect();
          return {
            y:
              final.textContent.endsWith("y") &&
              glyph.right <= outer.right - 1 &&
              glyph.bottom <= outer.bottom + 1,
            baseline:
              Math.abs(
                first.getBoundingClientRect().y -
                  last.getBoundingClientRect().y,
              ) < 1,
          };
        });
        check(
          metrics.y && metrics.baseline,
          `final y and shared baseline visible at ${width}px`,
        );
        const enlarged = await page.addStyleTag({
          content:
            '[data-testid="brand-wordmark"]{font-size:42px!important;line-height:60px!important}',
        });
        const large = await brand.boundingBox(),
          action = await page
            .getByRole("button", {
              name: "Search jobs or companies",
              exact: true,
            })
            .boundingBox();
        check(
          large.x >= 0 &&
            large.x + large.width <= width &&
            (large.y + large.height <= action.y + 1 ||
              large.x + large.width <= action.x + 1),
          `enlarged wordmark does not squeeze header actions at ${width}px`,
        );
        await enlarged.evaluate((el) => el.remove());
      }
      if (width === 360) {
        await brand
          .locator("..")
          .locator("..")
          .screenshot({ path: output + "/header.png" });
        await page.screenshot({
          path: output + "/tab-bar.png",
          clip: { x: 0, y: 800, width: 360, height: 100 },
        });
      }
      if (!before) {
        const tabs = page.getByRole("tab");
        check(
          (await tabs.count()) === 5,
          `exactly five visible tabs at ${width}px`,
        );
        const expected = ["Home", "Jobs", "Gov jobs", "Saved", "More"];
        check(
          JSON.stringify(
            await tabs.evaluateAll((nodes) =>
              nodes.map((node) => node.getAttribute("aria-label")),
            ),
          ) === JSON.stringify(expected),
          `five-tab order at ${width}px`,
        );
        for (const label of expected) {
          const tab = page.getByRole("tab", { name: label, exact: true });
          const bounds = await tab.boundingBox();
          check(
            bounds.width >= 44 &&
              bounds.height >= 44 &&
              bounds.x >= 0 &&
              bounds.x + bounds.width <= width + 1,
            `${label} usable target at ${width}px`,
          );
        }
        check(await tabs.evaluateAll(nodes=>nodes.every(node=>{const label=node.querySelector('[data-testid="tab-label"]');return label && label.scrollWidth<=label.clientWidth+1 && label.scrollHeight<=label.clientHeight+1 && label.innerText.length>0;})), `complete labels at ${width}px`);

      }
      await page
        .locator("#home-scroll")
        .evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(150);
      const title = page.getByRole("heading", {
          name: "Find your starting point",
          exact: true,
        }),
        header = title.locator(".."),
        cards = before
          ? header.locator("xpath=following-sibling::*[1]")
          : page.getByTestId("home-categories");
      await cards.scrollIntoViewIfNeeded();
      if (!before) {
        const tiles = page.getByTestId("home-category");
        const boxes = await tiles.evaluateAll((nodes) =>
          nodes.map((node) => {
            const r = node.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              right: r.right,
              bottom: r.bottom,
            };
          }),
        );
        check(boxes.length === 4, `all four categories remain at ${width}px`);
        check(
          boxes.every(
            (b) =>
              Math.abs(b.width - boxes[0].width) < 1 &&
              Math.abs(b.height - boxes[0].height) < 1,
          ),
          `equal category sizes at ${width}px`,
        );
        check(
          Math.abs(boxes[1].x - boxes[0].right - 12) < 1 &&
            Math.abs(boxes[2].y - boxes[0].bottom - 12) < 1,
          `even 12px category gaps at ${width}px`,
        );
        check(
          await tiles.evaluateAll((nodes) =>
            nodes.every((node) => {
              const text = node.querySelector('[data-testid="category-label"]');
              return (
                text.scrollWidth <= text.clientWidth + 1 &&
                text.scrollHeight <= text.clientHeight + 1
              );
            }),
          ),
          `category labels not clipped at ${width}px`,
        );
      }
      if (!before && width === 768)
        await page.screenshot({
          path: output + "/tab-bar-wide.png",
          clip: { x: 0, y: 800, width: 768, height: 100 },
        });
      if (width === 360) {
        const a = await header.boundingBox(),
          b = await cards.boundingBox();
        await page.screenshot({
          path: output + "/categories.png",
          clip: {
            x: a.x,
            y: a.y,
            width: a.width,
            height: b.y + b.height - a.y,
          },
        });
      }
      await page.goto(base + "/auth");
      await page
        .locator('[data-testid="application-shell"]:not([inert])')
        .waitFor();
      await page
        .getByRole("button", { name: "Sign in", exact: true })
        .waitFor();
      if (width === 360) await page.screenshot({ path: output + "/login.png" });
      if (!before) {
        for (const mode of ["signin", "signup", "forgot"]) {
          if (mode === "signup")
            await page
              .getByRole("button", { name: "Create account", exact: true })
              .click();
          if (mode === "forgot") {
            await page
              .getByRole("button", { name: "Sign in", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Forgot password?", exact: true })
              .click();
          }
          const wordmark = page.getByTestId("brand-wordmark");
          check(
            (await wordmark.innerText()).trim() === "FirstJobly",
            `${mode} shares complete brand at ${width}px`,
          );
          const colours = await wordmark.evaluate((el) => [
            getComputedStyle(el.querySelector('[data-testid="brand-first"]'))
              .color,
            getComputedStyle(el.querySelector('[data-testid="brand-jobly"]'))
              .color,
          ]);
          check(
            colours[0] === "rgb(225, 34, 95)" &&
              colours[1] === "rgb(6, 26, 48)",
            `${mode} uses canonical brand at ${width}px`,
          );
          const submit = page.getByRole("button", {
            name:
              mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create free account"
                  : "Send reset link",
            exact: true,
          });
          check(
            await submit.evaluate(
              (el) =>
                getComputedStyle(el).backgroundColor === "rgb(225, 34, 95)",
            ),
            `${mode} primary action is pink at ${width}px`,
          );
          if (width === 360 && mode !== "signin")
            await page.screenshot({ path: output + "/" + mode + ".png" });
          const emailField = page.getByPlaceholder("you@example.com");
          const submitText = submit.locator("div").first();
          const oldFieldStyle = await emailField.getAttribute("style"),
            oldLabelStyle = await submitText.getAttribute("style");
          for (const target of [emailField, submitText])
            await target.evaluate((el) => {
              el.style.setProperty("font-size", "26px", "important");
              el.style.setProperty("line-height", "34px", "important");
            });
          const largeField = await emailField.boundingBox(),
            largeButton = await submit.boundingBox();
          check(
            largeField.height >= 60 && largeButton.height >= 58,
            `${mode} inputs and actions grow for enlarged text at ${width}px`,
          );
          await emailField.evaluate(
            (el, style) => el.setAttribute("style", style || ""),
            oldFieldStyle,
          );
          await submitText.evaluate(
            (el, style) => el.setAttribute("style", style || ""),
            oldLabelStyle,
          );
        }
      }
      check(errors.length === 0, `no runtime errors at ${width}px`);
      await context.close();
    }
    console.log(
      before
        ? "Before screenshots captured"
        : `${checks} Home/nav/login browser checks passed; all backend traffic intercepted.`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
