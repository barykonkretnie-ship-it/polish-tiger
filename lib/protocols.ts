// Condition protocols from American Dragon ("Acne #1", "Alopecia Topical #2", "Acute Laryngitis Gargle"):
// formulas listed by the condition they treat, kept apart from the classic formulas and grouped by condition.

const FORMS:[RegExp,string][]=[[/\s+topical$/i,'stosowanie zewnętrzne'],[/\s+gargle$/i,'płukanka'],[/\s+compress$/i,'okład'],[/\s+wash$/i,'przemywanie'],[/\s+soak$/i,'moczenie']];

/** Polish names of the conditions; a condition missing here is shown under its English name. */
const CONDITIONS_PL:Record<string,string>={
 'AIDS/HIV':'AIDS/HIV',
 'ALS':'Stwardnienie zanikowe boczne (ALS)',
 'Abdominal Tumor Pain':'Ból przy guzach jamy brzusznej',
 'Acne':'Trądzik',
 'Acute Eczema':'Ostry wyprysk',
 'Acute Kidney Failure':'Ostra niewydolność nerek',
 'Acute Laryngitis':'Ostre zapalenie krtani',
 'Acute Leukemia':'Ostra białaczka',
 'Acute Tonsillitis':'Ostre zapalenie migdałków',
 'Allergic Rhinitis':'Alergiczny nieżyt nosa',
 'Alopecia':'Łysienie',
};

export type Protocol={condition:string;conditionPl:string;form:string|null;number:number|null;label:string};

/** The condition protocol a formula name describes, or null for a classic formula. */
export function protocolInfo(name:string):Protocol|null{
 const m=name.match(/^(.*?)\s*#\s*(\d+)\s*$/);
 let base=(m?m[1]:name).trim(),form:string|null=null;
 for(const [re,pl] of FORMS)if(re.test(base)){form=pl;base=base.replace(re,'').trim();}
 if(!m&&!form)return null;
 const conditionPl=CONDITIONS_PL[base]??base,number=m?Number(m[2]):null;
 return {condition:base,conditionPl,form,number,label:[conditionPl,form&&`(${form})`,number!==null&&`#${number}`].filter(Boolean).join(' ')};
}
