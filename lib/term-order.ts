import type {Term} from './types';

// Thermal from coldest to warmest; channels in the order N Pm W Wż S O Jc Śl Ż P Jg, then the rest.
const THERMAL=[/^zimne/,/^lekko zimne/,/^chłodne/,/^lekko chłodne/,/^neutralne/,/^lekko ciepłe/,/^ciepłe/,/^gorące/];
const CHANNEL=[/^nerk/,/^pęcherz moczowy/,/^wątroba/,/^(pęcherzyk|woreczek) żółciowy/,/^serce/,/^osierdzie/,/^jelito cienkie/,/^śledziona/,/^żołądek/,/^płuca/,/^jelito grube/];
const ORDER:Record<string,RegExp[]>={thermal:THERMAL,channel:CHANNEL};

function rank(dimension:string,label:string){
 const rules=ORDER[dimension];
 if(!rules)return 0;
 const i=rules.findIndex(r=>r.test(label.toLowerCase()));
 return i<0?rules.length:i;
}

/** Sorts terms within each dimension: by the fixed order where one exists, otherwise alphabetically. */
export function compareTerms(a:Pick<Term,'dimension'|'label'>,b:Pick<Term,'dimension'|'label'>){
 if(a.dimension!==b.dimension)return a.dimension.localeCompare(b.dimension);
 return rank(a.dimension,a.label)-rank(b.dimension,b.label)||a.label.localeCompare(b.label,'pl');
}
