const { test, expect } = require('@playwright/test');

const STORE = 'loghunt.v1';

// Opens the main page on the Today screen.
async function openMain(page) {
  await page.goto('/index.html');
}

// Opens the login page from the header person icon.
async function openLogin(page) {
  await page.goto('/index.html');
  await page.click('[data-view="account"]');
}

const readState = page => page.evaluate(s => JSON.parse(localStorage.getItem(s) || 'null'), STORE);

async function openPractice(page, index = 0) {
  await page.click('nav [data-view="practice"]');
  await page.locator('.case-item').nth(index).click();
}

test('home offers the daily challenge', async ({ page }) => {
  await page.goto('/preview/index.html');
  await expect(page.locator('button.primary').first()).toHaveText("Start today's challenge");
});

test('answering today\'s case records the day and starts a streak', async ({ page }) => {
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
  await openPractice(page, 0);
  await page.click('button[data-action="hint"]');
  await expect(page.locator('.hint')).toBeVisible();
  await page.locator('.line').nth(6).click();
  await page.click('button[data-action="submit"]');
  await expect(page.locator('.result.good')).toBeVisible();
  const state = await readState(page);
  expect(state.points['1']).toBe(90);
});

test('the log search narrows the lines and keeps their numbers', async ({ page }) => {
  await page.goto('/preview/index.html');
  await openPractice(page, 0);
  await expect(page.locator('#log-box .line')).toHaveCount(9);
  await page.fill('[data-lab-search]', 'h.ross');
  await expect(page.locator('#log-box .line')).toHaveCount(2);
  await expect(page.locator('#log-box .line').first().locator('.ln')).toHaveText('7');
  await page.fill('[data-lab-search]', '');
  await expect(page.locator('#log-box .line')).toHaveCount(9);
});

test('the event source filter and timeline work', async ({ page }) => {
  await page.goto('/preview/index.html');
  await openPractice(page, 0);
  await page.selectOption('[data-lab-source]', 'Security 4625');
  await expect(page.locator('#log-box .line')).toHaveCount(6);
  await page.selectOption('[data-lab-source]', '');
  await page.click('button[data-action="toggle-timeline"]');
  await expect(page.locator('.tl-row').first()).toBeVisible();
});

test('a detection rule that misses the turning line is refused, and a good one earns points', async ({ page }) => {
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
  await page.click('nav [data-view="practice"]');
  await expect(page.getByText('Test community case')).toBeVisible();
  await page.getByText('Test community case').click();
  await expect(page.locator('.eyebrow')).toHaveText('Community case');
});

test('corrupt saved data does not break the page or the object prototype', async ({ page }) => {
  await page.goto('/preview/index.html');
  await page.evaluate(s => localStorage.setItem(s, '{"__proto__":{"polluted":1},"results":{"1":{"attempts":"x"}},"points":{"1":999}}'), STORE);
  await page.reload();
  await expect(page.locator('button.primary').first()).toBeVisible();
  expect(await page.evaluate(() => ({}).polluted)).toBeUndefined();
  await page.click('nav [data-view="progress"]');
  await expect(page.locator('.stat .num').nth(0)).toHaveText('0');
  await expect(page.locator('.stat .num').nth(1)).toHaveText('0');
});

test('outbound requests are blocked by the page policy', async ({ page }) => {
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
  await openPractice(page, 1);
  await page.fill('textarea', '<img src=x onerror="window.__typed=1"><b>hi</b>');
  await page.click('nav [data-view="notes"]');
  await expect(page.locator('.note pre').first()).toContainText('<b>hi</b>');
  expect(await page.evaluate(() => window.__typed)).toBeUndefined();
  expect(dialogs).toEqual([]);
});

