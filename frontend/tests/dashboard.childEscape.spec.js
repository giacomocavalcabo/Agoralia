import { test, expect } from '@playwright/test';

function overlaps(a, b) {
  return !(b.x >= a.x + a.width || b.x + b.width <= a.x || b.y >= a.y + a.height || b.y + b.height <= a.y);
}

test.describe('Dashboard Child Escape Detection', () => {
  test('no child escapes its card in demo mode', async ({ page, browserName }) => {
  await page.goto('/dashboard?demo=1');
  // Card selector: usa i div con rounded-2xl border bg-white (Dashboard cards)
  const cards = await page.$$('div.rounded-2xl.border.bg-white, div.rounded-xl.border.bg-white');
  expect(cards.length).toBeGreaterThan(4);

    for (const card of cards) {
      const cardRect = await card.boundingBox();
      expect(cardRect).toBeTruthy();

      const descendants = await card.$$('*');
      for (const el of descendants) {
        const r = await el.boundingBox();
        if (!r) continue;
        // se qualunque discendente eccede i bordi della card, è un escape
        const escapes =
          r.x < cardRect.x - 1 ||
          r.y < cardRect.y - 1 ||
          r.x + r.width > cardRect.x + cardRect.width + 1 ||
          r.y + r.height > cardRect.y + cardRect.height + 1;
        expect(escapes, `child escapes card bounds: ${await el.evaluate(n => n.className)}`).toBeFalsy();
      }
    }
  });

  test('no child escapes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/dashboard?demo=1');
    const cards = await page.$$('[data-card="true"]');
    expect(cards.length).toBeGreaterThan(4);

    for (const card of cards) {
      const cardRect = await card.boundingBox();
      expect(cardRect).toBeTruthy();

      const descendants = await card.$$('*');
      for (const el of descendants) {
        const r = await el.boundingBox();
        if (!r) continue;
        const escapes =
          r.x < cardRect.x - 1 ||
          r.y < cardRect.y - 1 ||
          r.x + r.width > cardRect.x + cardRect.width + 1 ||
          r.y + r.height > cardRect.y + cardRect.height + 1;
        expect(escapes, `child escapes card bounds on mobile: ${await el.evaluate(n => n.className)}`).toBeFalsy();
      }
    }
  });

  test('budget gauge label stays within bounds', async ({ page }) => {
    await page.goto('/dashboard?demo=1');
    const gauge = await page.locator('[data-testid="budget-gauge"]');
    const gaugeRect = await gauge.boundingBox();
    expect(gaugeRect).not.toBeNull();

    const percentageLabel = await gauge.locator('.text-2xl.font-semibold.tabular-nums');
    const labelRect = await percentageLabel.boundingBox();
    expect(labelRect).not.toBeNull();

    // Check if the label is within the gauge bounds (allowing for some padding/margin)
    expect(labelRect.x).toBeGreaterThanOrEqual(gaugeRect.x);
    expect(labelRect.y).toBeGreaterThanOrEqual(gaugeRect.y);
    expect(labelRect.x + labelRect.width).toBeLessThanOrEqual(gaugeRect.x + gaugeRect.width);
    expect(labelRect.y + labelRect.height).toBeLessThanOrEqual(gaugeRect.y + gaugeRect.height);
  });
});
