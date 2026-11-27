// La verificación de identidad no debe reconstruir la interfaz si la sesión no cambió.
export function keepCurrentViewOnIdentity({wasChecked,oldId,newId,previousRole,newRole,authRoute,recovery,authHidden,shellHidden}){
 return Boolean(wasChecked&&oldId&&oldId===newId&&previousRole===newRole&&!authRoute&&!recovery&&authHidden&&!shellHidden);
}
