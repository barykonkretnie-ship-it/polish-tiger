import {test} from 'node:test';
import assert from 'node:assert/strict';
import {token,verifyToken,privateAccess,configured,configurationIssues} from '../lib/auth';
test('Podpis sesji, podmiana hasła i wygaśnięcie',()=>{
 const password='isolated-test-only-password',value=token(password);
 assert.equal(verifyToken(value,password),true);assert.equal(verifyToken(value+'bad',password),false);assert.equal(verifyToken(value,'other-password'),false);assert.equal(verifyToken('1.'+value.split('.')[1],password),false);
});
test('Vercel wymusza prywatność i bezpieczną konfigurację',()=>{
 const saved={vercel:process.env.VERCEL,password:process.env.POLISH_TIGER_ADMIN_PASSWORD,secret:process.env.POLISH_TIGER_SESSION_SECRET};
 try{process.env.VERCEL='1';delete process.env.POLISH_TIGER_ADMIN_PASSWORD;delete process.env.POLISH_TIGER_SESSION_SECRET;assert.equal(privateAccess(),true);assert.equal(configured(),false);assert.equal(configurationIssues().length,2);process.env.POLISH_TIGER_ADMIN_PASSWORD='isolated-test-only-password';process.env.POLISH_TIGER_SESSION_SECRET='isolated-test-only-signing-secret-12345';assert.equal(configured(),true);assert.deepEqual(configurationIssues(),[]);process.env.POLISH_TIGER_ADMIN_PASSWORD='short';assert.equal(configured(),false);assert.match(configurationIssues()[0],/16 znaków/);process.env.POLISH_TIGER_ADMIN_PASSWORD='isolated-test-only-password';process.env.POLISH_TIGER_SESSION_SECRET='short';assert.equal(configured(),false);assert.match(configurationIssues()[0],/32 znaki/);}finally{for(const [key,value] of [['VERCEL',saved.vercel],['POLISH_TIGER_ADMIN_PASSWORD',saved.password],['POLISH_TIGER_SESSION_SECRET',saved.secret]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
