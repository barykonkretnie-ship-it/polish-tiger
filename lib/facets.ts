// Grouped filters ("facets"). The source gives free text in every dimension (1400+ patterns, 3000+ indications,
// 26 spellings of temperature…), so each facet maps those labels onto a short, uniform list of groups.
// A label can belong to several groups (a combined pattern "Zastój Qi i Krwi z Gorącem" is Qi stasis, Blood stasis and Heat).
import {CATEGORY_GROUPS,OTHER_GROUP,categoryGroups} from './category-groups';
import {ACTION_GROUPS,OTHER_ACTION_GROUP,actionGroups} from './action-groups';

type Kind='herb'|'formula';
export type Group={id:string;label:string;re?:RegExp};
export type Facet={
 id:string;
 label:Partial<Record<Kind,string>>;
 /** Term dimensions the facet reads, per record kind. */
 dims:Partial<Record<Kind,string[]>>;
 groups:Group[];
 classify:(label:string)=>string[];
 /** Groups keep their listed order (temperature, taste…) instead of being sorted by count. */
 fixed?:boolean;
 open?:Partial<Record<Kind,boolean>>;
 hint?:string;
};
export const OTHER='other';
const other={id:OTHER,label:'Inne'};
const byRe=(groups:Group[],fallback=true)=>(label:string)=>{const ids=groups.filter(g=>g.re?.test(label)).map(g=>g.id);return ids.length||!fallback?ids:[OTHER];};

const THERMAL:Group[]=[{id:'hot',label:'gorące'},{id:'warm',label:'ciepłe'},{id:'neutral',label:'neutralne'},{id:'cool',label:'chłodne'},{id:'cold',label:'zimne'}];
function thermal(label:string){
 const l=label.toLowerCase(),ids:string[]=[];
 if(/gorąc|hot/.test(l))ids.push('hot');
 if(/ciepł|warm/.test(l))ids.push('warm');
 if(/neutraln|neutral/.test(l))ids.push('neutral');
 if(/chłodn|cool|lekko zimn|slightly cold/.test(l))ids.push('cool');
 else if(/zimn|cold/.test(l))ids.push('cold');
 return ids;
}

const TASTE:Group[]=[
 {id:'bitter',label:'gorzki',re:/gorzk|bitter/i},{id:'sweet',label:'słodki',re:/słodk|sweet/i},{id:'acrid',label:'ostry',re:/ostr|acrid|pungent/i},
 {id:'salty',label:'słony',re:/słon|salty/i},{id:'sour',label:'kwaśny',re:/kwaśn|sour/i},{id:'astringent',label:'cierpki (ściągający)',re:/cierpk|ściągaj|astringent/i},
 {id:'bland',label:'mdły',re:/mdł|łagodn|bland/i},{id:'aromatic',label:'aromatyczny',re:/aromat/i},
];

const TOXIC:Group[]=[{id:'slight',label:'lekko toksyczne'},{id:'toxic',label:'toksyczne'},{id:'very',label:'bardzo toksyczne'}];
function toxic(label:string){
 const l=label.toLowerCase();
 if(!/toksyczn|toxic/.test(l)||/nietoksyczn|non-?toxic/.test(l))return [];
 return [/bardzo|very|highly/.test(l)?'very':/lekko|slightly/.test(l)?'slight':'toxic'];
}

// Organs: herb channels, and the organs a formula's patterns and actions name.
const ORGANS:Group[]=[
 {id:'liver',label:'Wątroba',re:/wątrob|liver/i},{id:'gb',label:'Pęcherzyk żółciowy',re:/pęcherzyk|żółciow|gallbladder/i},
 {id:'heart',label:'Serce',re:/serc(?!owo)|heart/i},{id:'pc',label:'Osierdzie',re:/osierd|pericard/i},
 {id:'si',label:'Jelito cienkie',re:/jelit\S* cienk|small intestine/i},{id:'spleen',label:'Śledziona',re:/śledzion|spleen/i},
 {id:'stomach',label:'Żołądek',re:/żołąd|stomach/i},{id:'lung',label:'Płuca',re:/płuc|lung/i},
 {id:'li',label:'Jelito grube',re:/jelit\S* grub|jelit(?!\S* cienk)|large intestine/i},{id:'kidney',label:'Nerki',re:/nerk|nerek|nercz|kidney/i},
 {id:'bladder',label:'Pęcherz moczowy',re:/pęcherz(?!yk)|bladder/i},{id:'sj',label:'Potrójny Ogrzewacz (Jiao)',re:/jiao|ogrzewacz|triple burner|san jiao/i},
 {id:'uterus',label:'Macica (Chong i Ren)',re:/macic|chong|kanał\S* ren|uterus/i},{id:'brain',label:'Mózg i szpik',re:/mózg|szpik|brain|marrow/i},
];

