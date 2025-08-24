import { test, expect } from '@playwright/test';

test.describe('Settings Route', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
    await page.goto('/settings');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="settings-nav"]', { timeout: 10000 });
  });

  test('should display settings navigation without raw i18n keys', async ({ page }) => {
    // Check that navigation is visible
    await expect(page.locator('[data-testid="settings-nav"]')).toBeVisible();
    
    // Verify no raw i18n keys are visible in navigation
    const navText = await page.locator('[data-testid="settings-nav"]').textContent();
    expect(navText).not.toMatch(/\b[a-z]+(\.[a-z0-9_-]+){1,}\b/);
    
    // Check that navigation items have proper text
    await expect(page.locator('text=Account')).toBeVisible();
    await expect(page.locator('text=Workspace')).toBeVisible();
    await expect(page.locator('text=Integrations')).toBeVisible();
  });

  test('should display account settings form without raw i18n keys', async ({ page }) => {
    // Check that account form is visible (default view)
    await expect(page.locator('text=Personal Information')).toBeVisible();
    
    // Verify no raw i18n keys are visible
    const pageText = await page.textContent();
    expect(pageText).not.toMatch(/\b[a-z]+(\.[a-z0-9_-]+){1,}\b/);
    
    // Check form fields have proper labels
    await expect(page.locator('label:has-text("Full Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Email Address")')).toBeVisible();
    await expect(page.locator('label:has-text("Language")')).toBeVisible();
    await expect(page.locator('label:has-text("Timezone")')).toBeVisible();
  });

  test('should validate account form fields', async ({ page }) => {
    // Try to save without filling required fields
    await page.click('button:has-text("Save Changes")');
    
    // Should show validation errors
    await expect(page.locator('text=This field is required')).toBeVisible();
    
    // Fill in required fields
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Try to save again
    await page.click('button:has-text("Save Changes")');
    
    // Should not show validation errors
    await expect(page.locator('text=This field is required')).not.toBeVisible();
  });

  test('should navigate to integrations page', async ({ page }) => {
    // Click on integrations in navigation
    await page.click('text=Integrations');
    
    // Should navigate to integrations page
    await expect(page).toHaveURL('/settings/integrations');
    
    // Check that integrations content is visible
    await expect(page.locator('text=Integrations')).toBeVisible();
    
    // Verify no raw i18n keys are visible
    const pageText = await page.textContent();
    expect(pageText).not.toMatch(/\b[a-z]+(\.[a-z0-9_-]+){1,}\b/);
  });

  test('should display integrations CRM providers', async ({ page }) => {
    // Navigate to integrations
    await page.goto('/settings/integrations');
    
    // Check that CRM providers are visible
    await expect(page.locator('text=HubSpot')).toBeVisible();
    await expect(page.locator('text=Zoho CRM')).toBeVisible();
    await expect(page.locator('text=Odoo')).toBeVisible();
    
    // Check that connect buttons are visible
    await expect(page.locator('button:has-text("Connect")')).toHaveCount(3);
  });

  test('should handle integration connection flow', async ({ page }) => {
    // Navigate to integrations
    await page.goto('/settings/integrations');
    
    // Click connect on HubSpot
    await page.click('text=HubSpot').then(() => page.click('button:has-text("Connect")'));
    
    // Should show loading state
    await expect(page.locator('button:has-text("Connecting...")')).toBeVisible();
    
    // Wait for connection to complete
    await expect(page.locator('button:has-text("Test Connection")')).toBeVisible({ timeout: 5000 });
    
    // Should show success message
    await expect(page.locator('text=Integration Connected')).toBeVisible();
  });

  test('should display field mapping tab', async ({ page }) => {
    // Navigate to integrations
    await page.goto('/settings/integrations');
    
    // Click on field mapping tab
    await page.click('text=Field Mapping');
    
    // Should show field mapping content
    await expect(page.locator('text=Select a CRM Provider')).toBeVisible();
    
    // Verify no raw i18n keys are visible
    const pageText = await page.textContent();
    expect(pageText).not.toMatch(/\b[a-z]+(\.[a-z0-9_-]+){1,}\b/);
  });

  test('should display sync status tab', async ({ page }) => {
    // Navigate to integrations
    await page.goto('/settings/integrations');
    
    // Click on sync status tab
    await page.click('text=Sync Status');
    
    // Should show sync status content
    await expect(page.locator('text=Select a CRM Provider')).toBeVisible();
    
    // Verify no raw i18n keys are visible
    const pageText = await page.textContent();
    expect(pageText).not.toMatch(/\b[a-z]+(\.[a-z0-9_-]+){1,}\b/);
  });

  test('should handle form submission with success', async ({ page }) => {
    // Fill in the form
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Mock successful API response
    await page.route('/api/settings/personal', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Submit form
    await page.click('button:has-text("Save Changes")');
    
    // Should show success message
    await expect(page.locator('text=Personal information updated successfully')).toBeVisible();
  });

  test('should handle form submission with error', async ({ page }) => {
    // Fill in the form
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Mock failed API response
    await page.route('/api/settings/personal', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    // Submit form
    await page.click('button:has-text("Save Changes")');
    
    // Should show error message
    await expect(page.locator('text=Failed to save personal information')).toBeVisible();
  });

  test('should display loading states correctly', async ({ page }) => {
    // Mock slow API response
    await page.route('/api/settings/personal', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Submit form
    await page.click('button:has-text("Save Changes")');
    
    // Should show loading state
    await expect(page.locator('button:has-text("Saving...")')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible({ timeout: 5000 });
  });

  test('should maintain navigation state across page refreshes', async ({ page }) => {
    // Navigate to integrations
    await page.goto('/settings/integrations');
    
    // Refresh the page
    await page.reload();
    
    // Should still be on integrations page
    await expect(page).toHaveURL('/settings/integrations');
    await expect(page.locator('text=Integrations')).toBeVisible();
  });

  test('should handle navigation between settings sections', async ({ page }) => {
    // Start on account settings
    await expect(page.locator('text=Personal Information')).toBeVisible();
    
    // Navigate to integrations
    await page.click('text=Integrations');
    await expect(page.locator('text=Integrations')).toBeVisible();
    
    // Navigate back to account
    await page.click('text=Account');
    await expect(page.locator('text=Personal Information')).toBeVisible();
  });

  test('should display proper page headers', async ({ page }) => {
    // Check main settings header
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    await expect(page.locator('text=Configure your workspace, team, and preferences')).toBeVisible();
    
    // Navigate to integrations
    await page.click('text=Integrations');
    await expect(page.locator('h1:has-text("Integrations")')).toBeVisible();
    await expect(page.locator('text=Connect with third-party services')).toBeVisible();
  });

  test('should handle responsive design correctly', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigation should still be accessible
    await expect(page.locator('[data-testid="settings-nav"]')).toBeVisible();
    
    // Form should be properly laid out
    await expect(page.locator('text=Personal Information')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Should still work properly
    await expect(page.locator('text=Personal Information')).toBeVisible();
  });
});