test('notes download as a text file', async ({ page }) => {
  await page.goto('/preview/index.html');
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
  await page.goto('/preview/index.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await openPractice(page, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the main page can be installed and works offline', async ({ page, request }) => {
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

// The login page and accounts.
test('a new visitor lands on the Today screen, not the login page', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('button.primary').first()).toContainText("Start today's challenge");
  await expect(page.getByRole('heading', { name: 'Log in to LogHunt' })).toHaveCount(0);
});

test('the header person icon opens login, and a guest can continue from it', async ({ page }) => {
  await openLogin(page);
  await expect(page.getByRole('heading', { name: 'Log in to LogHunt' })).toBeVisible();
  await page.click('button[data-action="guest"]');
  await expect(page.locator('button.primary').first()).toContainText("Start today's challenge");
});

test('an account can be created, logged out of, and logged back into', async ({ page }) => {
  await openLogin(page);
  await page.click('[data-auth-mode="signup"]');
  await page.fill('input[name="username"]', 'analyst_one');
  await page.fill('input[name="password"]', 'correct horse 1');
  await page.fill('input[name="confirm"]', 'correct horse 1');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.getByText('Account created. Welcome, analyst_one.')).toBeVisible();
  await page.click('[data-view="account"]');
  await expect(page.getByRole('heading', { name: 'Signed in as analyst_one' })).toBeVisible();
  await page.click('button[data-action="logout"]');
  await expect(page.getByRole('heading', { name: 'Log in to LogHunt' })).toBeVisible();
  await page.fill('input[name="username"]', 'analyst_one');
  await page.fill('input[name="password"]', 'not the password');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.locator('[data-auth-error]')).toHaveText('Wrong username or password.');
  await page.fill('input[name="password"]', 'correct horse 1');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.getByText('Welcome back, analyst_one.')).toBeVisible();
});

test('passwords are stored only as a salted hash', async ({ page }) => {
  await openLogin(page);
  await page.click('[data-auth-mode="signup"]');
  await page.fill('input[name="username"]', 'hash_check');
  await page.fill('input[name="password"]', 'secret-passphrase');
  await page.fill('input[name="confirm"]', 'secret-passphrase');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.getByText('Account created. Welcome, hash_check.')).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('loghunt.accounts'));
  expect(stored).not.toContain('secret-passphrase');
  const account = JSON.parse(stored).hash_check;
  expect(account.salt.length).toBeGreaterThan(10);
  expect(account.hash.length).toBeGreaterThan(10);
});

test('each account keeps its own progress', async ({ page }) => {
  await openLogin(page);
  await page.click('[data-auth-mode="signup"]');
  await page.fill('input[name="username"]', 'first_person');
  await page.fill('input[name="password"]', 'password-one');
  await page.fill('input[name="confirm"]', 'password-one');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.getByText('Account created. Welcome, first_person.')).toBeVisible();
  await page.click('nav [data-view="practice"]');
  await page.locator('.case-item').first().click();
  await page.locator('.line').nth(6).click();
  await page.click('button[data-action="submit"]');
  await page.click('nav [data-view="progress"]');
  await expect(page.locator('.stat .num').nth(0)).toHaveText('1');
  await page.click('[data-view="account"]');
  await page.click('button[data-action="logout"]');
  await page.click('[data-auth-mode="signup"]');
  await page.fill('input[name="username"]', 'second_person');
  await page.fill('input[name="password"]', 'password-two');
  await page.fill('input[name="confirm"]', 'password-two');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.getByText('Account created. Welcome, second_person.')).toBeVisible();
  await page.click('nav [data-view="progress"]');
  await expect(page.locator('.stat .num').nth(0)).toHaveText('0');
});

test('sign-up checks the username, password length, and confirmation', async ({ page }) => {
  await openLogin(page);
  await page.click('[data-auth-mode="signup"]');
  await page.fill('input[name="username"]', 'Bad Name!');
  await page.fill('input[name="password"]', 'long enough pw');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.locator('[data-auth-error]')).toContainText('Use 3 to 20');
  await page.fill('input[name="username"]', 'good_name');
  await page.fill('input[name="password"]', 'short');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.locator('[data-auth-error]')).toContainText('at least 8 characters');
  await page.fill('input[name="password"]', 'long enough pw');
  await page.fill('input[name="confirm"]', 'different one');
  await page.click('form[data-form="auth"] button[type="submit"]');
  await expect(page.locator('[data-auth-error]')).toContainText('do not match');
});

// The main page: the four-tab design from the mockups.
test('the main page shows four tabs and the daily challenge', async ({ page }) => {
  await openMain(page);
  await expect(page.locator('nav button')).toHaveText(['Today', 'Practice', 'Friends', 'Progress']);
  await expect(page.locator('button.primary').first()).toContainText("Start today's challenge");
});

