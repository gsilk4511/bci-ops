export const testPermissionsView=()=>typeof window!=='undefined'&&window.location?.pathname==='/permission-preview';

// Add an explicit test marker to every application fetch from the test document.
// A stale test tab must never issue an ordinary write after Test Mode was exited.
if(testPermissionsView()&&typeof window.fetch==='function'){
 const originalFetch=window.fetch.bind(window);
 window.fetch=(input,options)=>{
  const source=input instanceof Request?input.url:input;
  const target=new URL(source,window.location.href);
  if(target.origin!==window.location.origin||!target.pathname.startsWith('/api/'))return originalFetch(input,options);
  const headers=new Headers(options?.headers??(input instanceof Request?input.headers:undefined));
  headers.set('x-bci-permission-preview','1');
  return originalFetch(input,{...options,headers});
 };
}
