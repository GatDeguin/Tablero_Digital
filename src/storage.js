/** Serialized complete IndexedDB snapshots + recoverable compact emergency tail.
 * Web Locks protects a single writer per app path when supported. No network.
 */
class LocalVault {
  constructor(){
    let base='preview';try{base=new URL('.',location.href).pathname;}catch{}
    this.key='velora-gt:'+base;this.db=null;this.queue=Promise.resolve();this.mode='MEMORIA';
    this.warning='';this.onStatus=()=>{};this.readOnly=false;this.lockMode='UNA PESTAÑA RECOMENDADA';this.releaseLock=null;
  }
  async acquire(){
    if(!navigator.locks?.request)return;
    await new Promise(resolve=>{
      navigator.locks.request(this.key+':writer',{ifAvailable:true},lock=>{
        if(!lock){this.readOnly=true;this.lockMode='SOLO LECTURA';resolve();return;}
        this.lockMode='ESCRITOR EXCLUSIVO';resolve();
        return new Promise(done=>{this.releaseLock=done;});
      }).catch(()=>{this.lockMode='SIN EXCLUSIÓN';resolve();});
    });
  }
  async init(){
    await this.acquire();
    try{
      this.db=await new Promise((resolve,reject)=>{
        const r=indexedDB.open(this.key,1);let expired=false;
        const timer=setTimeout(()=>{expired=true;reject(Error('Almacenamiento bloqueado'));},3500);
        r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('snapshots'))r.result.createObjectStore('snapshots');};
        r.onsuccess=()=>{clearTimeout(timer);if(expired){r.result.close();return;}r.result.onversionchange=()=>{r.result.close();this.db=null;this.mode='CHECKPOINT';this.onStatus(this.mode,'Base local cerrada por cambio de versión.');};resolve(r.result);};
        r.onerror=()=>{clearTimeout(timer);reject(r.error);};
        r.onblocked=()=>{clearTimeout(timer);expired=true;reject(Error('Cerrá otras pestañas del tablero para habilitar almacenamiento.'));};
      });this.mode='INDEXEDDB';
    }catch(e){this.warning=e.message;this.mode='CHECKPOINT';}
    const candidates=[];
    if(this.db)for(const k of ['current','previous'])try{const raw=await this.read(k);if(raw)candidates.push(validateBackup(raw));}catch{this.warning='Copia inválida; se buscó una alternativa.';}
    let checkpoint=null;
    try{const raw=localStorage.getItem(this.key);if(raw){checkpoint=JSON.parse(raw);validateBackup(checkpoint);}else{const probe=this.key+':probe';localStorage.setItem(probe,'1');localStorage.removeItem(probe);}}
    catch{checkpoint=null;if(!this.db){this.warning='Sin almacenamiento: exportá un respaldo antes de cerrar.';this.mode='MEMORIA';}else this.warning='Checkpoint no disponible; se usa la copia completa de IndexedDB.';}
    candidates.sort((a,b)=>b.updated-a.updated);
    const data=recoverSnapshots(candidates[0]||null,checkpoint);
    if(!candidates.length&&checkpoint?._compact)this.warning='Se recuperaron totales y cola de emergencia; pueden faltar trazas completas.';
    if(this.readOnly)this.warning='Otra pestaña controla los datos. Esta ventana es de solo lectura: cerrá la otra y recargá para registrar.';
    this.onStatus(this.readOnly?'SOLO LECTURA':this.mode,this.warning);
    return data;
  }
  async clear(){
    if(this.readOnly)throw Error('Otra pestaña es propietaria de los datos.');
    await this.queue.catch(()=>{});let removed=false;
    try{localStorage.removeItem(this.key);removed=true;}catch{}
    if(this.db){await new Promise((resolve,reject)=>{const tx=this.db.transaction('snapshots','readwrite');tx.objectStore('snapshots').clear();tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Borrado interrumpido'));});removed=true;}
    if(!removed)throw Error('No se pudo borrar el almacenamiento.');
  }
  read(key){return new Promise((resolve,reject)=>{if(!this.db)return resolve(null);const r=this.db.transaction('snapshots').objectStore('snapshots').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  checkpoint(data){
    if(this.readOnly)return false;
    try{
      const compact={...data,_compact:true,history:data.history.map(t=>({...t,points:[]})),active:data.active?{...data.active,points:data.active.points.slice(-64)}:null};
      localStorage.setItem(this.key,JSON.stringify(compact));return true;
    }catch{this.warning='No hay espacio para el checkpoint. Exportá un respaldo.';return false;}
  }
  save(data){
    if(this.readOnly)return Promise.reject(Error('Otra pestaña controla los datos; no se sobrescribieron.'));
    const snapshot=structuredClone(data);snapshot.updated=Math.max(Date.now(),(data.updated||0)+1);data.updated=snapshot.updated;
    const checkpointOK=this.checkpoint(snapshot);this.onStatus('GUARDANDO…','');
    this.queue=this.queue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
      if(!this.db){this.mode=checkpointOK?'CHECKPOINT':'MEMORIA';this.onStatus(checkpointOK?'CHECKPOINT':'SIN GUARDAR',checkpointOK?'Sin IndexedDB: totales y cola guardados; exportá para conservar todas las trazas.':this.warning);resolve({complete:false,checkpoint:checkpointOK});return;}
      const tx=this.db.transaction('snapshots','readwrite'),s=tx.objectStore('snapshots'),r=s.get('current');
      r.onsuccess=()=>{if(r.result)s.put(r.result,'previous');s.put(snapshot,'current');};
      tx.oncomplete=()=>{this.mode='INDEXEDDB';this.onStatus('GUARDADO LOCAL','');resolve({complete:true});};
      tx.onerror=tx.onabort=()=>{this.mode=checkpointOK?'CHECKPOINT':'MEMORIA';this.onStatus(checkpointOK?'CHECKPOINT':'SIN GUARDAR','No se guardó la traza completa. Exportá un respaldo.');reject(tx.error||Error('Guardado interrumpido'));};
    }));return this.queue;
  }
}
