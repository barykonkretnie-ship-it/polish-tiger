import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
export default defineConfig({testDir:'./tests/browser',use:{baseURL:'http://127.0.0.1:3001',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']}},workers:1,
 webServer:{command:'npm run start -- --port 3001',url:'http://127.0.0.1:3001',reuseExistingServer:false,env:{POLISH_TIGER_DATA_DIR:mkdtempSync(path.join(tmpdir(),'pt-browser-')),POLISH_TIGER_DATABASE_URL:process.env.POLISH_TIGER_TEST_DATABASE_URL||'',POLISH_TIGER_DATABASE_SSL:'local-test',POLISH_TIGER_PRIVATE_ACCESS:'false',POLISH_TIGER_ADMIN_PASSWORD:'isolated-test-only-password',POLISH_TIGER_SESSION_SECRET:'isolated-test-only-signing-secret-12345'}}});
