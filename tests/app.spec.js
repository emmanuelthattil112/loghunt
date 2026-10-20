const { test, expect } = require('@playwright/test');

const STORE = 'loghunt.v1';

const readState = page => page.evaluate(s => JSON.parse(localStorage.getItem(s) || 'null'), STORE);

async function openPractice(page, index = 0) {
  await page.click('nav [data-view="practice"]');
  await page.locator('.case-item').nth(index).click();
}

test('home offers the daily challenge', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('button.primary').first()).toHaveText("Start today's challenge");
});

test('answering today\'s case records the day and starts a streak', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('button.primary');
  await page.locator('.line').nth(0).click();
  await page.click('button[data-action="submit"]');
  await expect(page.locator('.result')).toBeVisible();
  const state = await readState(page);
  const day = Object.keys(state.daily)[0];
  expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(state.streak).toBe(1);
  expect(state.lastDaily).toBe(day);
});

test('showing a hint lowers the points for a solved case', async ({ page }) => {
  await page.goto('/index.html');
  await openPractice(page, 0);
  await page.click('button[data-action="hint"]');
  await expect(page.locator('.hint')).toBeVisible();
  await page.locator('.line').nth(6).click();
  await page.click('button[data-action="submit"]');
  await expect(page.locator('.result.good')).toBeVisible();
  const state = await readState(page);
  expect(state.points['1']).toBe(75);
});

test('the log search narrows the lines and keeps their numbers', async ({ page }) => {
  await page.goto('/index.html');
  await openPractice(page, 0);
  await expect(page.locator('#log-box .line')).toHaveCount(9);
  await page.fill('[data-lab-search]', 'h.ross');
  await expect(page.locator('#log-box .line')).toHaveCount(2);
  await expect(page.locator('#log-box .line').first().locator('.ln')).toHaveText('7');
  await page.fill('[data-lab-search]', '');
  await expect(page.locator('#log-box .line')).toHaveCount(9);
});

test('the event source filter and timeline work', async ({ page }) => {
  await page.goto('/index.html');
  await openPractice(page, 0);
  await page.selectOption('[data-lab-source]', 'Security 4625');
  await expect(page.locator('#log-box .line')).toHaveCount(6);
  await page.selectOption('[data-lab-source]', '');
  await page.click('button[data-action="toggle-timeline"]');
  await expect(page.locator('.tl-row').first()).toBeVisible();
});

test('a detection rule that misses the turning line is refused, and a good one earns points', async ({ page }) => {
  await page.goto('/index.html');
  await openPractice(page, 0);
  await page.locator('.line').nth(6).click();
  await page.click('button[data-action="submit"]');
  await page.selectOption('[data-detect-source]', 'Security 4625');
  await page.fill('[data-detect-contains]', 'h.ross');
  await page.click('button[data-action="test-detection"]');
  await expect(page.getByText('does not match the turning-point line')).toBeVisible();
  await page.selectOption('[data-detect-source]', 'Security 4624');
  await page.click('button[data-action="test-detection"]');
  await expect(page.getByText('Good rule:')).toBeVisible();
  await page.click('button[data-action="save-detection"]');
  await expect(page.locator('.flash')).toContainText('Detection rule saved');
  const state = await readState(page);
  expect(state.bonus['1']).toBe(true);
});

test('the share card shows the streak and the last 7 days, but not the answers', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('button.primary');
  await page.locator('.line').nth(0).click();
  await page.click('button[data-action="submit"]');
  await page.click('nav [data-view="progress"]');
  const card = await page.locator('.share').innerText();
  expect(card).toContain('LogHunt');
  expect(card).toMatch(/[✅❌]/);
  expect(card).not.toContain('explanation');
  expect(card).not.toContain('turning point');
});

test('generated random cases can be played', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('nav [data-view="practice"]');
  await page.click('button[data-action="new-random"]');
  await expect(page.locator('.eyebrow')).toHaveText('Random case');
  await expect(page.locator('.line').first()).toBeVisible();
  await page.locator('.line').nth(0).click();
  await page.click('button[data-action="submit"]');
  await expect(page.locator('.result')).toBeVisible();
  await expect(page.locator('.tag').first()).toContainText('T');
});

