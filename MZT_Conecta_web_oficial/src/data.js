// Catálogo de categorías editable en un solo lugar. Catálogo de categorías y lugares de referencia.
export const CATEGORY_OPTIONS = {
  social: ['Comida','Playas y miradores','Eventos y música','Deportes','Negocios locales','Otros'],
  citizen: ['Corte de energía eléctrica', 'Corte de agua', 'Cierre de calle', 'Tráfico', 'Incidente vial', 'Encharcamiento', 'Aviso comunitario','Choques','Actos violentos','Cultura y turismo','Deportes','Clima','Otros'],
  infrastructure: ['Bache', 'Fuga de agua', 'Fuga de drenaje', 'Coladera abierta o sin tapa', 'Alumbrado público', 'Inundación o encharcamiento', 'Tope sin señalización','Otros']
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
  social: { label:'Social',short:'Social',symbol:'◇' },
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

export const WALL_TOPICS={social:CATEGORY_OPTIONS.social,news:['Choques','Actos violentos','Tránsito','Servicios','Ciudad','Cultura y turismo','Deportes','Clima','Otros'],infrastructure:['Baches','Fugas de agua','Drenaje y coladeras','Alumbrado','Inundaciones','Topes','Otros']};
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function matchesWallTopic(item,topic){const c=normal(item.category),t=normal(item.title);if(c===normal(topic))return true;const aliases={'Choques':/choque|colision|accidente vial/,'Actos violentos':/violencia|violento|agresion/,'Tránsito':/trafico|cierre de calle|incidente vial|transito/,'Servicios':/corte de|electricidad|servicio/,'Ciudad':/aviso comunitario|ciudad/,'Cultura y turismo':/cultura|turismo/,'Deportes':/deporte|futbol|beisbol/,'Clima':/clima|lluvia|encharcamiento/,'Baches':/bache/,'Fugas de agua':/fuga de agua/,'Drenaje y coladeras':/drenaje|coladera/,'Alumbrado':/alumbrado/,'Inundaciones':/inundacion|encharcamiento/,'Topes':/tope/};return !!aliases[topic]?.test(c+' '+t);}
