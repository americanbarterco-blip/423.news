/* Native Spanish interface for Claudia Green Live Wire.
   Translates interface labels only; report text and source names remain as filed. */
(function () {
  'use strict';
  if (window.__claudiaSpanishUI) return;
  window.__claudiaSpanishUI = true;
  document.documentElement.lang = 'es';

  const words = {
    'Home':'Inicio','Alerts':'Alertas','News':'Noticias','Forecast':'Pronóstico',
    '423 Events':'Eventos 423','Hot Spots':'Zonas destacadas','Checkpoints':'Puntos de control',
    'Local Sports':'Deportes locales','Scores & Live':'Marcadores y en vivo',
    'Outdoors':'Aire libre','Classifieds':'Clasificados','Yard Sales':'Ventas de garaje',
    '🎁 Perks':'🎁 Beneficios','citizen423report':'Comunidad 423','Government':'Gobierno',
    'At her desk':'En su escritorio','AI · recorded':'IA · grabado',
    'Enable voice':'Activar voz','Live Wire':'En vivo',
    'REAL REPORTS • REAL INCIDENTS • REAL TIME':'REPORTES REALES • INCIDENTES REALES • EN TIEMPO REAL',
    'Send Claudia a tip':'Enviar información a Claudia','First to the call.':'Primera en responder.',
    'First to you.':'Primera en informarte.','Incident Feed':'Reportes de incidentes',
    'Auto refresh':'Actualizar automáticamente','Refresh now':'Actualizar ahora',
    'Waiting for first update…':'Esperando la primera actualización…',
    'Filter by category':'Filtrar por categoría','All':'Todos','Police':'Policía',
    'Fire':'Bomberos','EMS':'Servicios médicos','Traffic':'Tráfico','Weather':'Clima',
    'Community':'Comunidad','Search incidents':'Buscar incidentes',
    'Coverage area':'Área de cobertura','All zones':'Todas las zonas','Incidents':'Incidentes',
    'Live Incident Map':'Mapa de incidentes en vivo','Full screen':'Pantalla completa',
    'Full screen map':'Mapa en pantalla completa','Zoom in':'Acercar','Zoom out':'Alejar',
    'Reset map view':'Restablecer vista del mapa',
    'These reports have no map coordinates, so they are listed in the feed and not plotted at a guessed position.':'Estos reportes no tienen coordenadas. Se muestran en la lista, pero no se ubican en el mapa mediante una ubicación estimada.',
    'Voice & Alerts':'Voz y alertas','Not connected':'Sin conexión','Play audio':'Reproducir audio',
    'Mute':'Silenciar','Unmute':'Activar sonido','Volume':'Volumen',
    'Alerts':'Alertas','On-screen notice when a new report arrives':'Aviso en pantalla cuando llega un nuevo reporte',
    'Voice announcements':'Anuncios por voz','Synthesized voice on this device':'Voz sintética de este dispositivo',
    'Background music':'Música de fondo','No music source is configured':'No hay una fuente de música configurada',
    'Auto announce new incidents':'Anunciar nuevos incidentes automáticamente',
    'Needs voice announcements on':'Requiere activar los anuncios por voz',
    'Announce latest incident':'Anunciar el incidente más reciente','Stop':'Detener',
    'Announcements use your device’s synthesized voice and the report text shown here. They are not live radio and not an official dispatch.':'Los anuncios usan la voz sintética de tu dispositivo y el texto del reporte mostrado aquí. No son radio en vivo ni comunicaciones oficiales de despacho.',
    'Quick Actions':'Acciones rápidas','Make an Announcement':'Hacer un anuncio',
    'Add New Report':'Agregar un reporte','Open Publishing Desk':'Abrir el panel de publicación',
    'Public Information Sources':'Fuentes de información pública',
    'External sites. Not 423.news partners.':'Sitios externos. No son socios de 423.news.',
    'Reports here follow the desk policy: no names and no street numbers. This is not an emergency service: call 911.':'Los reportes siguen la política editorial: no se publican nombres ni números de calle. Esto no es un servicio de emergencia: llama al 911.',
    'Police report locations are shown without house numbers. Do not send names, phone numbers or home addresses. This is not an emergency service: call 911.':'Las ubicaciones de los reportes policiales se muestran sin números de vivienda. No envíes nombres, teléfonos ni domicilios. Esto no es un servicio de emergencia: llama al 911.',
    'Latest Incidents':'Incidentes recientes','Studio & the desk':'Estudio y redacción',
    'On camera':'En cámara','Sound on':'Activar sonido','Sound off':'Silenciar',
    'On the desk now':'En la mesa de redacción','Loading her latest reports…':'Cargando sus reportes más recientes…',
    'How Claudia files':'Cómo prepara Claudia sus reportes',
    'Unverified tips are never printed as fact. Every unverified item is filed as unconfirmed until a published record, an official release, or a second independent source corroborates it. Then it is re-filed as verified.':'Los avisos no verificados nunca se publican como hechos. Cada dato no verificado se marca como sin confirmar hasta que lo respalde un registro publicado, un comunicado oficial o una segunda fuente independiente. Después se actualiza como verificado.',
    'She writes her own account: no transcript, no quotes, no names, no street numbers, no medical detail.':'Claudia redacta sus propios reportes: sin transcripciones, citas, nombres, números de calle ni detalles médicos.',
    'Two-source minimum for anything that names a person. Corrections are appended, never deleted.':'Se requieren al menos dos fuentes para cualquier información que identifique a una persona. Las correcciones se agregan; nunca se borran.',
    'Area conditions':'Condiciones del área',
    'Any area: weather, alerts, traffic and crime radar.':'Cualquier zona: clima, alertas, tráfico y radar de incidentes.',
    'Any area: city, county, postcode, or lat,lon':'Cualquier zona: ciudad, condado, código postal o latitud,longitud',
    'Look up area':'Buscar zona','Use my location':'Usar mi ubicación',
    'Weather and alerts come from Open-Meteo and the National Weather Service. Traffic incidents come from TomTom. The radar plots geocoded incidents from city open data. Unverified signals are always labeled unconfirmed.':'El clima y las alertas provienen de Open-Meteo y del Servicio Meteorológico Nacional de EE. UU. Los incidentes de tráfico provienen de TomTom. El radar muestra incidentes geolocalizados de datos públicos municipales. Las señales no verificadas siempre se marcan como sin confirmar.',
    'Local News. Real Time.':'Noticias locales. En tiempo real.',
    'All her reporting':'Todos sus reportes','Stay Informed. Stay Safe.':'Mantente informado. Mantente seguro.',
    'Details':'Detalles','Time':'Hora','Location':'Ubicación','Zone':'Zona','Units':'Unidades',
    'Talkgroup':'Grupo de radio','Source':'Fuente','Read aloud':'Leer en voz alta',
    'Open full report':'Abrir el reporte completo','Close':'Cerrar','Demo':'Demostración',
    'Loading reports':'Cargando reportes','Contacting the 423.news wire.':'Conectando con la red de 423.news.',
    'You are offline':'Estás sin conexión','Could not load reports':'No se pudieron cargar los reportes',
    'Try again':'Intentar de nuevo','No active reports right now':'No hay reportes activos en este momento',
    'Reports appear here when the Claudia Green desk publishes them.':'Los reportes aparecerán aquí cuando el equipo de Claudia Green los publique.',
    'Preview with demo data':'Ver una demostración','No incidents match your filters':'Ningún incidente coincide con tus filtros',
    'Clear filters':'Borrar filtros','Nothing to show yet.':'Todavía no hay nada para mostrar.',
    'This page is read-only. Reports are filed by the desk.':'Esta página es de solo lectura. Los reportes son publicados por la redacción.',
    'Sign in to submit tips. Publishing is limited to approved press and admin accounts.':'Inicia sesión para enviar información. La publicación está limitada a cuentas autorizadas de prensa y administración.',
    'Signed in with publishing access.':'Sesión iniciada con permisos de publicación.',
    'Signed in. Tips go to editorial review before anything is published.':'Sesión iniciada. La información se envía a revisión editorial antes de publicarse.',
    'No incidents to announce yet.':'Todavía no hay incidentes para anunciar.',
    'This incident is no longer on the wire.':'Este incidente ya no está disponible.',
    'Incident details':'Detalles del incidente','Not fully confirmed. Details may change.':'No está totalmente confirmado. Los detalles pueden cambiar.',
    'View on OpenStreetMap':'Ver en OpenStreetMap','No new reports in the last ':'No hay reportes nuevos en las últimas ',
    ' hours. She files here the moment something develops.':' horas. Claudia publica aquí cuando surge alguna novedad.',
    'Her reports could not be loaded right now.':'Sus reportes no se pudieron cargar en este momento.',
    'At her desk. New reports appear here as soon as she files them.':'En su escritorio. Los nuevos reportes aparecerán aquí en cuanto los publique.',
    'Updated ':'Actualizado ','just now':'ahora mismo',' min ago':' min atrás',' hr ago':' h atrás',
    'New report: ':'Nuevo reporte: ','New ':'Nuevo ',' report:':' reporte:',
    'You are offline. Showing the last reports received.':'Estás sin conexión. Se muestran los últimos reportes recibidos.',
    'reading the sky over ':'consultando el clima de ','checking the roads':'consultando el estado de las carreteras',
    'synced ':'sincronizado a las ','Locating…':'Buscando ubicación…',
    'Location unavailable: ':'Ubicación no disponible: '
  };
  const attrs = ['aria-label','title','placeholder','alt'];
  const keys = Object.keys(words).sort((a,b)=>b.length-a.length);
  function translateText(node) {
    const raw = node.nodeValue, trimmed = raw.trim();
    if (!trimmed) return;
    let next = words[trimmed];
    if (!next) {
      next = trimmed;
      for (const k of keys) {
        if (k.length > 12 && next.includes(k)) next = next.split(k).join(words[k]);
      }
    }
    if (next !== trimmed) node.nodeValue = raw.replace(trimmed,next);
  }
  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches('script,style,noscript')) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateText);
    attrs.forEach(a => {
      if (!el.hasAttribute(a)) return;
      const v=el.getAttribute(a); if (words[v]) el.setAttribute(a,words[v]);
    });
  }
  function boot() {
    document.title = 'Claudia Green • Reportes en vivo | 423.news';
    translateElement(document.body);
    const observer = new MutationObserver(records => records.forEach(rec => {
      if (rec.type === 'characterData') translateText(rec.target);
      rec.addedNodes && rec.addedNodes.forEach(n => {
        if (n.nodeType === 1) translateElement(n);
        else if (n.nodeType === 3) translateText(n);
      });
    }));
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();