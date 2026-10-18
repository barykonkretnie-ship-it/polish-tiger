import { records,dictionary,dimensions,products } from '../lib/db';
import Atlas from './ui';
import {authorized,privateAccess} from '../lib/auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){
 if(privateAccess()&&!await authorized())redirect("/login");
 // node:sqlite returns rows with a null prototype; React requires plain objects.
 const data=JSON.parse(JSON.stringify({records:await records(),dictionary:await dictionary(),products:await products()}));
 return <Atlas initialRecords={data.records} dictionary={data.dictionary} initialProducts={data.products} dimensions={dimensions} privateAccess={privateAccess()}/>;
}
