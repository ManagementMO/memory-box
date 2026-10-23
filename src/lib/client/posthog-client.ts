import {allowedAnalytics,ANALYTICS_KEY,FLAG_KEY,isArrivalVariant,OPT_OUT_KEY,parseAnalyticsState,ProductAnalytics,visitState,type AnalyticsState} from "./product-analytics";
import type {ArrivalSource,ArrivalVariant} from "./canvas-arrival";
import {eventTransport} from "./posthog-transport";

export interface ArrivalSelection{variant:ArrivalVariant|null;source:"experiment"|"qa"|"default"}
let boot:Promise<ArrivalSelection>|undefined;
let tracker:ProductAnalytics|undefined;
let stop:()=>void=()=>{};
let disabled=false;

const fallback:ArrivalSelection={variant:null,source:"default"};
export function measurementDisabled(){
  if(typeof window==="undefined")return true;
  try{return disabled||localStorage.getItem(OPT_OUT_KEY)==="1"||navigator.doNotTrack==="1"||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true;}catch{return true;}
}
export function disableMeasurement(value:boolean){
  disabled=value;
  try{if(value){localStorage.setItem(OPT_OUT_KEY,"1");localStorage.removeItem(ANALYTICS_KEY);}else localStorage.removeItem(OPT_OUT_KEY);}catch{/* Preference can remain tab-local. */}
  if(value){tracker=undefined;stop();}
  // Re-enabling takes effect on reload, without changing the present camera.
}
const safely=(action:(value:ProductAnalytics)=>void)=>{if(!measurementDisabled()&&tracker)try{action(tracker);}catch{/* Analytics are optional. */}};
export const measurement={
  arrived:(variant:ArrivalVariant|null,source:ArrivalSource)=>{
    const record=()=>safely(value=>{value.firstVisit();value.arrived(variant,source);});
    if(typeof navigator!=="undefined"&&navigator.locks)void navigator.locks.request(ANALYTICS_KEY,record).catch(()=>{});
    else record();
  },
  contribution:(...args:Parameters<ProductAnalytics["contribution"]>)=>safely(value=>value.contribution(...args)),
  opened:(...args:Parameters<ProductAnalytics["opened"]>)=>safely(value=>value.opened(...args)),
  explored:(...args:Parameters<ProductAnalytics["explored"]>)=>safely(value=>value.explored(...args)),
  shared:(...args:Parameters<ProductAnalytics["shared"]>)=>safely(value=>value.shared(...args)),
};

