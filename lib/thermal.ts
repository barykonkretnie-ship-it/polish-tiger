import type {RecordData} from './types';

export type Tone='cold'|'warm'|'neutral';

function toneOf(label:string):Tone|null{
 if(/zimn|chłodn|cold|cool/i.test(label))return 'cold';
 if(/ciepł|gorąc|warm|hot/i.test(label))return 'warm';
 if(/neutraln|neutral/i.test(label))return 'neutral';
 return null;
}

/** Thermal nature of a herb at a glance: the first source temperature (the main one; parenthesised values are secondary), else the atlas tags. */
export function thermalTone(record:RecordData):Tone|null{
 if(record.kind!=='herb')return null;
 const src=(record.source?.pl?.temperature??record.source?.fields.temperature?.value) as unknown;
 const main=Array.isArray(src)?src.map(String).find(v=>!v.startsWith('(')):undefined;
 if(main){const t=toneOf(main);if(t)return t;}
 const tones=new Set(record.terms.filter(t=>t.dimension==='thermal').map(t=>toneOf(t.label)).filter(Boolean));
 return tones.size===1?[...tones][0] as Tone:null;
}
