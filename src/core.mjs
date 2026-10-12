/** Pure telemetry and portable formats. Units: metres, seconds, degrees; UI speed in km/h. */
export const EARTH_RADIUS = 6371008.8;
const rad = n => n * Math.PI / 180;
export function haversine(lat1, lon1, lat2, lon2) {
  const a = Math.sin(rad(lat2-lat1)/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(Math.max(0,a)),Math.sqrt(Math.max(0,1-a)));
}
export function bearing(lat1,lon1,lat2,lon2) {
  const y = Math.sin(rad(lon2-lon1))*Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1))*Math.sin(rad(lat2))-Math.sin(rad(lat1))*Math.cos(rad(lat2))*Math.cos(rad(lon2-lon1));
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
export const finite = n => typeof n==='number' && Number.isFinite(n);
export function validPoint(p) {
  return p && finite(p.latitude) && Math.abs(p.latitude)<=90 && finite(p.longitude) && Math.abs(p.longitude)<=180 && finite(p.timestamp) && p.timestamp>=0 && p.timestamp<8640000000000000;
}
export class Telemetry {
  constructor() {
    this.previous=null; this.anchor=null; this.split=true; this.lastTimestamp=-1;
    this.state={speed:null,source:'none',speedSamples:0,distance:0,elapsed:0,moving:0,max:0,heading:null,altitude:null,accuracy:null,position:null,accepted:0,rejected:0,points:[],quality:'waiting'};
  }
  stale(){this.state.speed=null;this.state.heading=null;this.state.accuracy=null;this.state.altitude=null;this.state.quality='stale';this.state.position=null;this.previous=null;this.anchor=null;this.split=true;}
  reject(reason,breakSegment=true){this.state.rejected++;this.state.speed=null;this.state.heading=null;this.state.accuracy=null;this.state.altitude=null;this.state.quality=reason;this.state.position=null;if(breakSegment){this.previous=null;this.anchor=null;this.split=true;}return {accepted:false,reason,delta:0};}
  push(raw) {
    if(!validPoint(raw) || !finite(raw.accuracy) || raw.accuracy<0)return this.reject('invalid');
    if(raw.timestamp<=this.lastTimestamp){this.state.rejected++;return {accepted:false,reason:'order',delta:0};}
    this.lastTimestamp=raw.timestamp;
    if(finite(raw.speed)&&(raw.speed<0||raw.speed>97.22))return this.reject('speed');
    if(raw.accuracy>50)return this.reject('accuracy');
    const p={latitude:raw.latitude,longitude:raw.longitude,timestamp:raw.timestamp,accuracy:raw.accuracy,
      speed:finite(raw.speed)&&raw.speed>=0&&raw.speed<=97.22?raw.speed:null,
      heading:finite(raw.heading)&&raw.heading>=0&&raw.heading<360?raw.heading:null,
      altitude:finite(raw.altitude)&&raw.altitude>=-12000&&raw.altitude<=100000&&finite(raw.altitudeAccuracy)&&raw.altitudeAccuracy>=0&&raw.altitudeAccuracy<=100?raw.altitude:null};
    let prev=this.previous,dt=prev?(p.timestamp-prev.timestamp)/1000:0,delta=0,ms=p.speed;
    if(dt>15){prev=null;this.anchor=null;this.split=true;dt=0;}
    if(prev){
      const displacement=haversine(prev.latitude,prev.longitude,p.latitude,p.longitude);
      if(displacement/dt>97.22 || (ms!==null && displacement>Math.max(30,ms*dt*3+prev.accuracy+p.accuracy))){
        this.reject('jump');this.previous=p;this.anchor=p;return {accepted:false,reason:'jump',delta:0};
      }
      if(ms!==null){
        // Stationary reports dominate noisy position changes. No distance is inferred from speed alone.
        if(ms>=.8 && displacement>=.5) delta=displacement;
        this.anchor=p;
      }else{
        const a=this.anchor||prev, adt=(p.timestamp-a.timestamp)/1000;
        const ad=haversine(a.latitude,a.longitude,p.latitude,p.longitude);
        const threshold=Math.max(3,(a.accuracy+p.accuracy)*.65);
        if(adt>15){this.anchor=p;ms=null;}
        else if(ad>threshold && adt>0){delta=ad;ms=ad/adt;this.anchor=p;}
        else ms=0; // Below the accuracy deadband: no detected movement, explicitly an estimate.
      }
      this.state.elapsed+=dt;
      if(ms!==null&&ms>=.8)this.state.moving+=dt;
    }
    this.state.speed=ms===null?null:ms*3.6;
    this.state.source=p.speed!==null?'device':'positions';
    this.state.distance+=delta;
    if(this.state.speed!==null){this.state.speedSamples++;this.state.max=Math.max(this.state.max,this.state.speed);}
    this.state.heading=ms!==null&&ms>=1?(p.heading!==null?p.heading:(prev&&delta>0?bearing(prev.latitude,prev.longitude,p.latitude,p.longitude):null)):null;
    this.state.altitude=p.altitude;this.state.accuracy=p.accuracy;this.state.position=p;
    this.state.quality=p.accuracy<=15?'good':'fair';this.state.accepted++;
    if(this.split || delta>0 || !this.state.points.length){
      this.state.points.push({...p,speed:this.state.speed,break:this.split});
      if(this.state.points.length>3000){
        // Retain starts of segments; simplify older points without joining known gaps.
        this.state.points=this.state.points.filter((v,i,a)=>v.break||i%2===0||i===a.length-1);
        if(this.state.points.length>3000)this.state.points=this.state.points.slice(-3000);
        this.state.points[0].break=true;
      }
    }
    this.split=false;this.previous=p;this.anchor??=p;
    return {accepted:true,delta,reason:this.state.quality};
  }
}
export function initialData(){return {version:1,updated:0,safetyLock:false,odo:0,tripA:0,tripB:0,base:0,parking:null,history:[],active:null,settings:{theme:'carbon',limit:80,unit:'kmh',quality:'auto',motion:'system',sounds:false,brightness:1,volume:.7}};}
/** Strict compatible v1 format: additive fields retain backward import support. */
export function validateBackup(value){
  if(!value||value.version!==1)throw new Error('Versión de respaldo incompatible.');
  const d=initialData(),date=n=>finite(n)&&n>=0&&n<8640000000000000;
  for(const k of ['odo','tripA','tripB','base']){
    if(!finite(value[k])||value[k]<0||value[k]>1e12)throw new Error('Distancia inválida: '+k);
    d[k]=value[k];
  }
  if(!Array.isArray(value.history)||value.history.length>50)throw new Error('Historial inválido.');
  const validateTrip=t=>{
    if(!t||!date(t.start)||!finite(t.distance)||t.distance<0||t.distance>1e9||!finite(t.elapsed)||t.elapsed<0||t.elapsed>1e10||!finite(t.max)||t.max<0||t.max>350)throw new Error('Viaje dañado.');
    const end=t.end??t.start;
    if(!date(end)||end<t.start)throw new Error('Fechas de viaje inválidas.');
    if(!Array.isArray(t.points)||t.points.length>3000)throw new Error('Traza demasiado grande o inválida.');
    let last=-1;
    const points=t.points.map((p,i)=>{
      if(!validPoint(p)||p.timestamp<=last||p.timestamp<t.start||p.timestamp>end)throw new Error('Coordenadas o cronología de viaje inválidas.');
      last=p.timestamp;
      if(p.speed!=null&&(!finite(p.speed)||p.speed<0||p.speed>350))throw new Error('Velocidad de viaje inválida.');
      if(p.altitude!=null&&(!finite(p.altitude)||p.altitude< -12000||p.altitude>100000))throw new Error('Altitud de viaje inválida.');
      return {latitude:p.latitude,longitude:p.longitude,timestamp:p.timestamp,altitude:p.altitude??null,speed:p.speed??null,
        accuracy:finite(p.accuracy)&&p.accuracy>=0?p.accuracy:null,break:i===0||!!p.break};
    });
    const moving=t.moving??0;
    if(!finite(moving)||moving<0||moving>t.elapsed+1)throw new Error('Tiempo en movimiento inválido.');
    const id=typeof t.id==='string'&&/^[\w.-]{1,100}$/.test(t.id)?t.id:'legacy-'+t.start;
    return {id,start:t.start,end,distance:t.distance,elapsed:t.elapsed,moving,max:t.max,points};
  };
  d.history=value.history.map(validateTrip);
  if(new Set(d.history.map(t=>t.id)).size!==d.history.length)throw new Error('Identidades de viaje duplicadas.');
  if(value.active)d.active=validateTrip(value.active);
  if(value.parking){if(!validPoint(value.parking))throw new Error('Estacionamiento inválido.');d.parking={latitude:value.parking.latitude,longitude:value.parking.longitude,timestamp:value.parking.timestamp};}
  const s=value.settings||{};
  if(['carbon','day','amber'].includes(s.theme))d.settings.theme=s.theme;
  if(['auto','high','eco','flat'].includes(s.quality))d.settings.quality=s.quality;
  if(['system','reduce'].includes(s.motion))d.settings.motion=s.motion;
  if(['kmh','mph'].includes(s.unit))d.settings.unit=s.unit;
  if(finite(s.limit)&&s.limit>=20&&s.limit<=160)d.settings.limit=s.limit;
  if(finite(s.brightness)&&s.brightness>=.6&&s.brightness<=1.3)d.settings.brightness=s.brightness;
  if(finite(s.volume)&&s.volume>=0&&s.volume<=1)d.settings.volume=s.volume;
  d.settings.sounds=s.sounds===true;
  d.safetyLock=value.safetyLock===true;
  d.updated=date(value.updated)?value.updated:0;
  return d;
}

