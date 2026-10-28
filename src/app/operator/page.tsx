import type {Metadata} from "next";
import {OperatorReview} from "@/components/operator-review";

export const metadata:Metadata={title:"Operator review · Memory Box",robots:{index:false,follow:false}};

/** This public shell contains no report data. Every data request authenticates server-side. */
export default function OperatorPage(){return <OperatorReview/>;}
