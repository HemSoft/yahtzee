async (page) => {
  await page.goto('http://127.0.0.1:5185');
  const actions = page.getByRole('button', { name: /^Score / });
  if (await actions.count() !== 15) throw new Error('Missing category controls');
  if (await page.locator('button[aria-label^="Score "]:not(:disabled)').count() !== 0) throw new Error('Pre-roll actions enabled');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); // Roll
  await page.keyboard.press('Tab'); // Theme toggle
  await page.keyboard.press('Tab'); // Score Ones
  if (await page.locator(':focus').getAttribute('aria-label') !== 'Score Ones') throw new Error('Category not keyboard reachable');
  await page.keyboard.press('Enter');
  if (!(await page.getByRole('button', { name: 'Score Ones', exact: true }).isDisabled())) throw new Error('Scored category still enabled');
  await page.getByRole('button', { name: 'Score Twos', exact: true }).focus();
  await page.keyboard.press('Space');
  if ((await page.getByRole('status').textContent()) !== 'Selections: 2') throw new Error('Keyboard activation did not select exactly once');
  for (const action of await actions.all()) {
    if (await action.isEnabled()) { await action.focus(); await page.keyboard.press('Enter'); }
  }
  if ((await page.getByRole('status').textContent()) !== 'Selections: 15') throw new Error('Could not finish scorecard by keyboard');
  if (await page.locator('button[aria-label^="Score "]:not(:disabled)').count() !== 0) throw new Error('Finished actions enabled');
  return 'PASS: pre-roll disabled, Tab reachability, Enter/Space once, 15 keyboard selections';
}
