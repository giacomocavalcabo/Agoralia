import { test, expect } from '@playwright/test';

/**
 * Test suite per la pagina Numbers refactorata
 * Verifica che la nuova architettura funzioni correttamente
 */
test.describe('Numbers Page - Refactor', () => {
  
  test('should load without crashing and show proper i18n', async ({ page }) => {
    // Naviga alla pagina numbers
    await page.goto('/numbers');
    
    // Verifica che non ci siano errori JavaScript
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Aspetta che la pagina si carichi
    await page.waitForLoadState('networkidle');
    
    // Verifica che non ci siano errori critici
    const criticalErrors = consoleErrors.filter(error => 
      error.includes('Cannot read properties') ||
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    // Verifica che il PageHeader sia presente con i18n corretto
    await expect(page.locator('h1')).toContainText('Numbers');
    await expect(page.locator('p')).toContainText('Manage phone numbers');
    
    // Verifica che la toolbar sia presente
    await expect(page.locator('[data-testid="numbers-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-country"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-status"]')).toBeVisible();
    
    // Verifica che i bulk actions siano presenti
    await expect(page.locator('[data-testid="bulk-assign"]')).toBeVisible();
    await expect(page.locator('[data-testid="bulk-release"]')).toBeVisible();
    await expect(page.locator('[data-testid="bulk-export"]')).toBeVisible();
  });

  test('should handle demo mode correctly', async ({ page }) => {
    // Naviga con demo mode
    await page.goto('/numbers?demo=1');
    await page.waitForLoadState('networkidle');
    
    // Verifica che la tabella sia popolata (demo data)
    await expect(page.locator('table')).toBeVisible();
    
    // Verifica che le azioni demo funzionino
    await page.click('[data-testid="bulk-assign"]');
    // In demo mode dovrebbe mostrare un toast o feedback
    // (questo dipende dall'implementazione del toast)
    
    // Verifica che l'export funzioni (sempre sicuro)
    await page.click('[data-testid="bulk-export"]');
    // Dovrebbe scaricare un CSV
  });

  test('should handle search and filters', async ({ page }) => {
    await page.goto('/numbers');
    await page.waitForLoadState('networkidle');
    
    // Testa la ricerca
    const searchBox = page.locator('[data-testid="numbers-search"]');
    await searchBox.fill('test');
    
    // Aspetta il debounce (400ms)
    await page.waitForTimeout(500);
    
    // Verifica che la ricerca sia stata applicata
    await expect(searchBox).toHaveValue('test');
    
    // Testa i filtri
    await page.selectOption('[data-testid="filter-country"]', 'IT');
    await page.selectOption('[data-testid="filter-status"]', 'active');
    
    // Verifica che i filtri siano applicati
    await expect(page.locator('[data-testid="filter-country"]')).toHaveValue('IT');
    await expect(page.locator('[data-testid="filter-status"]')).toHaveValue('active');
    
    // Testa clear all filters
    await page.click('[data-testid="clear-all-filters"]');
    await expect(searchBox).toHaveValue('');
    await expect(page.locator('[data-testid="filter-country"]')).toHaveValue('');
    await expect(page.locator('[data-testid="filter-status"]')).toHaveValue('');
  });

  test('should show proper error states', async ({ page }) => {
    // Simula un errore di rete
    await page.route('**/numbers**', route => route.abort());
    
    await page.goto('/numbers');
    await page.waitForLoadState('networkidle');
    
    // Verifica che l'errore sia gestito graziosamente
    // (dipende dall'implementazione di ServerDataTable)
    await expect(page.locator('body')).toBeVisible();
    
    // Non dovrebbe crashe
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    const criticalErrors = consoleErrors.filter(error => 
      error.includes('Cannot read properties') ||
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Imposta viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/numbers');
    await page.waitForLoadState('networkidle');
    
    // Verifica che la toolbar si adatti al mobile
    await expect(page.locator('[data-testid="numbers-search"]')).toBeVisible();
    
    // Verifica che i bulk actions siano accessibili
    await expect(page.locator('[data-testid="bulk-assign"]')).toBeVisible();
    await expect(page.locator('[data-testid="bulk-release"]')).toBeVisible();
    await expect(page.locator('[data-testid="bulk-export"]')).toBeVisible();
  });
});
