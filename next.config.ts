import type {NextConfig} from 'next';

const nextConfig:NextConfig={
 // The internal import route reads migrations, the pilot scope and approved batches from disk at run time.
 outputFileTracingIncludes:{'/api/internal/source-import':['./db/migrations/*.sql','./db/pilot-sample.json','./db/batches/*.json','./db/translations/*.json']},
};
export default nextConfig;
