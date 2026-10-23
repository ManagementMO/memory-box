"use client";
import {useState} from "react";
import {disableMeasurement,measurementDisabled} from "@/lib/client/posthog-client";

export function MeasurementSettings(){
  // This panel mounts after a client interaction. Read the preference on that
  // first render so a provisional unchecked state cannot swallow a fast tap.
  const [disabled,setDisabled]=useState(measurementDisabled),[changed,setChanged]=useState(false);
  return <div className="measurement-settings"><label><input type="checkbox" checked={!disabled} onChange={event=>{const off=!event.currentTarget.checked;disableMeasurement(off);setDisabled(off);setChanged(true);}}/><span>Help improve the canvas</span></label><p className="fine-print">PostHog measures visits and saved contributions. No story text, photos, searches or recordings.</p>{changed?<p className="fine-print" role="status">{disabled?"Measurement is off.":"Measurement will resume when you reload, unless your browser requests privacy."}</p>:null}</div>;
}
