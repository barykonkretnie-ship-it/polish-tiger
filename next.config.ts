import type {NextConfig} from 'next';

const nextConfig:NextConfig={
 // The internal import route reads migrations and the pilot scope from disk at run time.
 outputFileTracingIncludes:{'/api/internal/source-import':['./db/migrations/*.sql','./db/pilot-sample.json','./db/translations/*.json']},
};
export default nextConfig;
