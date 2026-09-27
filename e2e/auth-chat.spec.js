import { test, expect } from '@playwright/test';

test('debería desplegar autenticación al intentar chatear sin sesión', async ({ page }) => {
  // Asegurarse de que el servidor está corriendo en 3333
  await page.goto('http://localhost:3333');
  
  // 1. Intentar enviar mensaje sin loguearse
  const input = page.locator('input[placeholder="Escribí un mensaje..."]');
  await input.fill('Mensaje de prueba');
  await input.press('Enter');
  
  // 2. Verificar que se despliega la caja de autenticación (buscamos un elemento del formulario auth)
  const authBox = page.locator('input[placeholder="tu@email.com"]');
  await expect(authBox).toBeVisible();
  
  // 3. Verificar que el mensaje no se envió (la lista de mensajes no debería cambiar o estar vacía)
  // ... lógica adicional ...
});
