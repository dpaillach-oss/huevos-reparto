/* ============================================================================
 * sw.js — Service Worker de HuevosReparto
 * ----------------------------------------------------------------------------
 * Permite que la aplicación quede instalada en el teléfono y funcione SIN
 * INTERNET después de la primera visita (los datos se guardan aparte, en el
 * almacenamiento local del teléfono).
 *
 * Estrategia:
 *   - La "cáscara" de la aplicación se sirve primero desde la caché
 *     (cache-first) y se refresca en segundo plano cuando hay internet.
 *   - Si el teléfono está sin conexión y el usuario abre la aplicación, se
 *     devuelve el index.html guardado.
 * ========================================================================== */
"use strict";

var VERSION = "v1";
var CACHE = "huevosreparto-" + VERSION;

/* Archivos que se guardan para el uso sin internet.
   NOTA: si se agrega un archivo nuevo al despliegue, hay que sumarlo aquí y
   subir la VERSION para que los teléfonos lo vuelvan a descargar. */
var ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/apple-touch-icon.png",
  "./iconos/favicon.png"
];

self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Se guarda archivo por archivo para que un fallo aislado no impida
      // instalar la aplicación.
      return Promise.all(ARCHIVOS.map(function (url) {
        return cache.add(new Request(url, { cache: "reload" })).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(claves.map(function (clave) {
        return clave === CACHE ? null : caches.delete(clave);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (evento) {
  var peticion = evento.request;
  if (peticion.method !== "GET") { return; }

  var url = new URL(peticion.url);
  if (url.origin !== self.location.origin) { return; }   // no se tocan otros dominios

  evento.respondWith(
    caches.match(peticion, { ignoreSearch: true }).then(function (guardado) {
      if (guardado) {
        // Se actualiza en segundo plano si hay conexión
        fetch(peticion).then(function (respuesta) {
          if (respuesta && respuesta.ok) { caches.open(CACHE).then(function (c) { c.put(peticion, respuesta.clone()); }); }
        }).catch(function () { });
        return guardado;
      }
      return fetch(peticion).then(function (respuesta) {
        if (respuesta && respuesta.ok) {
          var copia = respuesta.clone();
          caches.open(CACHE).then(function (c) { c.put(peticion, copia); });
        }
        return respuesta;
      }).catch(function () {
        // Sin conexión y sin caché: al menos se devuelve la aplicación
        return caches.match("./index.html");
      });
    })
  );
});
