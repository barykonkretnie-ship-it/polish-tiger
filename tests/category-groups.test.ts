import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryGroups} from '../lib/category-groups';

test('Grupy główne łączą warianty tej samej kategorii',()=>{
 assert.deepEqual(categoryGroups('Herbs that Release the Exterior: Warm, Acrid Herbs that Release the Exterior (Wind-Cold Diaphoretics)'),['exterior']);
 assert.deepEqual(categoryGroups('Uwalniające Powierzchnię: chłodne, ostre (napotne przy Wietrze-Gorącu)'),['exterior']);
 assert.deepEqual(categoryGroups('Oczyszczające Gorąco i odprowadzające Ogień: oczyszczające Gorąco i osuszające Wilgoć'),['heat']);
 assert.deepEqual(categoryGroups('Regulujące Krew: hamujące krwawienie (hemostatyczne)'),['bleeding']);
 assert.deepEqual(categoryGroups('Tonizujące Yin'),['tonify']);
});

test('Kategoria złożona trafia do każdej grupy, nieznana do „Inne”',()=>{
 assert.deepEqual(categoryGroups('Usuwające Wilgoć (moczopędne); Oczyszczające Gorąco'),['heat','drain-damp']);
 assert.deepEqual(categoryGroups('Anomalous Herbs'),['other']);
 assert.deepEqual(categoryGroups('Herbs that Warm the Middle'),['warm-interior']);
 assert.deepEqual(categoryGroups('Herbs that Dispel Dampness'),['drain-damp']);
 assert.deepEqual(categoryGroups('Herbs that Clear Heat and Dispel Dampness'),['heat']);
 assert.deepEqual(categoryGroups('Substances for External Application'),['topical']);
 assert.deepEqual(categoryGroups('Herbs that Regulate the Blood: Herbs that Sop Bleeding'),['bleeding']);
 assert.deepEqual(categoryGroups('Herbs that Promote the Movement of Qi'),['qi']);
});
