import { loadPublicInformation } from '../_lib/public-information.js';
export async function onRequest({request,env}) {
 if(request.method!=='GET')return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
 return Response.json(await loadPublicInformation(env),{headers:{'Cache-Control':'public, max-age=0, s-maxage=15'}});
}
