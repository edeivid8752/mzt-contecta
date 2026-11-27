// Clave pública del widget. La clave secreta solo se configura en Supabase Auth.
export const TURNSTILE_SITE_KEY='0x4AAAAAAGWAMwY5kxI0YUkC';
const SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading=null;
function loadTurnstile(){
 if(globalThis.turnstile?.render)return Promise.resolve(globalThis.turnstile);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=SCRIPT;script.async=true;
  let timer;
  function fail(){clearTimeout(timer);script.remove();reject(Error('No se pudo cargar la verificación de seguridad. Comprueba tu conexión y los bloqueadores del navegador.'));}
  script.onload=()=>{if(globalThis.turnstile?.render){clearTimeout(timer);resolve(globalThis.turnstile);}else fail();};
  script.onerror=fail;
  timer=setTimeout(fail,15000);
  document.head.append(script);
 }).catch(error=>{loading=null;throw error;});
 return loading;
}
export function createCaptchaChallenge({load=loadTurnstile,doc=globalThis.document,key=TURNSTILE_SITE_KEY,timeout=150000}={}){
 let active=false;
 return async function getToken(){
  if(active)throw Error('Ya hay una verificación de seguridad en curso.');
  active=true;
  try{
   return await new Promise((resolve,reject)=>{
    const d=doc.createElement('dialog');d.className='v23-captcha-dialog';d.setAttribute('aria-label','Verificación de seguridad');
    d.innerHTML='<h2>Verificación de seguridad</h2><p>Completa la comprobación para continuar.</p><div data-captcha-host></div><p data-captcha-status role="status">Cargando verificación…</p><button type="button" class="soft-btn" data-captcha-cancel>Cancelar</button>';
    let api,id,done=false,timer;
    const finish=(error,token)=>{
     if(done)return;done=true;clearTimeout(timer);
     if(id!==undefined)try{api.remove(id);}catch{}
     try{if(d.open)d.close();}catch{}
     d.remove();if(error)reject(error);else resolve(token);
    };
    const cancel=()=>finish(Error('Verificación cancelada. Puedes volver a intentarlo.'));
    d.querySelector('[data-captcha-cancel]').addEventListener('click',cancel);
    d.addEventListener('cancel',e=>{e.preventDefault();cancel();});
    d.addEventListener('close',cancel);
    try{doc.body.append(d);d.showModal();}catch(e){finish(e);return;}
    timer=setTimeout(()=>finish(Error('La verificación tardó demasiado. Inténtalo nuevamente.')),timeout);
    Promise.resolve().then(load).then(widget=>{
     if(done)return;api=widget;
     d.querySelector('[data-captcha-status]').textContent='Verificando…';
     id=api.render(d.querySelector('[data-captcha-host]'),{
      sitekey:key,theme:'auto',size:'flexible',language:'es',appearance:'always',retry:'never',
      callback:token=>{if(typeof token!=='string'||!token.trim())finish(Error('Verificación no válida.'));else finish(null,token);},
      'error-callback':()=>{finish(Error('No se pudo completar la verificación. Revisa el dominio o el bloqueador de contenido e inténtalo de nuevo.'));return true;},
      'expired-callback':()=>finish(Error('La verificación venció. Inténtalo nuevamente.')),
      'timeout-callback':()=>finish(Error('La verificación tardó demasiado. Inténtalo nuevamente.')),
      'unsupported-callback':()=>finish(Error('Tu navegador no admite esta verificación.'))
     });
     if(done&&id!==undefined)try{api.remove(id);}catch{}
    }).catch(e=>finish(e instanceof Error?e:Error('No se pudo iniciar la verificación.')));
   });
  }finally{active=false;}
 };
}
export const getCaptchaToken=createCaptchaChallenge();