// Patterns: what is wrong (deficiency/stasis of which substance, which pathogen), read per clause of the label.
const PATTERNS:Group[]=[
 {id:'qi-def',label:'Niedobór Qi'},{id:'blood-def',label:'Niedobór Krwi'},{id:'yin-def',label:'Niedobór Yin'},{id:'yang-def',label:'Niedobór Yang'},
 {id:'jing-def',label:'Niedobór Jing (esencji)'},{id:'qi-stag',label:'Zastój Qi'},{id:'blood-stag',label:'Zastój Krwi'},
 {id:'heat',label:'Gorąco i Ogień'},{id:'toxic-heat',label:'Toksyczne Gorąco (toksyny)'},{id:'damp',label:'Wilgoć'},
 {id:'damp-heat',label:'Wilgoć-Gorąco'},{id:'phlegm',label:'Flegma'},{id:'cold',label:'Zimno'},{id:'wind-ext',label:'Wiatr zewnętrzny'},
 {id:'wind-int',label:'Wiatr wewnętrzny'},{id:'dryness',label:'Suchość'},{id:'fluids',label:'Zaleganie Wody i płynów'},
 {id:'food',label:'Zastój Pokarmu'},{id:'parasites',label:'Pasożyty i Gu'},{id:'bi',label:'Zespół Bi (bólowy)'},
 {id:'shen',label:'Zaburzenia Shen'},{id:'stages',label:'Sześć kanałów i Cztery poziomy'},{id:'disharmony',label:'Dysharmonia narządów'},
];
const SUBST:[RegExp,string,string][]=[[/\bqi\b/i,'qi-def','qi-stag'],[/krew|krwi/i,'blood-def','blood-stag'],[/\byin\b/i,'yin-def',''],[/\byang\b/i,'yang-def',''],[/jing|esencj/i,'jing-def','']];
function patterns(label:string){
 const l=label.toLowerCase(),ids=new Set<string>();
 for(const clause of l.split(/\s(?:z|ze|oraz|przy|wraz z|i z|atakując\S*|blokując\S*|uszkadzając\S*|prowadząc\S*|wywołan\S*)\s|[,;()]/)){
  const def=/niedob|niewystarcz|niewydoln|wyczerp|pust[ey]|słabo|załamani|zapadni|opadani|zanik|uszkodzeni|nie kontroluje|deficien|vacuity/.test(clause);
  const stag=/zast[oó]j|zastoj|zalegani|stagnac|blokad|nagromadz|stagnation|stasis/.test(clause);
  for(const [re,d,s] of SUBST)if(re.test(clause)){if(def)ids.add(d);if(stag&&s)ids.add(s);}
  // An organ deficiency that names no substance ("Niedobór Śledziony") is read as Qi deficiency.
  if(def&&!SUBST.some(([re])=>re.test(clause)))ids.add('qi-def');
 }
 const toxicHeat=/toksyczn\S* (wiatr-|wilgoć-)?gorąc|toksyczn\S* ogie|toksyn|toksyczn/.test(l);
 if(toxicHeat)ids.add('toxic-heat');
 if(/wilgo\S*-gorąc|wilgotne gorąco|gorąc\S* i wilgo|wilgo\S* i gorąc|damp-heat/.test(l))ids.add('damp-heat');
 if(/gorąc|ogie|ogni|letni|lata\b|upał|heat|fire/.test(l))ids.add('heat');
 if(/wilgo|damp/.test(l))ids.add('damp');
 if(/flegm|śluz|phlegm/.test(l))ids.add('phlegm');
 if(/zimn|chłod|cold/.test(l))ids.add('cold');
 if(/wiatr|wind/.test(l))ids.add(/wewnętrzn\S* wiatr|wiatr\S* wewnętrzn|wznoszeni|udar|drgaw|drżen|porusz\S* wiatr|wiatr wątroby|internal wind|liver wind/.test(l)?'wind-int':'wind-ext');
 if(/such|dryness/.test(l))ids.add('dryness');
 if(/wod[ayz]|płyn|obrzęk|jin ye|tan yin|yi yin|zhi yin|xuan yin|\blin\b|water|fluid/.test(l))ids.add('fluids');
 if(/pokarm|food/.test(l))ids.add('food');
 if(/pasożyt|robak|glist|\bgu\b|parasit/.test(l))ids.add('parasites');
 if(/\bbi\b|bólow\S* stawów/.test(l))ids.add('bi');
 if(/(?<!ren )shen|niepok\S* (serc|shen)|duch/.test(l))ids.add('shen');
 if(/shao yang|tai yang|yang ming|shao yin|tai yin|jue yin|poziom\S* (wei|qi|ying|xue)|etap\S* (wei|qi|ying|xue)|stadium (wei|qi|ying|xue)/.test(l))ids.add('stages');
 if(/dysharmon|brak komunikacji|nie komunikuj|disharmon/.test(l))ids.add('disharmony');
 return ids.size?[...ids]:[OTHER];
}

