import { demoItems } from './data.js';

const KEY = 'mzt-conecta-demo-v1';
const ROLE_KEY = 'mzt-conecta-demo-role';
export function getItems() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(data)) return data;
  } catch(_) { /* Restablecer datos */ }
  const initial = demoItems();
  saveItems(initial);
  return initial;
}
export function saveItems(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
  catch (_) { return false; }
}
export function getRole() {
  const role = localStorage.getItem(ROLE_KEY);
  return ['visitante','ciudadano','lector','editor'].includes(role) ? role : 'visitante';
}
export function saveRole(role) { localStorage.setItem(ROLE_KEY, role); }
export function newId() { return `local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
export function resetDemo() { localStorage.removeItem(KEY); }
