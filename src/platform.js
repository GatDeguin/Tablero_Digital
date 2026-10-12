/** Lifecycle adapter. Request completion cannot resurrect a revoked user intent. */
class ScreenWake {
  constructor(api,isVisible,onChange){this.api=api;this.visible=isVisible;this.changed=onChange;this.wanted=false;this.sentinel=null;this.pending=null;this.epoch=0;this.error='';}
  report(){this.changed({wanted:this.wanted,held:!!this.sentinel&&!this.sentinel.released,pending:!!this.pending,error:this.error});}
  async setWanted(wanted){
    this.wanted=wanted;this.epoch++;this.error='';
    if(!wanted){const old=this.sentinel;this.sentinel=null;this.report();try{await old?.release();}catch{}return;}
    await this.refresh();
  }
  async refresh(){
    if(!this.wanted||!this.visible()||this.sentinel&&!this.sentinel.released)return;
    if(this.pending)return this.pending;
    if(!this.api){this.wanted=false;this.error='El navegador no ofrece pantalla activa.';this.report();return;}
    const ticket=this.epoch;
    this.pending=Promise.resolve().then(async()=>{
      try{
        if(!this.wanted||ticket!==this.epoch||!this.visible())return;
        const s=await this.api.request('screen');
        if(!this.wanted||ticket!==this.epoch||!this.visible()){await s.release();return;}
        this.sentinel=s;this.error='';
        s.addEventListener('release',()=>{if(this.sentinel===s){this.sentinel=null;this.report();}},{once:true});
      }catch(e){if(ticket===this.epoch)this.error=e.message||'Solicitud rechazada.';}
      finally{this.pending=null;this.report();}
    });
    this.report();await this.pending;
    if(this.wanted&&ticket!==this.epoch&&this.visible())await this.refresh();
  }
}
