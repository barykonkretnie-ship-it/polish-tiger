import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
process.env.POLISH_TIGER_DATA_DIR=mkdtempSync(path.join(tmpdir(),'polish-tiger-products-'));
const {products,saveProduct,deleteProduct}=await import('../lib/db-sqlite');
test('Moje produkty: dodanie, edycja z tagami i linkiem, usunięcie',()=>{
 saveProduct({name:'Melisa krople',tags:['sen','stres'],link:'https://example.com/melisa',notes:'Wieczorem'});
 const [p]=products();assert.deepEqual(p.tags,['sen','stres']);assert.equal(p.link,'https://example.com/melisa');
 saveProduct({id:p.id,name:'Melisa krople 50 ml',tags:['sen'],link:'',notes:''});
 assert.equal(products()[0].name,'Melisa krople 50 ml');assert.deepEqual(products()[0].tags,['sen']);
 assert.throws(()=>saveProduct({id:9999,name:'x',tags:[],link:'',notes:''}));
 deleteProduct(p.id);assert.equal(products().length,0);
});
