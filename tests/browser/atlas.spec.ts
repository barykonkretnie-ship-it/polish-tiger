import {test,expect} from '@playwright/test';
test('Nawigacja, wyszukiwanie, karta i powiązanie zwrotne',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Poznaj zioła. Zrozum powiązania.'})).toBeVisible();
 await page.getByRole('button',{name:'Przeglądaj zioła →'}).click();await expect(page.locator('.record-card')).toHaveCount(68);
 await page.getByLabel('Szukaj w ziołach').fill('Panax');await expect(page.locator('.record-card')).toHaveCount(1);await page.getByRole('button',{name:'Ren Shen ↗',exact:true}).click();await expect(page.getByRole('heading',{name:'Ren Shen',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Si Jun Zi Tang →',exact:true}).click();await expect(page.getByRole('heading',{name:'Si Jun Zi Tang',exact:true})).toBeVisible();await page.getByRole('button',{name:'Ren Shen →',exact:true}).click();await expect(page.getByRole('heading',{name:'Ren Shen',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Formuły',exact:true}).click();await page.getByLabel('Szukaj w formułach').fill('');await expect(page.locator('.record-card')).toHaveCount(60);
 await page.getByLabel('Szukaj w formułach').fill('nieistniejacy');await expect(page.getByRole('heading',{name:'Brak dopasowań'})).toBeVisible();
});
test('Filtrowanie, oddzielne wymiary i mobilny układ',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Zioła',exact:true}).click();await page.getByLabel('neutralne',{exact:true}).check();await expect(page.locator('.record-card')).toHaveCount(18);
 await expect(page.getByText('Pasuje: Termika: neutralne',{exact:true})).toHaveCount(18);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('Niezalogowany użytkownik nie może zapisywać',async({request})=>{
 const response=await request.post('/api/admin',{headers:{Origin:'http://127.0.0.1:3001'},data:{action:'record',id:'ren-shen',name:'zmiana',translation:'',notes:'',termIds:[]}});expect(response.status()).toBe(401);
});
test('Logowanie, edycja i odczyt po odświeżeniu',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Administracja',exact:true}).click();await page.getByLabel('Hasło administratora').fill('isolated-test-only-password');await page.getByRole('button',{name:'Zaloguj',exact:true}).click();
 const row=page.locator('.admin-row').filter({hasText:'Ren Shen'});await row.getByRole('button',{name:'Edytuj',exact:true}).click();await page.getByLabel('Polskie tłumaczenie').fill('Żeń-szeń testowy');await page.getByRole('button',{name:'Zapisz rekord'}).click();await expect(page.locator('.overlay')).toHaveCount(0);await page.reload();await page.getByRole('button',{name:'Zioła',exact:true}).click();await page.getByLabel('Szukaj w ziołach').fill('zen szen testowy');await expect(page.locator('.record-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Administracja',exact:true}).click();await page.getByRole('button',{name:'Wyloguj',exact:true}).click();await expect(page.getByRole('button',{name:'Zaloguj',exact:true})).toBeVisible();
});
test('Porównanie pokazuje wybrane rekordy i rozdzielone wymiary',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Zioła',exact:true}).click();await page.locator('.record-card').filter({hasText:'Bai Shao'}).getByLabel('Do porównania').check();await page.locator('.record-card').filter({hasText:'Bai Zhu'}).getByLabel('Do porównania').check();await page.getByRole('button',{name:'Porównaj wybrane (2/3)'}).click();await expect(page.locator('.comparison article')).toHaveCount(2);await expect(page.locator('.comparison').getByRole('heading',{name:'Wzorzec TCM',exact:true})).toHaveCount(2);
});
test('Dodanie terminu w pustym wymiarze',async({page})=>{
 const label='Termin testowy '+Date.now();
 await page.goto('/');await page.getByRole('button',{name:'Administracja',exact:true}).click();await page.getByLabel('Hasło administratora').fill('isolated-test-only-password');await page.getByRole('button',{name:'Zaloguj',exact:true}).click();await page.getByRole('button',{name:'Słowniki',exact:true}).click();await page.locator('.dictionary-grid section').filter({has:page.getByRole('heading',{name:'Narząd',exact:true})}).getByRole('button',{name:'Dodaj termin'}).click();await page.locator('.modal').getByLabel('Nazwa',{exact:true}).fill(label);await page.getByLabel('Synonimy',{exact:true}).fill('synonim testowy');await page.getByRole('button',{name:'Zapisz termin'}).click();await expect(page.locator('.overlay')).toHaveCount(0);await expect(page.getByText(label,{exact:true})).toBeVisible();
});