test('the main page answer flow still works', async ({ page }) => {
  await openMain(page);
  await page.click('button.primary');
  await page.locator('.line').nth(0).click();
  await page.click('button[data-action="submit"]');
  await expect(page.locator('.result')).toBeVisible();
});

test('a correct theory adds the theory bonus to the points', async ({ page }) => {
  await openMain(page);
  await page.click('nav [data-view="practice"]');
  await page.locator('.case-item').first().click();
  await page.click('[data-theory="Password guessing"]');
  await page.locator('.line').nth(6).click();
  await page.click('button[data-action="submit"]');
  await expect(page.getByText('You earned 110 points.')).toBeVisible();
  const state = await readState(page);
  expect(state.points['1']).toBe(100);
  expect(state.theoryBonus['1']).toBe(true);
});

test('a hint costs 10 points', async ({ page }) => {
  await openMain(page);
  await page.click('nav [data-view="practice"]');
  await page.locator('.case-item').first().click();
  await page.click('button[data-action="hint"]');
  await page.locator('.line').nth(6).click();
  await page.click('button[data-action="submit"]');
  const state = await readState(page);
  expect(state.points['1']).toBe(90);
});

test('the event categories and search narrow the log', async ({ page }) => {
  await openMain(page);
  await page.click('nav [data-view="practice"]');
  await page.locator('.case-item').first().click();
  await page.click('button[data-cat="Logons"]');
  await expect(page.locator('#log-box .line')).toHaveCount(8);
  await page.click('button[data-cat="Other"]');
  await expect(page.locator('#log-box .line')).toHaveCount(1);
  await page.click('button[data-cat="All"]');
  await page.fill('[data-lab-search]', 'h.ross');
  await expect(page.locator('#log-box .line')).toHaveCount(2);
});

test('the timer starts when a case opens', async ({ page }) => {
  await openMain(page);
  await page.click('button.primary');
  await page.waitForTimeout(1200);
  await expect(page.locator('#timer')).not.toHaveText('00:00');
});

test('practice filters narrow the list, and a random case can be generated', async ({ page }) => {
  await openMain(page);
  await page.click('nav [data-view="practice"]');
  await page.selectOption('select[data-filter="severity"]', 'Critical');
  await expect(page.locator('.case-item')).toHaveCount(2);
  await page.click('button[data-action="new-random"]');
  await expect(page.locator('.eyebrow').first()).toContainText('RANDOM CASE');
});

test('a classroom code can be created and a bad code is refused on the Friends page', async ({ page }) => {
  await openMain(page);
  await page.click('nav [data-view="friends"]');
  await page.fill('[data-teacher-name]', 'Week 1');
  await page.check('[data-pick-case="1"]');
  await page.click('button[data-action="create-code"]');
  await expect(page.locator('[data-created-code]')).not.toHaveValue('');
  await page.fill('[data-join-code]', 'nonsense!!');
  await page.click('button[data-action="join-code"]');
  await expect(page.getByText('That code is not valid')).toBeVisible();
});

test('notes can be searched, and reset asks before it clears', async ({ page }) => {
  await openMain(page);
  await page.click('nav [data-view="practice"]');
  await page.locator('.case-item').first().click();
  await page.fill('textarea', 'Password spraying from one IP.');
  await page.click('nav [data-view="progress"]');
  await expect(page.locator('.note')).toHaveCount(1);
  await page.fill('[data-note-search]', 'nothing like this');
  await expect(page.locator('.note')).toHaveCount(0);
  await page.fill('[data-note-search]', '');
  page.once('dialog', d => d.dismiss());
  await page.click('button[data-action="reset"]');
  await expect(page.locator('.note')).toHaveCount(1);
  page.once('dialog', d => d.accept());
  await page.click('button[data-action="reset"]');
  await expect(page.getByText('Progress reset.')).toBeVisible();
  await expect(page.locator('.note')).toHaveCount(0);
});

test('the main page blocks outbound requests', async ({ page }) => {
  await openMain(page);
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

test('the main page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMain(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const tops = await page.locator('nav button').evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().top))).size);
  expect(tops).toBe(1);
});
