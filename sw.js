const CACHE = "bibliokemon-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./fr_en_pokemon.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// App shell : cache-first. Appels à l'API de cotes : toujours le réseau (données fraîches).
self.addEventListener("fetch", (e)=>{
  const url = e.request.url;
  if(url.includes("api.pokemontcg.io") || url.includes("fonts.g")){
    return; // laisse passer directement au réseau
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