/** Reconcile a recent compact emergency record without destroying complete traces.
 * Only the newer snapshot decides membership: deleted trips never reappear.
 * A missing overlap is represented as an explicit gap, never guessed geometry.
 */
export function recoverSnapshots(full,checkpoint){
  const a=full?validateBackup(full):null,b=checkpoint?validateBackup(checkpoint):null;
  if(!b)return a||initialData();
  if(!a||b.updated<=a.updated)return a||b;
  if(checkpoint._full===true)return b;
  const older=[...a.history,...(a.active?[a.active]:[])];
  const merge=t=>{
    const old=older.find(o=>o.id===t.id&&o.start===t.start);
    if(!old?.points.length)return t;
    if(!t.points.length)return {...t,points:old.points.filter(p=>p.timestamp<=t.end)};
    const tail=t.points,cut=tail[0].timestamp,overlap=old.points.some(p=>p.timestamp===cut);
    const head=old.points.filter(p=>p.timestamp<cut);
    const points=[...head,...tail.map((p,i)=>i===0&&head.length?{...p,break:!overlap||!!old.points.find(o=>o.timestamp===cut)?.break}:p)];
    if(points.length>3000){points.splice(0,points.length-3000);points[0].break=true;}
    return {...t,points};
  };
  b.history=b.history.map(merge);if(b.active)b.active=merge(b.active);
  return b;
}