// Indications: the area of medicine a disease or complaint belongs to.
const INDICATIONS:Group[]=[
 {id:'onco',label:'Nowotwory',re:/rak|nowotw|guz|białaczk|chłoniak|mięsak|czerniak|szpiczak|przerzut|chemioterap|radioterap|naświetla|cancer|tumou?r|leuk/i},
 {id:'resp',label:'Układ oddechowy',re:/płuc|oskrzel|kasz[le]|astm|duszno|pochp|rozedm|krztu|gruźli|oddech|opłuc|krwioplucie|lung|cough|asthma|bronch|tchawic|łapanie powietrza/i},
 {id:'ent',label:'Ucho, nos, gardło',re:/nos[aoy]?(?!\S)|nosow|zatok|katar|gardł|migdał|krtan|(?<![a-ząćęłńóśźż])ucha|(?<![a-ząćęłńóśźż])uszn|(?<![a-ząćęłńóśźż])uszu|(?<![a-ząćęłńóśźż])ucho|głuch|ménière|meniere|słuch|chrypk|bezgłos|nose|throat|ear|sinus|utrata głosu|połykan/i},
 {id:'cardio',label:'Serce i krążenie',re:/serc|wieńcow|kołatan|arytm|nadciśn|niedociśn|miażdży|naczy|żyl|tętnic|zakrzep|zator|dławic|zawał|krąże|hemoroid|ciśnieni|heart|hypertens|osierd|zapalenie żył/i},
 {id:'digest',label:'Układ pokarmowy',re:/żołąd|jelit|brzuch|biegun|zaparci|wymiot|nudno|niestrawn|apetyt|przełyk|dwunastn|czkawk|zarzucan|refluks|czerwonk|dyzenter|trzustk|odbyt|wrzód|wrzod|wzdęc|pełnoś|rozpieran|kolk|przepuklin|niedrożn|odbijan|nadbrzusz|trawien|stomach|diarrh|constipat|vomit|nausea|crohn|celiaki|uchyłk|otrzewn|wyrostk|zatrucie pokarm|kac(?!\S)|stolc|stolec|dyspeps|odźwiern|zrost/i},
 {id:'liver',label:'Wątroba i drogi żółciowe',re:/wątrob|żółci|żółtaczk|marsko|wodobrzusz|hepat|liver|jaundice/i},
 {id:'urinary',label:'Nerki i drogi moczowe',re:/nerk|moczow|moczu|pęcherz(?!yk)|skąpomocz|kamic\S* (moczow|nerk)|moczeni|nietrzymani|kłębusz|bezmocz|białkomocz|krwiomocz|kidney|urin|nephr|obrzęk|mocznic|nerek|nercz|odmiedniczk|nefropat|chylur/i},
 {id:'gyn',label:'Ginekologia i położnictwo',re:/miesiącz|macic|jajnik|pochw|upław|ciąż|poród|porod|połog|menopauz|przekwit|piers|sutk|laktac|pokarmu u|mlek|endometrio|szyjk|mięśniak|poronien|łożysk|płod(?!n)|menstru|uter|vagin|breast|pregnan|miednic|rzucawk|uderzenia gorąca|bartholin|jajowod|przydatk|ciałka żółtego|lutealn|ginekomast/i},
 {id:'fertility',label:'Płodność i seksualność',re:/niepłodn|impoten|nasien|wytrysk|erekc|libido|popęd|plemnik|zmaz|prostat|krokow|jąder|moszn|infertil|impoten|semen|prostat|polucj|wodniak|andropauz/i},
 {id:'skin',label:'Skóra, włosy i rany',re:/skór|egzem|wyprys|pokrzyw|łuszczyc|trądzik|czyrak|rop[nie]|ropień|owrzodz|brodawk|łysien|włos|świąd|swędz|bielact|półpa|opryszcz|liszaj|grzybic|oparze|ran[ay]?(?!\S)|blizn|odleżyn|róża|karbunk|wysypk|skin|eczema|psoria|acne|derma|rumie|neuroderm|odmroż|zgorzel|siwien|łupież|potówk|cellulitis|tkanki łącznej/i},
 {id:'neuro',label:'Układ nerwowy i głowa',re:/nerw(?!ic)|porażen|paraliż|padaczk|epilep|drgawk|drżen|parkinson|stwardnien|neuropat|migren|głowy|zawrot|drętwien|parestez|udar|mózg|rdzeni|alzheimer|otępien|zapominan|pamię|tik|neural|headache|dizz|stroke|seizure|miasteni|guillain|heinego|afazj|tourette|narkolep|dystoni|apopleks|niedowład|zespół wei|zanikow|zaniku|\(wei\)|wodogłow/i},
 {id:'psych',label:'Psychika i sen',re:/bezsenn|snu|sen(?!\S)|senn|depres|lęk|niepok|nerwic|neurasten|histeri|schizofren|psychoz|mani[aęi]|drażliwoś|adhd|nastr|insomn|anxiet|depress|stres|przygnęb|panik|gula hister|lilii|lunatyz|ziewan|majacz|autyz|emocjon|obsesyj|melanchol/i},
 {id:'musculo',label:'Ból, stawy i mięśnie',re:/staw|reumat|artret|kręgosł|plec|kark|bark|kolan|mięśn|ścięgn|kości|osteopor|dna|fibromial|rwa kulsz|kulsz|lędźw|zwyrodn|zesztywn|sztywn|uraz|złaman|stłucz|skręce|zwichn|krwiak|kończyn|joint|arthr|back pain|muscle|bone|pięt|stóp|stopy|ostrog|spondylo|bolesna blokada|ból całego|ból twarzy|ból jednostr|silny ból|nadgarst|łok|chrząst|szyi|kręcz|kaletk|zespół bi/i},
 {id:'infect',label:'Infekcje i gorączka',re:/zakaż|zakaźn|wirus|bakter|gorącz|grypa|grypy|przeziębi|aids|hiv|malari|odr[ay]|ospa|śwink|różyczk|sepsa|posocz|dur(?!\S)|cholera|borelio|covid|infekc|fever|influenza|cold\b|infection|kandydoz|rzeżącz|rzęsist|lamblio|glist|pasożyt|szkarlat|grzybic|kiła|błonic|świerzb|tężec|trąd|płonic|tęgoryj|owsik|tasiem|schistosom|leptospir|skrofulo|zespół gu/i},
 {id:'metab',label:'Metabolizm i hormony',re:/cukrzyc|tarczyc|otyło|lipid|cholester|hormon|nadnercz|przysadk|metabol|wol[ea](?!\S)|wychudz|chudnię|niedoczyn|nadczyn|diabet|thyroid|obes|hipergli|hipogli|hiperlip|addison|cushing|beri|hashimoto|basedow|moczówk/i},
 {id:'eyes',label:'Oczy',re:/(?<![a-ząćęłńóśźż])oczu|(?<![a-ząćęłńóśźż])oko(?!\S)|(?<![a-ząćęłńóśźż])oczy(?!\S)|(?<![a-ząćęłńóśźż])oczn|wzrok|spojów|zaćm|jaskr|siatków|rogówk|powiek|jęczmień|eye|vision|conjunct|skrzydlik|widzeni|łzawien|ślepot|jaglic/i},
 {id:'mouth',label:'Jama ustna i zęby',re:/jamy ustn|zęb|dziąs|język|afty|aft(?!\S)|ślin|pleśniawk|warg|ust(?!\S)|mouth|tooth|gum/i},
 {id:'blood',label:'Krew, odporność i alergie',re:/niedokrwist|anemi|plamic|krwawien|krwotok|leukopen|trombocyt|płytek|odporn|alerg|toczeń|autoimmun|limfat|węzł|chłon|krwi(?!\S)|bleed|anemia|allerg|immun|twardzin|sjögren|behçet|raynaud/i},
 {id:'general',label:'Ogólne (zmęczenie, poty, osłabienie)',re:/zmęcz|osłabien|wyczerp|pocenie|poty|potliw|starzen|rekonwalesc|niedożyw|fatigue|sweat|weak|zatruc|uzależn|alkohol|wstrząs|śpiączk|zniedołęż|wyniszcz/i},
 {id:'children',label:'Choroby dzieci',re:/dzieci|niemowl|dziecięc|pediatr|child|infant/i},
];

