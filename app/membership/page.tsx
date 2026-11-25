"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export default function MembershipPage(){
 const [supabase]=useState(()=>{try{return getSupabase()}catch{return null}});
 const [status,setStatus]=useState("Checking membership…");
 const [membership,setMembership]=useState<{status:string;ends_at:string|null}|null>(null);
 useEffect(()=>{if(!supabase)return;void(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){setStatus("Sign in to view your membership.");return;}const {data,error}=await supabase.from("memberships").select("status,ends_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error){setStatus("Membership database is not ready: "+error.message);return;}setMembership(data);setStatus(data?"":"No membership yet.");})();},[supabase]);
 return <main className="shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">T</span><span>Tukutane <b>Chimbo</b></span></Link><Link className="button button-quiet" href="/">Back</Link></header><section className="panel" style={{marginTop:24}}><span className="eyebrow">MEMBERSHIP</span><h2>30-day membership</h2><p className="membership-price">TZS 1,000 <small>/ 30 days</small></p><p>{status}</p>{membership&&<p>Current status: <b>{membership.status}</b>{membership.ends_at?" · Expires "+new Date(membership.ends_at).toLocaleDateString():""}</p>}<div className="notice">AzamPay sandbox checkout is not enabled yet. The secure merchant API credentials and callback details are required before this app can create a real payment request. No payment has been taken and no membership is activated on this screen.</div><p className="muted">Once AzamPay sandbox credentials are installed on the server, the payment flow will create a pending transaction, redirect to the provider, verify the callback server-side, and activate the 30-day membership only after confirmed payment.</p></section></main>;
}
