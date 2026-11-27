import {registrationProfile} from './profile.js';
import {getCaptchaToken} from './turnstile-v23.js';
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';

let clientPromise = null;
let listener = null;
let generation = 0;
let supabase = null;

export async function getAuthClient(){return connection();}

export function isAuthConfigured() {
  try { return new URL(SUPABASE_URL).protocol === 'https:' && !!SUPABASE_PUBLISHABLE_KEY.trim(); }
  catch { return false; }
}

async function connection() {
  if (!isAuthConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(({createClient}) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
      }))
      .catch(err => { clientPromise = null; throw err; });
  }
  supabase = await clientPromise;
  return supabase;
}

export async function refreshIdentity(event = '') {
  const seq = ++generation;
  if (!listener) return;
  listener({status: 'loading', event});
  try {
    const client = await connection();
    if (!client) { listener({status: 'unconfigured'}); return; }
    // getUser comprueba la identidad en Auth y no se basa solo en un token local.
    const {data: sessionData, error: sessionError} =
    await client.auth.getSession();

    if (sessionError) throw sessionError;

  if (!sessionData?.session) {
  if (seq === generation) {
    listener({status: 'signed_out'});
  }
  return;
  }
    const {data: userData, error: userError} = await client.auth.getUser();
    if (userError) throw userError;
    const user = userData?.user;
    if (!user) { if (seq === generation) listener({status: 'signed_out'}); return; }
    const [profileResponse, roleResponse] = await Promise.all([
      client.from('profiles').select('display_name').eq('id', user.id).single(),
      client.from('app_roles').select('role').eq('user_id', user.id).single()
    ]);
    if (profileResponse.error || roleResponse.error) {
      throw profileResponse.error || roleResponse.error;
    }
    const role = roleResponse.data.role;
    if (!['ciudadano', 'lector', 'editor'].includes(role)) throw Error('El rol asignado no es válido.');
    if (seq === generation) listener({status: 'signed_in', user, role, profile: profileResponse.data, recovery: event === 'PASSWORD_RECOVERY'});
  } catch (error) {
    if (seq === generation) listener({status: 'error', message: 'No fue posible verificar tu sesión o los permisos de tu cuenta. Revisa Supabase y las políticas de acceso.', cause: error.message});
  }
}

export async function initializeAuth(onChange) {
  listener = onChange;
  try {
    const client = await connection();
    if (!client) { onChange({status: 'unconfigured'}); return; }
    client.auth.onAuthStateChange((event) => {
      // Supabase recomienda no encadenar consultas async dentro de este callback.
      setTimeout(() => { void refreshIdentity(event); }, 0);
    });
    await refreshIdentity();
  } catch (error) {
    onChange({status: 'error', message: 'No se pudo cargar el servicio de inicio de sesión.', cause: error.message});
  }
}

async function requiredClient() {
  const client = await connection();
  if (!client) throw Error('Falta configurar la URL y la clave publicable de Supabase.');
  return client;
}

export async function createAccount(email, password, displayName, username) {
  const profile = registrationProfile(displayName, username);
  const client = await requiredClient();
  const available = async () => {
    const {data,error}=await client.rpc('mzt_username_available',{p_username:profile.username});
    if(error) throw Error('No se pudo verificar el nombre de usuario. Inténtalo de nuevo.');
    return data === true;
  };
  if(!await available()) throw Error('Ese nombre de usuario ya está ocupado. Elige otro.');
  const captchaToken=await getCaptchaToken();
  const {data, error} = await client.auth.signUp({email, password, options: {data:profile,emailRedirectTo: location.origin + '/',captchaToken}});
  if (error) {
    // La restricción única del servidor también protege frente a registros simultáneos.
    if(error.code === 'unexpected_failure' || /database error/i.test(error.message||'')) {
      let taken=false;
      try {taken=!(await available());} catch {}
      if(taken) throw Error('Ese nombre de usuario ya está ocupado. Elige otro.');
    }
    throw error;
  }
  return data;
}
export async function loginAccount(email, password) {
  const client = await requiredClient();
  const captchaToken=await getCaptchaToken();
  const {data, error} = await client.auth.signInWithPassword({email, password,options:{captchaToken}});
  if (error) throw error;
  return data;
}
export async function logoutAccount() {
  const client = await requiredClient();
  const {error} = await client.auth.signOut();
  if (error) throw error;
}
export async function requestPasswordReset(email) {
  const client = await requiredClient();
  const captchaToken=await getCaptchaToken();
  const {error} = await client.auth.resetPasswordForEmail(email, {redirectTo: location.origin + '/',captchaToken});
  if (error) throw error;
}
export async function changePassword(password) {
  const client = await requiredClient();
  const {error} = await client.auth.updateUser({password});
  if (error) throw error;
}
export async function saveDisplayName(userId, displayName) {
  const client = await requiredClient();
  const {data, error} = await client.from('profiles').update({display_name: displayName})
    .eq('id', userId).select('display_name').single();
  if (error) throw error;
  return data;
}

export async function loginOAuth(provider){if(!['google','facebook','apple','discord','github'].includes(provider))throw Error('Proveedor no válido');const c=await requiredClient();const {error}=await c.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+location.pathname+location.search}});if(error)throw error;}
