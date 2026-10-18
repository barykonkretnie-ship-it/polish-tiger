import { NextRequest,NextResponse } from 'next/server';
import { authorized,privateAccess } from '../../../lib/auth';
import { recordById } from '../../../lib/db';
/** One full record with its source texts; the list page only carries light records. */
export async function GET(req:NextRequest){
 if(privateAccess()&&!await authorized())return NextResponse.json({error:'Wymagane logowanie'},{status:401});
 const id=req.nextUrl.searchParams.get('id');
 const record=id?await recordById(id):null;
 return record?NextResponse.json({record},{headers:{'Cache-Control':'private, no-store'}}):NextResponse.json({error:'Nie znaleziono'},{status:404});
}