export function initializeMeasurement():Promise<ArrivalSelection>{
  if(boot)return boot;
  const qa=new URLSearchParams(window.location.search).get("arrival");
  if(isArrivalVariant(qa))return boot=Promise.resolve({variant:qa,source:"qa"});
  const token=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN??"";
  if(!allowedAnalytics({host:window.location.hostname,canonicalHost:process.env.NEXT_PUBLIC_ANALYTICS_HOST??"memory-box-commons.vercel.app",token,automated:navigator.webdriver,qa:false,optOut:measurementDisabled(),dnt:navigator.doNotTrack==="1",gpc:(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true}))return boot=Promise.resolve(fallback);
  // A single deadline includes both SDK download and the flag request. Even a
  // blocked import cannot hold the canvas indefinitely.
  boot=new Promise(resolve=>{
    let settled=false,pauseFlags=()=>{};
    const finish=(selection:ArrivalSelection)=>{if(settled)return;settled=true;clearTimeout(deadline);pauseFlags();resolve(selection);};
    const deadline=setTimeout(()=>finish(fallback),1000);
    void (async()=>{
      try{
        // Storage must work before assigning a persistent experiment identity.
        localStorage.setItem("memory-box:measurement-check","1");localStorage.removeItem("memory-box:measurement-check");
        const {default:posthog}=await import("posthog-js/dist/module.no-external");
        if(settled||measurementDisabled())return finish(fallback);
        const start=()=>{
          // The lock may be queued beyond the arrival deadline or an opt-out.
          // Recheck inside it before creating any identity or session state.
          if(settled||measurementDisabled())return null;
          const prior=parseAnalyticsState(localStorage.getItem(ANALYTICS_KEY),Date.now());
          const visit=visitState(prior,Date.now(),()=>crypto.randomUUID());
          localStorage.setItem(ANALYTICS_KEY,JSON.stringify(visit.state));
          return {prior,visit};
        };
        const started=navigator.locks?await navigator.locks.request(ANALYTICS_KEY,start):start();
        if(!started||settled||measurementDisabled())return finish(fallback);
        const {prior,visit}=started;
        let current=visit.state;
        const read=()=>parseAnalyticsState(localStorage.getItem(ANALYTICS_KEY),Date.now())??current;
        const write=(value:AnalyticsState)=>{current=value;try{localStorage.setItem(ANALYTICS_KEY,JSON.stringify(value));}catch{/* Keep the current session usable. */}};
        write(current);
        posthog.init(token,{
          api_host:process.env.NEXT_PUBLIC_POSTHOG_HOST??"https://us.i.posthog.com",ui_host:"https://us.posthog.com",
          defaults:"2026-08-30",bootstrap:{distinctID:current.id,isIdentifiedID:false},
          persistence:"memory",person_profiles:"never",autocapture:false,capture_pageview:false,capture_pageleave:false,
          capture_dead_clicks:false,capture_exceptions:false,capture_heatmaps:false,capture_performance:false,
          disable_conversations:true,disable_product_tours:true,disable_web_experiments:true,opt_in_site_apps:false,
          disable_session_recording:true,disable_surveys:true,disable_external_dependency_loading:true,
          save_referrer:false,save_campaign_params:false,ip:false,respect_dnt:true,advanced_disable_toolbar_metrics:true,
          flag_keys:[FLAG_KEY],remote_config_refresh_interval_ms:0,feature_flag_request_max_retries:0,
          advanced_disable_feature_flags_on_first_load:!!prior,
          // All event delivery uses our explicit, cancellable allowlisted
          // transport. SDK automatic events never enter the capture path.
          before_send:()=>null,
        });
        pauseFlags=()=>posthog.set_config({advanced_disable_flags:true,remote_config_refresh_interval_ms:0});
        const transport=eventTransport(token,process.env.NEXT_PUBLIC_POSTHOG_HOST??"https://us.i.posthog.com",()=>read().id);
        stop=()=>{pauseFlags();transport.stop();};
        tracker=new ProductAnalytics({capture:transport.capture,getVariant:()=>posthog.getFeatureFlag(FLAG_KEY,{send_event:false})},read,write);
        // A visit is reported by the visible canvas, not by SDK initialization.
        let lastTouch=0;
        const activity=()=>{if(document.visibilityState==="visible"&&Date.now()-lastTouch>=1000){lastTouch=Date.now();safely(value=>value.touch());}};
        window.addEventListener("pointerdown",activity,{passive:true,capture:true});window.addEventListener("keydown",activity,{capture:true});
        const preference=(event:StorageEvent)=>{if(event.key===OPT_OUT_KEY&&event.newValue==="1")disableMeasurement(true);};
        window.addEventListener("storage",preference);
        const originalStop=stop;stop=()=>{originalStop();window.removeEventListener("pointerdown",activity,true);window.removeEventListener("keydown",activity,true);window.removeEventListener("storage",preference);};
        if(prior)return finish(fallback);
        const unsubscribe=posthog.onFeatureFlags((_flags,variants,context)=>{
          const variant=variants[FLAG_KEY];
          if(context?.errorsLoading||!isArrivalVariant(variant))finish(fallback);
          else finish({variant,source:"experiment"});
        });
        // Do not keep listeners or flag work alive after the arrival deadline.
        void boot?.then(()=>unsubscribe());
      }catch{finish(fallback);}
    })();
  });
  return boot;
}
