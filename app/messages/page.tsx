"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type Conversation = { conversation_id: string; other_user_id: string; other_display_name: string; last_message: string | null; last_message_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; read_at: string | null };

export default function MessagesPage() {
  const router = useRouter();
  const [supabase] = useState(() => { try { return getSupabase(); } catch { return null; } });
  const [userId,setUserId] = useState("");
  const [items,setItems] = useState<Conversation[]>([]);
  const [active,setActive] = useState<Conversation|null>(null);
  const [messages,setMessages] = useState<Message[]>([]);
  const [body,setBody] = useState("");
  const [reportReason,setReportReason] = useState("Inappropriate behaviour");
  const [reportDetails,setReportDetails] = useState("");
  const [notice,setNotice] = useState("Loading messages…");
  const [busy,setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function refreshConversations() {
    if (!supabase) return;
    const {data,error}=await supabase.rpc("list_my_conversations");
    if(error){setNotice("Messaging setup is incomplete. Apply the Tukutane feature SQL migration in Supabase.");return;}
    const rows=(data||[]) as Conversation[];
    setItems(rows);
    if(active){const found=rows.find(x=>x.conversation_id===active.conversation_id);if(found)setActive(found);}
    if(!active && rows.length) setActive(rows[0]);
    setNotice(rows.length?"":"No conversations yet. Open a member profile and choose Message.");
  }

  useEffect(() => {
    if(!supabase)return;
    let alive=true;
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){router.replace("/");return;}
      if(!alive)return;
      setUserId(user.id);
      const target=new URLSearchParams(window.location.search).get("with");
      if(target){
        const {data,error}=await supabase.rpc("start_conversation",{target_user:target});
        if(error){setNotice(error.message);return;}
        const {data:rows}=await supabase.rpc("list_my_conversations");
        const list=(rows||[]) as Conversation[];
        if(alive){setItems(list);setActive(list.find(x=>x.conversation_id===data)||null);}
        router.replace("/messages");
      } else await refreshConversations();
    })();
    return()=>{alive=false;};
  },[supabase,router]);

  useEffect(()=>{
    if(!supabase||!active)return;
    let alive=true;
    const load=async()=>{
      const {data,error}=await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,read_at").eq("conversation_id",active.conversation_id).order("created_at",{ascending:true}).limit(200);
      if(error){setNotice(error.message);return;}
      if(alive){setMessages((data||[]) as Message[]);setNotice("");}
    };
    void load();
    const channel=supabase.channel("chat-"+active.conversation_id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+active.conversation_id},payload=>{
        const incoming=payload.new as Message;
        setMessages(old=>old.some(m=>m.id===incoming.id)?old:[...old,incoming]);
      }).subscribe();
    return()=>{alive=false;void supabase.removeChannel(channel);};
  },[supabase,active?.conversation_id]);

  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  async function sendMessage(e:React.FormEvent){
    e.preventDefault(); if(!supabase||!active||!body.trim()||busy)return;
    setBusy(true);
    const {error}=await supabase.from("messages").insert({conversation_id:active.conversation_id,sender_id:userId,body:body.trim()});
    if(error)setNotice(error.message);else setBody("");
    setBusy(false);
  }

  async function blockMember(){
    if(!supabase||!active||!window.confirm("Block this member? They will no longer be able to start or continue a conversation with you."))return;
    const {error}=await supabase.from("user_blocks").insert({blocker_id:userId,blocked_id:active.other_user_id});
    if(error){setNotice(error.message);return;}
    setActive(null);setMessages([]);await refreshConversations();setNotice("Member blocked.");
  }

  async function reportMember(e:React.FormEvent){
    e.preventDefault();if(!supabase||!active)return;
    const {error}=await supabase.from("user_reports").insert({reporter_id:userId,reported_user_id:active.other_user_id,reason:reportReason,details:reportDetails.trim()||null});
    if(error)setNotice(error.message);else{setReportDetails("");setNotice("Report submitted to the moderation team.");}
  }

  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">T</span><span>Tukutane <b>Chimbo</b></span></Link><Link className="button button-quiet" href="/">Back to community</Link></header>
    <section className="panel" style={{marginTop:24}}>
      <div className="section-heading"><div><span className="eyebrow">PRIVATE CHAT</span><h2>Messages</h2></div><span className="count">{items.length}</span></div>
      {notice&&<p className="notice">{notice}</p>}
      <div className="chat-layout">
        <aside className="chat-list">{items.map(item=><button key={item.conversation_id} className={"chat-person "+(active?.conversation_id===item.conversation_id?"selected":"")} onClick={()=>setActive(item)}><b>{item.other_display_name}</b><span>{item.last_message||"Start a conversation"}</span></button>)}</aside>
        <section className="chat-window">
          {active?<><div className="chat-heading"><b>{active.other_display_name}</b><div className="chat-actions"><button className="button button-quiet" onClick={blockMember}>Block</button></div></div>
            <div className="message-list">{messages.map(m=><div key={m.id} className={"bubble "+(m.sender_id===userId?"mine":"theirs")}><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()}</small></div>)}<div ref={bottom}/></div>
            <form className="chat-compose" onSubmit={sendMessage}><input value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a message…" maxLength={5000}/><button className="button button-primary" disabled={busy||!body.trim()}>Send</button></form>
            <form className="report-form" onSubmit={reportMember}><details><summary>Report this member</summary><select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option>Inappropriate behaviour</option><option>Harassment</option><option>Fake profile</option><option>Scam or financial request</option><option>Other safety concern</option></select><textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Additional details (optional)" rows={2}/><button className="button button-quiet">Submit report</button></details></form>
          </>:<p className="muted">Choose a conversation to view messages.</p>}
        </section>
      </div>
    </section>
  </main>;
}
