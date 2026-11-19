// This worker handles push delivery only. Operational pages are never cached.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('bci-pilot-')).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('push',event=>{
  let data;
  try{data=event.data.json();}catch{return;}
  event.waitUntil(self.registration.showNotification('BCI Operations',{
    body:data.body,tag:data.tag,icon:'/icon-192.png',data:{url:data.url}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL(event.notification.data?.url || '/',self.location.origin);
  if(url.origin!==self.location.origin||url.pathname!=='/')return;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=windows.find(window=>new URL(window.url).origin===url.origin);
    if(client){await client.navigate(url.href);await client.focus();}
    else await self.clients.openWindow(url.href);
  })());
});
