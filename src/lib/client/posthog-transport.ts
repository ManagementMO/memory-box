import {cleanEvent} from "./product-analytics";

/** Event-only PostHog capture API. There is no background retry/batch queue to
 * outlive opt-out, and no SDK-generated URL, profile or device properties. */
export function eventTransport(token:string,host:string,identity:()=>string,request:typeof fetch=fetch){
  let active=true;
  const pending=new Set<AbortController>();
  return {
    capture(event:string,properties:Record<string,unknown>){
      if(!active||pending.size>=32)return;
      const clean=cleanEvent({event,properties:{...properties,distinct_id:identity(),is_test:false,$process_person_profile:false},uuid:crypto.randomUUID(),timestamp:new Date()});
      if(!clean)return;
      const controller=new AbortController();pending.add(controller);
      try{
        void request(new URL("/batch/",host),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",referrerPolicy:"no-referrer",keepalive:true,signal:controller.signal,body:JSON.stringify({api_key:token,batch:[clean]})}).catch(()=>{}).finally(()=>pending.delete(controller));
      }catch{pending.delete(controller);}
    },
    stop(){active=false;for(const controller of pending)controller.abort();pending.clear();},
  };
}
