"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type Payment={member_name:string;phone:string|null;payment_channel:string|null;amount_tzs:number;merchant_reference:string;provider_reference:string|null;status:string;created_at:string};
type Report={report_id:string;reporter_name:string;reported_name:string;reason:string;details:string|null;status:string;created_at:string};

export default function AdminPage(){
 const [supabase]=useState(()=>{try{return getSupabase()}catch{return null}});
 const [summary,setSummary]=useState<Record<string,number>|null>(null);
 const [payments,setPayments]=useState<Payment[]>([]);
 const [reports,setReports]=useState<Report[]>([]);
 const [notice,setNotice]=useState("Checking administrator access…");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{if(!supabase)return;let alive=true;(async()=>{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){setNotice("Sign in with the administrator account first.");return;}
   const {data:s,error}=await supabase.rpc("admin_dashboard_summary");
   if(error){setNotice(error.message+" — apply the Tukutane feature SQL migration and sign in as the configured admin.");return;}
   const [p,r]=await Promise.all([supabase.rpc("admin_recent_payments"),supabase.rpc("admin_open_reports")]);
   if(!alive)return;
   setSummary(s as Record<string,number>);
   if(!p.error)setPayments((p.data||[]) as Payment[]);
   if(!r.error)setReports((r.data||[]) as Report[]);
   setNotice("");
 })();return()=>{alive=false}},[supabase]);
 async function updateReport(id:string,status:string){if(!supabase)return;setBusy(true);const {error}=await supabase.rpc("admin_update_report",{target_report:id,new_status:status});if(error)setNotice(error.message);else setReports(old=>old.map(x=>x.report_id===id?{...x,status}:x));setBusy(false);}
 const money=(n:number)=>new Intl.NumberFormat("en-TZ",{style:"currency",currency:"TZS",maximumFractionDigits:0}).format(n||0);
 return <main className="shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">T</span><span>Tukutane <b>Chimbo</b></span></Link><Link href="/" className="button button-quiet">Back</Link></header>
 <section className="panel" style={{marginTop:24}}><span className="eyebrow">RESTRICTED · ADMIN</span><h2>Administration</h2>{notice&&<p className="notice">{notice}</p>}
 {summary&&<><div className="admin-stats"><div><small>Members</small><b>{summary.members}</b></div><div><small>Completed profiles</small><b>{summary.completed_profiles}</b></div><div><small>Verified revenue</small><b>{money(summary.successful_revenue_tzs)}</b></div><div><small>Pending payments</small><b>{summary.pending_payments}</b></div><div><small>Open reports</small><b>{summary.open_reports}</b></div></div>
 <h3>Payment transactions</h3><div className="table-scroll"><table><thead><tr><th>Member</th><th>Phone</th><th>Channel</th><th>Amount</th><th>Reference</th><th>Status</th></tr></thead><tbody>{payments.map((p,i)=><tr key={p.merchant_reference+i}><td>{p.member_name}</td><td>{p.phone||"—"}</td><td>{p.payment_channel||"—"}</td><td>{money(p.amount_tzs)}</td><td>{p.merchant_reference}</td><td>{p.status}</td></tr>)}</tbody></table></div>
 <h3>Member reports</h3>{reports.length?reports.map(r=><article className="report-card" key={r.report_id}><b>{r.reported_name}</b><span>Reported by {r.reporter_name} · {r.reason}</span><p>{r.details||"No extra details"}</p><div className="chat-actions"><span>{r.status}</span><button className="button button-quiet" disabled={busy} onClick={()=>updateReport(r.report_id,"reviewing")}>Review</button><button className="button button-quiet" disabled={busy} onClick={()=>updateReport(r.report_id,"resolved")}>Resolve</button><button className="button button-quiet" disabled={busy} onClick={()=>updateReport(r.report_id,"dismissed")}>Dismiss</button></div></article>):<p className="muted">No reports found.</p>}
 <p className="muted">Withdrawals are not enabled until AzamPay disbursement credentials and verified settlement details are configured. This dashboard only counts transactions marked successful by a trusted server.</p></>}
 </section></main>;
}