test('a classroom code round-trips and a bad code is refused', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('nav [data-view="classroom"]');
  await page.fill('[data-teacher-name]', 'Week 1');
  await page.check('[data-pick-case="1"]');
  await page.check('[data-pick-case="6"]');
  await page.click('button[data-action="create-code"]');
  const code = await page.locator('input[readonly]').inputValue();
  expect(code.length).toBeGreaterThan(10);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('loghunt.v1'));
    s.assignments = {};
    localStorage.setItem('loghunt.v1', JSON.stringify(s));
  });
  await page.reload();
  await page.click('nav [data-view="classroom"]');
  await page.fill('[data-join-code]', code);
  await page.click('button[data-action="join-code"]');
  await expect(page.getByText('Assignment "Week 1" added.')).toBeVisible();
  await page.fill('[data-join-code]', 'nonsense!!');
  await page.click('button[data-action="join-code"]');
  await expect(page.getByText('That code is not valid')).toBeVisible();
});

test('a worksheet puts the answer key after the questions', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('nav [data-view="classroom"]');
  await page.check('[data-pick-case="1"]');
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('button[data-action="print-picks"]');
  const html = await page.locator('#print-area').innerHTML();
  expect(html.indexOf('Turning point line')).toBeLessThan(html.indexOf('Answer key'));
  expect(html.indexOf('Answer key')).toBeLessThan(html.indexOf('One source IP tried one password'));
});

test('community cases load from the index and appear in practice', async ({ page }) => {
  const community = [{
    id: 'c-test-case',
    title: 'Test community case',
    topic: 'Malware',
    difficulty: 'Easy',
    severity: 'Low',
    scenario: 'A test scenario.',
    lines: [
      '08:00:00 Sysmon 1 Process create. Image: a.exe',
      '08:01:00 Sysmon 1 Process create. Image: b.exe',
      '08:02:00 Sysmon 1 Process create. Image: c.exe',
      '08:03:00 Sysmon 1 Process create. Image: d.exe'
    ],
    answer: 2,
    explanation: 'A test explanation.',
    hint: 'A test hint.',
    attack: 'T1059.001',
    attackName: 'PowerShell',
    walkthrough: ['One.', 'Two.']
  }];
  await page.route('**/community/cases/index.json', route => route.fulfill({ json: community }));
  await page.goto('/index.html');
  await page.click('nav [data-view="practice"]');
  await expect(page.getByText('Test community case')).toBeVisible();
  await page.getByText('Test community case').click();
  await expect(page.locator('.eyebrow')).toHaveText('Community case');
});

test('corrupt saved data does not break the page or the object prototype', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(s => localStorage.setItem(s, '{"__proto__":{"polluted":1},"results":{"1":{"attempts":"x"}},"points":{"1":999}}'), STORE);
  await page.reload();
  await expect(page.locator('button.primary').first()).toBeVisible();
  expect(await page.evaluate(() => ({}).polluted)).toBeUndefined();
  await page.click('nav [data-view="progress"]');
  await expect(page.locator('.stat .num').nth(0)).toHaveText('0');
  await expect(page.locator('.stat .num').nth(1)).toHaveText('0');
});

test('outbound requests are blocked by the page policy', async ({ page }) => {
  await page.goto('/index.html');
  const outcome = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/');
      return 'sent';
    } catch (e) {
      return 'blocked';
    }
  });
  expect(outcome).toBe('blocked');
});

test('a typed note is shown as text and never runs', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await page.goto('/index.html');
  await openPractice(page, 1);
  await page.fill('textarea', '<img src=x onerror="window.__typed=1"><b>hi</b>');
  await page.click('nav [data-view="notes"]');
  await expect(page.locator('.note pre').first()).toContainText('<b>hi</b>');
  expect(await page.evaluate(() => window.__typed)).toBeUndefined();
  expect(dialogs).toEqual([]);
});

test('notes download as a text file', async ({ page }) => {
  await page.goto('/index.html');
  await openPractice(page, 0);
  await page.fill('textarea', 'Watch the 4624 after the 4625s.');
  await page.click('nav [data-view="notes"]');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button[data-action="download-notes"]')
  ]);
  expect(download.suggestedFilename()).toMatch(/^loghunt-notes-\d{4}-\d{2}-\d{2}\.txt$/);
});

test('the app works at phone width without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/index.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await openPractice(page, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the app can be installed and works offline', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('LogHunt');
  expect(manifest.display).toBe('standalone');
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  await page.goto('/index.html');
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(reg && reg.active);
  }, null, { timeout: 15000 });
});