/** Conservative UI latch, not a driving-safety device. Invalid samples reset only
 * the stationary evidence, never the existing lock. */
export class SafetyLatch {
  constructor(locked=false){this.locked=locked;this.anchor=null;this.since=null;this.last=null;}
  invalidate(){this.since=null;this.anchor=null;this.last=null;}
  push(s){
    const t=s.position?.timestamp;
    if(finite(s.speed)&&s.speed>5){this.locked=true;this.invalidate();return true;}
    if(!finite(s.speed)||!finite(t)||s.accuracy==null||s.accuracy>20){this.invalidate();return this.locked;}
    if(this.last!==null&&(t<=this.last||t-this.last>8000)){this.invalidate();}
    this.last=t;
    if(s.speed>5){this.locked=true;this.since=null;this.anchor=null;return true;}
    if(s.speed>2){this.since=null;this.anchor=null;return this.locked;}
    if(!this.anchor){this.anchor=s.position;this.since=t;}
    if(haversine(this.anchor.latitude,this.anchor.longitude,s.position.latitude,s.position.longitude)>5){this.anchor=s.position;this.since=t;}
    const required=s.source==='device'?5000:12000;
    if(t-this.since>=required)this.locked=false;
    return this.locked;
  }
}

export function parseMediaURL(input){
  let u;try{u=new URL(input.trim());}catch{throw new Error('Pegá un enlace completo de Spotify o YouTube.');}
  if(u.username||u.password||u.port)throw new Error('El enlace no debe incluir credenciales ni puertos.');
  if(u.protocol!=='https:')throw new Error('El enlace debe usar HTTPS.');
  if(u.hostname==='open.spotify.com'){
    const parts=u.pathname.split('/').filter(Boolean).filter(p=>!p.startsWith('intl-'));
    if(parts[0]==='embed')parts.shift();
    if(!['track','album','playlist','episode','show','artist'].includes(parts[0])||!/^[A-Za-z0-9]{22}$/.test(parts[1]||''))throw new Error('Enlace de Spotify no reconocido.');
    return {provider:'spotify',type:parts[0],id:parts[1],url:`https://open.spotify.com/embed/${parts[0]}/${parts[1]}?theme=0`,external:`https://open.spotify.com/${parts[0]}/${parts[1]}`};
  }
  let id;
  if(u.hostname==='youtu.be')id=u.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname))id=u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
  if(id&&/^[A-Za-z0-9_-]{11}$/.test(id))return {provider:'youtube',id,url:`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`,external:`https://www.youtube.com/watch?v=${id}`};
  throw new Error('Sólo enlaces oficiales de Spotify o YouTube.');
}
export function toGPX(points){
  let body='',open=false;
  for(const p of points){if(!validPoint(p))continue;if(p.break||!open){if(open)body+='</trkseg>';body+='<trkseg>';open=true;}body+=`<trkpt lat="${p.latitude}" lon="${p.longitude}">${finite(p.altitude)?`<ele>${p.altitude}</ele>`:''}<time>${new Date(p.timestamp).toISOString()}</time></trkpt>`;}
  if(open)body+='</trkseg>';
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="VELORA GT" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Recorrido GPS VELORA</name>${body}</trk></gpx>`;
}
export function toCSV(points){return 'timestamp,latitude,longitude,speed_kmh,altitude_m,segment_start\n'+points.filter(validPoint).map(p=>[new Date(p.timestamp).toISOString(),p.latitude,p.longitude,finite(p.speed)?p.speed:'',finite(p.altitude)?p.altitude:'',p.break?1:0].join(',')).join('\n');}