export const FACETS:Facet[]=[
 {id:'group',label:{herb:'Grupa główna'},dims:{herb:['category']},groups:[...CATEGORY_GROUPS,OTHER_GROUP],classify:categoryGroups,open:{herb:true}},
 {id:'thermal5',label:{herb:'Termika'},dims:{herb:['thermal']},groups:THERMAL,classify:thermal,fixed:true,open:{herb:true},hint:'„lekko zimne” liczy się jako chłodne, „lekko ciepłe” jako ciepłe.'},
 {id:'taste5',label:{herb:'Smak'},dims:{herb:['taste']},groups:TASTE,classify:byRe(TASTE,false),fixed:true},
 {id:'chan',label:{herb:'Kanał',formula:'Narząd (z wzorca i działań)'},dims:{herb:['channel'],formula:['pattern','action']},groups:ORGANS,classify:byRe(ORGANS,false),fixed:true},
 {id:'agroup',label:{herb:'Grupa działań',formula:'Kategoria (grupa działań)'},dims:{herb:['action'],formula:['action']},groups:[...ACTION_GROUPS,OTHER_ACTION_GROUP],classify:actionGroups,open:{formula:true},hint:'Podobne działania zebrane w grupy.'},
 {id:'pgroup',label:{formula:'Wzorzec TCM (grupa)'},dims:{formula:['pattern']},groups:[...PATTERNS,other],classify:patterns,open:{formula:true},hint:'Np. „Zastój Qi Wątroby” należy do grupy Zastój Qi, a narząd Wątroba jest w filtrze „Narząd”.'},
 {id:'igroup',label:{formula:'Wskazanie (obszar)'},dims:{formula:['indication']},groups:[...INDICATIONS,other],classify:byRe(INDICATIONS),open:{formula:true}},
 {id:'toxic',label:{herb:'Toksyczność'},dims:{herb:['thermal','contraindication']},groups:TOXIC,classify:toxic,fixed:true},
];
export const FACET_IDS=new Set(FACETS.map(f=>f.id));
const ORDER:Record<Kind,string[]>={herb:['group','thermal5','taste5','chan','agroup','toxic'],formula:['agroup','pgroup','igroup','chan']};
export const facetsFor=(kind:Kind)=>ORDER[kind].map(id=>FACETS.find(f=>f.id===id)!).filter(f=>f.label[kind]);
export function facetLabel(facetId:string,id:string){const f=FACETS.find(x=>x.id===facetId);return f?.groups.find(g=>g.id===id)?.label??(id===OTHER?'Inne':id);}

/** Facet values of one record, from its terms. */
export function facetValues(kind:Kind,terms:{dimension:string;label:string}[]){
 const out:Record<string,string[]>={};
 for(const f of FACETS){
  const dims=f.dims[kind];if(!dims)continue;
  const labels=terms.filter(t=>dims.includes(t.dimension)).map(t=>t.label);
  if(!labels.length)continue;
  let ids=[...new Set(labels.flatMap(f.classify))];
  if(ids.length>1)ids=ids.filter(i=>i!==OTHER&&i!==OTHER_GROUP.id&&i!==OTHER_ACTION_GROUP.id).concat([]);
  if(ids.length)out[f.id]=ids;
 }
 return out;
}
