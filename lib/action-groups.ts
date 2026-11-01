// Formula (and herb) actions come in ~1400 wordings of a few dozen classic TCM principles
// ("Porusza Krew", "Rozbija Zastój Krwi", "Pobudza krążenie Krwi"…), so each action label is mapped
// to the principles it names; a combined action ("Tonizuje Qi i Krew") belongs to every group it names.

export const ACTION_GROUPS:{id:string;label:string;re:RegExp}[]=[
 {id:'heat',label:'Oczyszcza Gorąco i Ogień',re:/gorąc|ogie[ńn]|ognia|chłodzi(?! krew)|ochładza|gorączk|zapal|heat|fire/i},
 {id:'toxins',label:'Usuwa toksyny',re:/toksyn|toksycz|jad|detoks|gnici|gnil|toxi/i},
 {id:'blood-move',label:'Porusza Krew, usuwa Zastój',re:/(porusza|pobudza|ożywia|aktywuje|aktywizuje|harmonizuje|rozbija|rozprasza|usuwa|transformuje|rozpuszcza|rozwiązuje|przełamuje|udrażnia|wzmaga|poprawia).{0,25}(krew|krwi)|zalegając.{0,5}krew|zastój(?! (pokarm|qi|wilgoci|flegm))|zastoj(?! (pokarm|qi))|zakrzep|staz|stasis|invigorat.* blood|move.* blood/i},
 {id:'blood-cool',label:'Chłodzi Krew, hamuje krwawienie',re:/chłodzi krew|krwawien|krwotok|krwiomocz|krew w|bleed/i},
 {id:'blood-tonify',label:'Odżywia i tonizuje Krew',re:/(odżywia|tonizuje|uzupełnia|wzmacnia|wzbogaca|buduje|wytwarza|regeneruje|nawilża|tworzy|produkuje).{0,25}krew|krew i qi|qi i krew|nourish.* blood|tonif.* blood/i},
 {id:'qi-tonify',label:'Tonizuje Qi, wzmacnia Śledzionę',re:/(tonizuje|wzmacnia|wzmaga|uzupełnia|wspiera|odżywia|podnosi|unosi|krzepi|buduje).{0,25}(qi|śledzion|żołąd|środek|środkow)|qi i krew|śledzion|niedob[óo]r|puls|energi|krzepk|tonif.* qi/i},
 {id:'qi-move',label:'Reguluje i porusza Qi, koi Wątrobę',re:/(reguluje|porusza|pobudza|rozprowadza|udrażnia|obniża|sprowadza|kieruje|uwalnia|rozprasza|harmonizuje|przywraca|uruchamia|porządkuje|aktywuje|rozbija|wprawia|tłumi|ujarzmia).{0,25}qi|(krążenie|ruch) qi|qi w krążenie|zastój qi|zalegając.{0,5}qi|bunt|wątrob|klatk|rozpieran|regulat.* qi|move.* qi/i},
 {id:'yin',label:'Odżywia Yin, nawilża Suchość',re:/yin|nawilż|suchoś|płyn|wilgotn|pragnieni|moisten/i},
 {id:'yang',label:'Ogrzewa, tonizuje Yang, rozprasza Zimno',re:/yang|ogrzew|rozgrzew|zimn|warm|cold/i},
 {id:'kidney',label:'Wzmacnia Nerki i Jing',re:/nerk|jing|ming men|kości|lędźw|kolan|kidney/i},
 {id:'damp',label:'Usuwa Wilgoć, moczopędne, obrzęki',re:/wilgo[ćc]|mocz|obrzęk|wod[aęy]|mętn|kamien|kamic|diur|damp|edema|urinat/i},
 {id:'phlegm',label:'Transformuje Flegmę',re:/flegm|śluz|phlegm/i},
 {id:'wind',label:'Rozprasza Wiatr, uwalnia Powierzchnię',re:/wiatr|powierzchni|napotn|poce|pot\b|wind|exterior/i},
 {id:'lung',label:'Płuca, kaszel, oddech',re:/płuc|kaszel|kaszl|oddech|astm|duszno|gardł|głos|odkrztusz|lung|cough/i},
 {id:'shen',label:'Uspokaja Shen, sen',re:/shen|uspokaja (umysł|serce|ducha)|umysł|sen\b|snu|bezsenn|lęk|niepok|nerw|serc|duch|drażliw|calm/i},
 {id:'pain',label:'Łagodzi ból',re:/ból|bol|przeciwbólow|pain/i},
 {id:'masses',label:'Rozprasza guzy i guzki, działa przeciwnowotworowo',re:/nowotwor|guz|rak|komórek|zmiękcza|stwardnie|twardoś|masy|skupi|nagromadz|zgrubie|zbic|zbitk|węzł|torbiel|tumor|cancer|nodul|mass/i},
 {id:'skin',label:'Skóra, ropnie, świąd, rany, włosy',re:/skór|świąd|rop[aęyn]|ropi|ran[ayę]?\b|rany|goj|wrzod|owrzodz|tkank|mięs|grzyb|wysyp|pokrzyw|brodaw|plam|włos|itch|abscess|sore|ulcer/i},
 {id:'gyn',label:'Miesiączki, płodność, ciąża',re:/miesiącz|menstru|owulac|płodn|ciąż|płód|płodu|poron|poród|łono|macic|chong|ren\b|upław|laktac|mleka|pier[sś]|pokarm.{0,10}(matki|kobiet)/i},
 {id:'digest',label:'Trawienie, Żołądek, jelita, pasożyty',re:/trawien|pokarm|żołąd|jelit|stolec|wypróżn|przeczyszcz|zaparc|biegun|wymiot|nudności|apetyt|czkawk|dysfag|czerwonk|dyzenter|środkowy jiao|środek|pęcherzyk|żółc|żółtacz|pasożyt|glist|robak|kwasow|nadbrzusz|brzuch|narządów fu|niedrożn|blokad|digest|stomach|bowel|parasit/i},
 {id:'wind-internal',label:'Gasi Wiatr wewnętrzny, drgawki',re:/gasi|uśmierza wiatr|drgaw|skurcz|spazm|kurcz|tręż|tremor|udar/i},
 {id:'channels',label:'Udrażnia kanały i naczynia Luo',re:/kanał|luo|naczyni|stawy|stawów|kończyn|ścięgn|chodzeni|pleców|zespoł[yu]? bi|channel|collateral/i},
 {id:'astringe',label:'Ściąga, zatrzymuje wycieki',re:/ściąg|zatrzymuje|stabiliz|wzmacnia powierzchni|astring/i},
 {id:'orifices',label:'Otwiera otwory zmysłów, wzrok',re:/otwory|otwiera (otw|zmysł|jam)|\bbudzi|przytomn|wzrok|\boczy\b|\boko\b|\boczu\b|\bnos\b|\bnosa\b|nosow|\buszy\b|słuch|orifice/i},
 {id:'metabolic',label:'Obniża ciśnienie, cukier i tłuszcze',re:/ciśnieni|cholesterol|tłuszcz|lipid|cukr|glikem|otyłoś|pressure/i},
 {id:'immune',label:'Wzmacnia odporność',re:/odpornoś|immun|wei/i},
];
export const OTHER_ACTION_GROUP={id:'other',label:'Inne'};

/** Ids of the action groups an action label names; 'other' when it names none. */
export function actionGroups(label:string):string[]{
 const ids=ACTION_GROUPS.filter(g=>g.re.test(label)).map(g=>g.id);
 return ids.length?ids:[OTHER_ACTION_GROUP.id];
}
export const actionGroupLabel=(id:string)=>ACTION_GROUPS.find(g=>g.id===id)?.label??OTHER_ACTION_GROUP.label;
