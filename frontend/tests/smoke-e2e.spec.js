import { test, expect } from '@playwright/test';

test.describe('Smoke E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  });

  test('Leads - filter and delete functionality', async ({ page }) => {
    // Navigate to Leads
    await page.click('text=Leads');
    await page.waitForSelector('[data-testid="leads-search"]');
    
    // Test search functionality
    await page.fill('[data-testid="leads-search"]', 'test');
    await page.waitForTimeout(500); // Wait for debounce
    
    // Test filter builder
    await page.click('text=Select a field');
    await page.selectOption('select', 'compliance_category');
    await page.selectOption('select:nth-of-type(2)', 'is_not');
    await page.fill('input[placeholder="Value"]', 'blocked');
    await page.click('text=Add');
    
    // Verify filter pill appears
    await expect(page.locator('text=Category • is not • blocked')).toBeVisible();
    
    // Test clear filters
    await page.click('text=Clear');
    await expect(page.locator('text=No filters applied')).toBeVisible();
  });

  test('Campaigns - create campaign with segment', async ({ page }) => {
    // Navigate to Campaigns
    await page.click('text=Campaigns');
    await page.waitForSelector('text=Create campaign');
    
    // Open create dialog
    await page.click('text=Create campaign');
    await page.waitForSelector('text=New Campaign');
    
    // Fill campaign form
    await page.fill('input[placeholder="Enter campaign name"]', 'Test Campaign');
    await page.fill('textarea[placeholder="Enter campaign description"]', 'Test Description');
    
    // Add segment filter
    await page.click('text=Select a field');
    await page.selectOption('select', 'status');
    await page.selectOption('select:nth-of-type(2)', 'in');
    await page.fill('input[placeholder="Value"]', 'new,contacted');
    await page.click('text=Add');
    
    // Create campaign
    await page.click('text=Create campaign');
    
    // Verify success toast and redirect
    await expect(page.locator('text=Campaign created successfully!')).toBeVisible();
    
    // Should be redirected to campaign detail
    await expect(page.url()).toContain('/campaigns/');
  });

  test('Calendar - view events and non-clickable empty cells', async ({ page }) => {
    // Navigate to Calendar
    await page.click('text=Calendar');
    await page.waitForSelector('text=Calendar');
    
    // Verify legend is displayed
    await expect(page.locator('text=Scheduled')).toBeVisible();
    await expect(page.locator('text=Blocked')).toBeVisible();
    await expect(page.locator('text=Budget at risk')).toBeVisible();
    await expect(page.locator('text=Concurrency at risk')).toBeVisible();
    
    // Test that empty cells don't open quick schedule
    const emptyCell = page.locator('[role="gridcell"]').first();
    await emptyCell.click();
    
    // Should not see quick schedule modal
    await expect(page.locator('text=Quick Schedule')).not.toBeVisible();
    
    // Test event view icon (if events exist)
    const eventWithIcon = page.locator('text=👁️').first();
    if (await eventWithIcon.isVisible()) {
      await eventWithIcon.click();
      await expect(page.locator('text=Event Details')).toBeVisible();
    }
  });
});
