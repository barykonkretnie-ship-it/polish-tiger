// Main herb groups: the source has ~120 spellings of about 20 classic materia medica chapters
// ("Herbs that Release the Exterior: Warm, Acrid…"), so each category label is mapped to the chapters it names.
// Labels come in English (source) or Polish (translated); a combined label belongs to every group it names.

export const CATEGORY_GROUPS:{id:string;label:string;re:RegExp}[]=[
 {id:'exterior',label:'Uwalniające Powierzchnię',re:/release the exterior|uwalniające powierzchnię/i},
 {id:'heat',label:'Oczyszczające Gorąco',re:/clea[rn] (wind-damp-)?heat|oczyszczające (wiatr-wilgoć-)?gorąco/i},
 {id:'downward',label:'Przeczyszczające (odprowadzające w dół)',re:/drain(ing)? downward|downward[- ]draining|odprowadzające w dół/i},
 {id:'wind-damp',label:'Usuwające Wiatr-Wilgoć',re:/wind[- ]damp|wind and dampness|wiatr-wilgoć|wiatr i wilgoć/i},
 {id:'aromatic-damp',label:'Aromatyczne transformujące Wilgoć',re:/aromatic (herbs|substances)? ?(that )?transform damp|aromatyczne (zioła )?(transformujące|rozpraszające) wilgoć|transformujące wilgoć \(aromatyczne/i},
 {id:'drain-damp',label:'Usuwające Wilgoć (moczopędne)',re:/drain dampness|diuretic|moczopędne/i},
 {id:'warm-interior',label:'Ogrzewające Wnętrze',re:/warm the interior|ogrzewające wnętrze/i},
 {id:'qi',label:'Regulujące Qi',re:/regulate qi|circulation of qi|regulujące qi|krążenie qi/i},
 {id:'food',label:'Usuwające Zastój Pokarmu',re:/food stagnation|promote digestion|digestives|zastój pokarmu|wspomagające trawienie/i},
 {id:'parasites',label:'Wydalające pasożyty',re:/parasites|pasożyty/i},
 {id:'bleeding',label:'Hamujące krwawienie',re:/stop bleeding|hamujące krwawienie/i},
 {id:'blood',label:'Poruszające Krew',re:/(invigorate|activate) (the )?blood|blood stasis|poruszające krew|zastój krwi/i},
 {id:'phlegm',label:'Transformujące Flegmę i hamujące kaszel',re:/phlegm|flegm/i},
 {id:'shen',label:'Uspokajające Shen',re:/calm the spirit|uspokajające shen/i},
 {id:'wind',label:'Wygaszające Wiatr',re:/extinguish wind|wygaszające wiatr/i},
 {id:'orifices',label:'Otwierające Otwory',re:/open the orifices|otwierające otwory/i},
 {id:'tonify',label:'Tonizujące (Qi, Krew, Yang, Yin)',re:/tonif|tonic|tonizujące|odżywiające krew/i},
 {id:'astringent',label:'Ściągające',re:/stabilize and bind|astringent|ściągające/i},
 {id:'topical',label:'Do stosowania zewnętrznego',re:/topical|stosowania (miejscowego|zewnętrznego)/i},
];
export const OTHER_GROUP={id:'other',label:'Inne'};

/** Ids of the main groups a category label names; 'other' when it names none (anomalous, folk, moisten dryness…). */
export function categoryGroups(label:string):string[]{
 const ids=CATEGORY_GROUPS.filter(g=>g.re.test(label)).map(g=>g.id);
 return ids.length?ids:[OTHER_GROUP.id];
}
export const groupLabel=(id:string)=>CATEGORY_GROUPS.find(g=>g.id===id)?.label??OTHER_GROUP.label;
