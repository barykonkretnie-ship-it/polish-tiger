import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolInfo} from '../lib/protocols';

test('Receptury według schorzeń: schorzenie, postać i numer',()=>{
 assert.deepEqual(protocolInfo('Acne #3'),{condition:'Acne',conditionPl:'Trądzik',form:null,number:3,label:'Trądzik #3'});
 assert.equal(protocolInfo('Alopecia Topical #2')?.label,'Łysienie (stosowanie zewnętrzne) #2');
 assert.equal(protocolInfo('Acute Laryngitis Gargle')?.label,'Ostre zapalenie krtani (płukanka)');
 assert.equal(protocolInfo('Acute Eczema Compress #1')?.conditionPl,'Ostry wyprysk');
 assert.equal(protocolInfo('Some New Condition #4')?.label,'Some New Condition #4');
});

test('Klasyczne formuły nie są recepturami według schorzeń',()=>{
 for(const name of ['Ma Huang Tang','Ai Fu Nuan Gong Wan','Aloe and Scirpus Formula','Da Huang Mu Dan (Pi) Tang'])assert.equal(protocolInfo(name),null);
});
