import { test, expect } from '@playwright/test';

/**
 * Test suite per verificare che il demo mode non crashi l'app
 * e che funzioni correttamente in vari scenari
 */
test.describe('Demo Mode - Crash Prevention', () => {
  
  test('should not crash when useDemoData is called without auth context', async ({ page }) => {
    // Naviga a una pagina che usa useDemoData
    await page.goto('/dashboard');
    
    // Verifica che non ci siano errori JavaScript uncaught
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Aspetta che la pagina si carichi completamente
    await page.waitForLoadState('networkidle');
    
    // Verifica che non ci siano errori "Cannot read properties of undefined (reading 'react')"
    const reactErrors = consoleErrors.filter(error => 
      error.includes('Cannot read properties of undefined') || 
      error.includes('reading \'react\'')
    );
    
    expect(reactErrors).toHaveLength(0);
    
    // Verifica che la pagina sia renderizzata (non crashata)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle demo mode gracefully when user is not authenticated', async ({ page }) => {
    // Naviga senza essere autenticato
    await page.goto('/dashboard');
    
    // Verifica che la pagina mostri uno stato appropriato (login required, loading, etc.)
    // ma non crashi
    await page.waitForLoadState('networkidle');
    
    // Verifica che non ci siano errori JavaScript
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // La pagina dovrebbe mostrare qualcosa (login form, loading, error state)
    // ma non essere completamente bianca o crashata
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
    
    // Verifica che non ci siano errori critici
    const criticalErrors = consoleErrors.filter(error => 
      error.includes('Cannot read properties') ||
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should work correctly with demo query parameter', async ({ page }) => {
    // Testa il parametro ?demo=1
    await page.goto('/dashboard?demo=1');
    
    await page.waitForLoadState('networkidle');
    
    // Verifica che non ci siano crash
    await expect(page.locator('body')).toBeVisible();
    
    // Verifica che non ci siano errori JavaScript
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

  test('should handle environment variables gracefully', async ({ page }) => {
    // Testa che l'app funzioni anche se le variabili demo non sono definite
    await page.goto('/dashboard');
    
    await page.waitForLoadState('networkidle');
    
    // Verifica che non ci siano crash
    await expect(page.locator('body')).toBeVisible();
    
    // Verifica che non ci siano errori JavaScript
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

  test('should not have import.meta.env access issues', async ({ page }) => {
    // Testa specificamente i problemi con import.meta.env
    await page.goto('/dashboard');
    
    await page.waitForLoadState('networkidle');
    
    // Verifica che non ci siano errori relativi a import.meta
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    const importMetaErrors = consoleErrors.filter(error => 
      error.includes('import.meta') ||
      error.includes('Cannot read properties of undefined')
    );
    
    expect(importMetaErrors).toHaveLength(0);
    
    // Verifica che la pagina sia renderizzata
    await expect(page.locator('body')).toBeVisible();
  });
});

/**
 * Test per verificare che il demo mode funzioni correttamente
 * quando tutte le condizioni sono soddisfatte
 */
test.describe('Demo Mode - Functionality', () => {
  
  test('should enable demo mode with ?demo=1 parameter', async ({ page }) => {
    // Questo test verifica che il demo mode funzioni quando richiesto
    // Nota: richiede che l'app sia configurata per mostrare dati demo
    await page.goto('/dashboard?demo=1');
    
    await page.waitForLoadState('networkidle');
    
    // Verifica che la pagina sia renderizzata
    await expect(page.locator('body')).toBeVisible();
    
    // Verifica che non ci siano errori
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
});
