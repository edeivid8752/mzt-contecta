// Catálogo de categorías editable en un solo lugar. Todos los ejemplos son ficticios.
export const CATEGORY_OPTIONS = {
  citizen: ['Corte de energía eléctrica', 'Corte de agua', 'Cierre de calle', 'Tráfico', 'Incidente vial', 'Encharcamiento', 'Aviso comunitario'],
  infrastructure: ['Bache', 'Fuga de agua', 'Fuga de drenaje', 'Coladera abierta o sin tapa', 'Alumbrado público', 'Inundación o encharcamiento', 'Tope sin señalización']
};

export const PLACES = [
  { name: 'Centro', coordinates: [-106.4209, 23.1999] },
  { name: 'Malecón', coordinates: [-106.4269, 23.2232] },
  { name: 'Palos Prietos', coordinates: [-106.4236, 23.2320] },
  { name: 'Av. Ejército Mexicano', coordinates: [-106.4222, 23.2392] },
  { name: 'Gran Plaza', coordinates: [-106.4267, 23.2482] },
  { name: 'Zona Dorada', coordinates: [-106.4511, 23.2491] },
  { name: 'Sábalo Country', coordinates: [-106.4592, 23.2740] },
  { name: 'Real del Valle', coordinates: [-106.4338, 23.2845] },
];

export const TYPE_INFO = {
  news: { label: 'Noticia local', short: 'Noticia', symbol: '●' },
  citizen: { label: 'Reporte ciudadano', short: 'Comunidad', symbol: '◆' },
  infrastructure: { label: 'Infraestructura', short: 'Infraestructura', symbol: '■' }
};

export function dateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function offsetDate(iso, offset) {
  const [y,m,d] = iso.split('-').map(Number);
  const date = new Date(y,m-1,d,12);
  date.setDate(date.getDate() + offset);
  return dateISO(date);
}
export function demoItems() {
  const today = dateISO();
  const yesterday = offsetDate(today, -1);
  const threeDaysAgo = offsetDate(today, -3);
  const weekAgo = offsetDate(today, -7);
  const item = (id, type, title, description, place, day, clock, more={}) => ({
    id, type, title, description, location:place?.name || 'Toda la ciudad', coordinates:place?.coordinates || null,
    day, clock, createdAt: `${day}T${clock}:00`, review:'approved', resolvedAt:null,
    image:null, sourceName: type === 'news' ? 'Contenido de ejemplo' : null,
    sourceUrl:null, category: type==='infrastructure'?'Infraestructura de ejemplo':type==='citizen'?'Aviso comunitario':'Noticia',
    owner:'demo', demo:true, ...more
  });
  return [
    item('sample-1','news','Simulación: actividad cultural en el Centro','Noticia ficticia para mostrar cómo se verían las notas locales con ubicación y fecha.',PLACES[0],today,'09:40'),
    item('sample-2','citizen','Simulación: aviso de corte de agua','Reporte ciudadano de ejemplo. No corresponde a una suspensión real del servicio.',PLACES[2],today,'09:15',{category:'Corte de agua'}),
    item('sample-3','infrastructure','Simulación: bache en Av. Ejército Mexicano','Ejemplo de un problema de infraestructura que permanece visible hasta su atención.',PLACES[3],weekAgo,'14:25',{category:'Bache'}),
    item('sample-4','news','Simulación: actualización de movilidad local','Noticia ilustrativa sobre cambios en la movilidad; no es información verificada.',PLACES[5],today,'08:30'),
    item('sample-5','citizen','Simulación: cierre temporal de vialidad','Este punto existe únicamente para probar la interacción entre la lista y el mapa.',PLACES[4],today,'07:50',{category:'Cierre de calle'}),
    item('sample-6','infrastructure','Simulación: luminaria sin servicio','Ejemplo persistente de alumbrado reportado por la comunidad.',PLACES[6],threeDaysAgo,'18:05',{category:'Alumbrado público'}),
    item('sample-7','infrastructure','Simulación: fuga de agua atendida','Ejemplo de reporte marcado como atendido. Se mantiene visible unos días en verde.',PLACES[1],weekAgo,'10:00',{category:'Fuga de agua', resolvedAt:today}),
    item('sample-8','news','Simulación: aviso de alcance municipal','Al no tener ubicación puntual, este ejemplo se muestra solo en la lista.',null,today,'07:25'),
    item('sample-9','news','Simulación: noticia del día anterior','Ejemplo de noticia histórica que solo aparece al consultar la fecha correspondiente.',PLACES[7],yesterday,'12:10'),
    item('sample-10','citizen','Simulación: tránsito del día anterior','Ejemplo histórico; no debe seguir apareciendo hoy.',PLACES[1],yesterday,'16:45',{category:'Tráfico'})
  ];
}
