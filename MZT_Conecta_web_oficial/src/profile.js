// Personalización local de perfiles en v0.8. No equivale a un perfil público
// compartido: esa parte necesitará tablas y políticas RLS en una futura versión.
const PREFIX = 'mzt_conecta_profile_v08:';
const HANDLE = /^[a-z0-9._]{3,20}$/;
const AVATAR = /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/;

export function suggestedUsername(userId) {
  return `ciudadano_${String(userId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toLowerCase() || 'mzt'}`;
}

export function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

export function validUsername(value) {
  return HANDLE.test(value);
}

export function loadLocalProfile(userId) {
  const fallback = {username: suggestedUsername(userId), bio: '', avatar: null,cover:null};
  if (!userId) return fallback;
  try {
    const data = JSON.parse(localStorage.getItem(PREFIX + userId) || '{}');
    return {
      username: typeof data.username === 'string' && HANDLE.test(data.username) ? data.username : fallback.username,
      bio: typeof data.bio === 'string' ? data.bio.slice(0, 160) : '',
      avatar: typeof data.avatar === 'string' && data.avatar.length < 250000 && AVATAR.test(data.avatar) ? data.avatar : null,
      cover: typeof data.cover === 'string' && data.cover.length < 450000 && AVATAR.test(data.cover) ? data.cover : null
    };
  } catch {return fallback;}
}

export function saveLocalProfile(userId, profile) {
  if (!userId) throw Error('Primero inicia sesión.');
  const username = normalizeUsername(profile.username);
  const bio = String(profile.bio || '').trim();
  const avatar = profile.avatar;
  const cover = profile.cover ?? null;
  if (!validUsername(username)) throw Error('El usuario debe tener entre 3 y 20 caracteres: letras, números, puntos o guiones bajos.');
  if (bio.length > 160) throw Error('La biografía debe tener como máximo 160 caracteres.');
  if (avatar !== null && (typeof avatar !== 'string' || avatar.length >= 250000 || !AVATAR.test(avatar))) {
    throw Error('La foto seleccionada no se pudo guardar.');
  }
  if (cover !== null && (typeof cover !== 'string' || cover.length >= 450000 || !AVATAR.test(cover))) {
    throw Error('La portada seleccionada no se pudo guardar.');
  }
  try {localStorage.setItem(PREFIX + userId, JSON.stringify({username, bio, avatar,cover}));}
  catch {throw Error('No hay espacio para guardar el perfil en este navegador.');}
  return {username, bio, avatar,cover};
}

export async function prepareAvatar(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw Error('Elige una fotografía JPG, PNG o WebP.');
  }
  if (file.size > 3 * 1024 * 1024) throw Error('La fotografía no debe superar los 3 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const context = canvas.getContext('2d');
    if (!context) throw Error('No pudimos procesar la imagen.');
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    const left = (image.naturalWidth - crop) / 2;
    const top = (image.naturalHeight - crop) / 2;
    context.drawImage(image, left, top, crop, crop, 0, 0, 240, 240);
    const avatar = canvas.toDataURL('image/jpeg', .8);
    if (avatar.length >= 250000) throw Error('La fotografía resultante ocupa demasiado espacio.');
    return avatar;
  } catch (error) {
    throw Error(error.message || 'No pudimos leer la imagen.');
  } finally {URL.revokeObjectURL(url);}
}

export function registrationProfile(displayName,username) {
  const name=String(displayName??'').trim();
  const handle=normalizeUsername(username);
  if ([...name].length<3 || [...name].length>40) throw Error('El nombre visible debe tener entre 3 y 40 caracteres.');
  if (!validUsername(handle)) throw Error('El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números, puntos o guiones bajos.');
  return {display_name:name,username:handle};
}
