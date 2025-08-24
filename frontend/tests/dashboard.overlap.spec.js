import { test, expect } from '@playwright/test';

function intersects(a, b) {
  return !(b.x >= a.x + a.width || 
           b.x + b.width <= a.x || 
           b.y >= a.y + a.height || 
           b.y + b.height <= a.y);
}

test.describe('Dashboard Overlap Detection', () => {
  test('dashboard cards do not overlap in demo mode', async ({ page }) => {
    await page.goto('/dashboard?demo=1');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-loaded"]', { timeout: 10000 });
    
    // Find all dashboard card containers
    const cardSelectors = [
      '.col-span-12.md\\:col-span-3', // KPI cards
      '.col-span-12.xl\\:col-span-8', // Histogram
      '.col-span-12.xl\\:col-span-4', // Budget + EventFeed
      '.col-span-12.lg\\:col-span-4', // Funnel, TopAgents, MiniMap, SLA
    ];
    
    const cards = [];
    for (const selector of cardSelectors) {
      const elements = await page.$$(selector);
      cards.push(...elements);
    }
    
    console.log(`Found ${cards.length} dashboard cards`);
    expect(cards.length).toBeGreaterThan(5); // Should have at least 6 cards
    
    // Get bounding boxes for all cards
    const rects = await Promise.all(cards.map(async (card) => {
      const box = await card.boundingBox();
      if (!box) return null;
      return {
        x: Math.round(box.x),
        y: Math.round(box.y), 
        width: Math.round(box.width),
        height: Math.round(box.height)
      };
    }));
    
    const validRects = rects.filter(Boolean);
    console.log('Card positions:', validRects);
    
    // Check for intersections
    const overlaps = [];
    for (let i = 0; i < validRects.length; i++) {
      for (let j = i + 1; j < validRects.length; j++) {
        if (intersects(validRects[i], validRects[j])) {
          overlaps.push({
            card1: i,
            card2: j,
            rect1: validRects[i],
            rect2: validRects[j]
          });
        }
      }
    }
    
    if (overlaps.length > 0) {
      console.error('OVERLAPS DETECTED:', overlaps);
      throw new Error(`Found ${overlaps.length} overlapping card pairs: ${JSON.stringify(overlaps, null, 2)}`);
    }
    
    expect(overlaps).toHaveLength(0);
  });
  
  test('dashboard cards do not overlap on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/dashboard?demo=1');
    
    await page.waitForSelector('[data-testid="dashboard-loaded"]', { timeout: 10000 });
    
    const cards = await page.$$('.col-span-12');
    expect(cards.length).toBeGreaterThan(5);
    
    const rects = await Promise.all(cards.map(async (card) => {
      const box = await card.boundingBox();
      return box ? {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width), 
        height: Math.round(box.height)
      } : null;
    }));
    
    const validRects = rects.filter(Boolean);
    
    // Check for intersections
    for (let i = 0; i < validRects.length; i++) {
      for (let j = i + 1; j < validRects.length; j++) {
        if (intersects(validRects[i], validRects[j])) {
          throw new Error(`Mobile overlap detected between cards ${i} and ${j}: ${JSON.stringify({ rect1: validRects[i], rect2: validRects[j] })}`);
        }
      }
    }
  });
  
  test('budget gauge label is properly positioned', async ({ page }) => {
    await page.goto('/dashboard?demo=1');
    await page.waitForSelector('[data-testid="dashboard-loaded"]', { timeout: 10000 });
    
    // Find budget gauge container
    const budgetGauge = await page.$('[data-testid="budget-gauge"]');
    if (!budgetGauge) {
      console.warn('Budget gauge not found - may need data-testid');
      return;
    }
    
    // Check if percentage label is visible and positioned correctly
    const percentLabel = await budgetGauge.$('text, span, div');
    if (percentLabel) {
      const labelBox = await percentLabel.boundingBox();
      const gaugeBox = await budgetGauge.boundingBox();
      
      if (labelBox && gaugeBox) {
        // Label should be within gauge bounds
        const labelCenterX = labelBox.x + labelBox.width / 2;
        const labelCenterY = labelBox.y + labelBox.height / 2;
        const gaugeCenterX = gaugeBox.x + gaugeBox.width / 2;
        const gaugeCenterY = gaugeBox.y + gaugeBox.height / 2;
        
        // Allow some tolerance for centering
        const xTolerance = 5;
        const yTolerance = 5;
        
        expect(Math.abs(labelCenterX - gaugeCenterX)).toBeLessThan(xTolerance);
        expect(Math.abs(labelCenterY - gaugeCenterY)).toBeLessThan(yTolerance);
      }
    }
  });
});
