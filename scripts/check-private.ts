import {spawn} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const port=3002,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',String(port),'--hostname','127.0.0.1'],{stdio:'ignore',env:{...process.env,VERCEL:'',POLISH_TIGER_DATABASE_URL:process.env.POLISH_TIGER_TEST_DATABASE_URL||'',POLISH_TIGER_DATABASE_SSL:'local-test',POLISH_TIGER_DATA_DIR:mkdtempSync(path.join(tmpdir(),'pt-private-')),POLISH_TIGER_PRIVATE_ACCESS:'true',POLISH_TIGER_ADMIN_PASSWORD:'isolated-private-test-password',POLISH_TIGER_SESSION_SECRET:'isolated-private-test-signing-secret-12345'}});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 let ready=false;
 for(let i=0;i<60;i++){if(child.exitCode!==null)throw Error('Private test server failed');try{const r=await fetch(base);if(r.status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw Error('Private test server did not become ready');
 const response=await fetch(base);const html=await response.text();if(!response.url.endsWith('/login')||html.includes('Si Jun Zi Tang'))throw Error('Private read access failed');
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage();await page.goto(base);await expect(page.getByRole('heading',{name:'Twoja przestrzeń wiedzy'})).toBeVisible();await page.getByLabel('Hasło dostępu').fill('isolated-private-test-password');await page.getByRole('button',{name:'Otwórz atlas'}).click();await expect(page.getByRole('button',{name:'Przeglądaj zioła →'})).toBeVisible();await page.getByRole('button',{name:'Administracja',exact:true}).click();await page.getByRole('button',{name:'Wyloguj',exact:true}).click();await expect(page.getByRole('heading',{name:'Twoja przestrzeń wiedzy'})).toBeVisible();
 console.log('Prywatny odczyt, logowanie i wylogowanie: OK.');
}finally{await browser?.close();child.kill('SIGTERM');}
