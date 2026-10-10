// Importer settings (document section 10). Every value must be set explicitly; none is a hidden default.
export type ImportConfig={
 databaseUrl:string; sourceBaseUrl:string; maxPages:number; concurrency:1; delaySeconds:number; maxRetries:number;
 allowFullImport:boolean; sourceRightsConfirmed:boolean; retention:'raw_html'|'excerpts_only'; userAgent:string;
 aiTranslationEnabled:false; aiMaxRecordsPerRun:number; aiMaxSpendEur:number;
};

const REQUIRED=['IMPORT_DATABASE_URL','SOURCE_BASE_URL','IMPORT_MAX_PAGES','IMPORT_CONCURRENCY','IMPORT_DELAY_SECONDS','IMPORT_MAX_RETRIES',
 'IMPORT_ALLOW_FULL_IMPORT','IMPORT_SOURCE_RIGHTS_CONFIRMED','IMPORT_RETENTION','IMPORT_USER_AGENT','AI_TRANSLATION_ENABLED','AI_MAX_RECORDS_PER_RUN','AI_MAX_SPEND_EUR'] as const;

export class ConfigError extends Error{}

export function loadConfig(env:Record<string,string|undefined>=process.env):ImportConfig{
 const missing=REQUIRED.filter(k=>env[k]===undefined||env[k]==='');
 if(missing.length)throw new ConfigError(`Brak jawnych ustawień importera: ${missing.join(', ')}. Wzór: .env.import.example`);
 const int=(k:string,min:number,max:number)=>{const v=Number(env[k]);if(!Number.isInteger(v)||v<min||v>max)throw new ConfigError(`${k} musi być liczbą całkowitą ${min}–${max}.`);return v;};
 const num=(k:string,min:number,max:number)=>{const v=Number(env[k]);if(!Number.isFinite(v)||v<min||v>max)throw new ConfigError(`${k} musi być liczbą ${min}–${max}.`);return v;};
 const bool=(k:string)=>{const v=env[k];if(v!=='true'&&v!=='false')throw new ConfigError(`${k} musi mieć wartość true albo false.`);return v==='true';};
 const base=new URL(env.SOURCE_BASE_URL!);
 if(base.protocol!=='https:')throw new ConfigError('SOURCE_BASE_URL musi używać https.');
 const concurrency=int('IMPORT_CONCURRENCY',1,1) as 1;// Sequential only: the document forbids aggressive parallel crawling.
 const retention=env.IMPORT_RETENTION;
 if(retention!=='raw_html'&&retention!=='excerpts_only')throw new ConfigError('IMPORT_RETENTION musi mieć wartość raw_html albo excerpts_only.');
 if(bool('AI_TRANSLATION_ENABLED'))throw new ConfigError('Tłumaczenie AI nie jest jeszcze wdrożone ani zatwierdzone; AI_TRANSLATION_ENABLED musi być false.');
 return {
  databaseUrl:env.IMPORT_DATABASE_URL!,sourceBaseUrl:base.origin,maxPages:int('IMPORT_MAX_PAGES',1,100000),concurrency,
  delaySeconds:num('IMPORT_DELAY_SECONDS',1,600),maxRetries:int('IMPORT_MAX_RETRIES',0,10),allowFullImport:bool('IMPORT_ALLOW_FULL_IMPORT'),
  sourceRightsConfirmed:bool('IMPORT_SOURCE_RIGHTS_CONFIRMED'),retention,userAgent:env.IMPORT_USER_AGENT!,
  aiTranslationEnabled:false,aiMaxRecordsPerRun:int('AI_MAX_RECORDS_PER_RUN',0,0),aiMaxSpendEur:num('AI_MAX_SPEND_EUR',0,0),
 };
}

/** Config as stored with a run: everything except credentials. */
export function publicConfig(c:ImportConfig){const {databaseUrl:_,...rest}=c;return rest;}
