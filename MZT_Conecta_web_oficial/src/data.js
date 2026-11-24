// Catálogo de categorías editable en un solo lugar. Catálogo de categorías y lugares de referencia.
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
