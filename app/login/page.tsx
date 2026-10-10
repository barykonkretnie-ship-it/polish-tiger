import {authorized,configured,configurationIssues} from '../../lib/auth';
import {redirect} from 'next/navigation';
import Login from './ui';
export const dynamic='force-dynamic';
export default async function LoginPage(){if(await authorized())redirect('/');return <Login configured={configured()} issues={configurationIssues()}/>;}
