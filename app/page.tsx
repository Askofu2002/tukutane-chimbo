"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Lang = "en" | "sw";
type Profile = {
  id: string; display_name: string | null; phone: string | null; gender: string | null;
  region: string | null; bio: string | null; registration_complete: boolean;
};
const copy = {
  en: {
    tagline: "Meet. Connect. Make it meaningful.", welcome: "Find your person, your way.",
    login: "Log in", signup: "Create account", email: "Email address", password: "Password",
    name: "Display name", phone: "Phone number", gender: "Gender", female: "Female",
    male: "Male", region: "Region", bio: "About you",
    photos: "Upload exactly 3 profile photos", finish: "Save profile", logout: "Log out",
    members: "Community", account: "Your profile", signed: "Signed in as",
    needPhotos: "Female profiles need exactly 3 photos to complete registration.",
    saved: "Profile saved.", authError: "Please check your details and try again.",
    setup: "Supabase is not configured. Add the environment variables shown in README.",
    empty: "No other completed profiles are available yet.",
    note: "Be respectful. Block or report anyone who makes you feel unsafe.",
    loading: "Loading…", pending: "Email confirmation may be required before you can sign in."
  },
  sw: {
    tagline: "Kutana. Ungana. Jenga mahusiano yenye maana.", welcome: "Tafuta mtu wako kwa namna yako.",
    login: "Ingia", signup: "Fungua akaunti", email: "Barua pepe", password: "Nenosiri",
    name: "Jina la kuonekana", phone: "Namba ya simu", gender: "Jinsia", female: "Mwanamke",
    male: "Mwanaume", region: "Mkoa", bio: "Kuhusu wewe",
    photos: "Pakia picha 3 za wasifu tu", finish: "Hifadhi wasifu", logout: "Toka",
    members: "Jumuiya", account: "Wasifu wako", signed: "Umeingia kama",
    needPhotos: "Wasifu wa mwanamke unahitaji picha 3 kamili ili kukamilisha usajili.",
    saved: "Wasifu umehifadhiwa.", authError: "Tafadhali hakiki taarifa zako ujaribu tena.",
    setup: "Supabase haijaunganishwa. Weka mipangilio iliyoelezwa kwenye README.",
    empty: "Bado hakuna wasifu mwingine uliokamilika.",
    note: "Heshimiana. Mzuie au mripoti mtu anayekufanya ujisikie si salama.",
    loading: "Inapakia…", pending: "Huenda uthibitisho wa barua pepe ukahitajika kabla ya kuingia."
  }
};
const regions = ["Arusha","Dar es Salaam","Dodoma","Geita","Iringa","Kagera","Katavi","Kigoma","Kilimanjaro","Lindi","Manyara","Mara","Mbeya","Morogoro","Mtwara","Mwanza","Njombe","Pwani","Rukwa","Ruvuma","Shinyanga","Simiyu","Singida","Songwe","Tabora","Tanga","Zanzibar"];

export default function Home() {
  const [lang, setLang] = useState<Lang>("sw");
  const t = copy[lang];
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("female");
  const [region, setRegion] = useState("Dar es Salaam");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => {
    try { return getSupabase(); } catch { return null; }
  }, []);
  const configured = supabase !== null;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) { setProfile(null); setMembers([]); return; }
    let alive = true;
    async function load() {
      const { data } = await supabase!.rpc("get_my_profile");
      const ownProfile = (Array.isArray(data) ? data[0] : data) as Profile | null;
      if (alive) { const current = ownProfile; setProfile(current); if (current) { setName(current.display_name || ""); setPhone(current.phone || ""); setGender(current.gender || "female"); setRegion(current.region || "Dar es Salaam"); setBio(current.bio || ""); } }
      const { count: photoCount } = await supabase!.from("profile_photos").select("id", { count: "exact", head: true }).eq("user_id", user!.id);
      if (alive) setExistingPhotos(photoCount || 0);
      const { data: people } = await supabase!.from("profiles").select("id,display_name,gender,region,bio,registration_complete").eq("registration_complete", true).neq("id", user!.id).limit(40);
      if (alive && people) setMembers(people as Profile[]);
    }
    void load();
    return () => { alive = false; };
  }, [supabase, user]);

  async function authenticate() {
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim(), phone: phone.trim(), gender, region, bio: bio.trim(), language: lang } }
        });
        if (error) throw error;
        if (data.session) setUser(data.session.user);
        else setMessage(t.pending);
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : t.authError); }
    finally { setBusy(false); }
  }

  async function requestPasswordReset() {
    if (!supabase || !email.trim()) { setMessage("Enter your account email first."); return; }
    setBusy(true); setMessage("");
    try {
      const redirectTo = window.location.origin + "/?reset=1";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setMessage("Password reset email sent. Open the link in your email to choose a new password.");
    } catch (e) { setMessage(e instanceof Error ? e.message : t.authError); }
    finally { setBusy(false); }
  }

  async function updateRecoveredPassword() {
    if (!supabase || newPassword.length < 8) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setRecoveryMode(false); setNewPassword("");
      setMessage("Password updated successfully. You are now signed in.");
    } catch (e) { setMessage(e instanceof Error ? e.message : t.authError); }
    finally { setBusy(false); }
  }

  async function saveProfile() {
    if (!supabase || !user) return;
    setBusy(true); setMessage("");
    try {
      const { count: existingPhotoCount, error: photoCountError } = await supabase.from("profile_photos").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (photoCountError) throw photoCountError;
      if (gender === "female" && (existingPhotoCount || 0) > 3) throw new Error("Your account has more than 3 profile photos. Contact support to correct them.");
      if (gender === "female" && photos.length > 0 && photos.length !== Math.max(0, 3 - (existingPhotoCount || 0))) throw new Error("Upload exactly the remaining " + Math.max(0, 3 - (existingPhotoCount || 0)) + " photos.");
      const { error: updateError } = await supabase.rpc("save_my_profile", {
        p_display_name: name.trim() || profile?.display_name || user.user_metadata?.display_name || "",
        p_phone: phone.trim() || profile?.phone || user.user_metadata?.phone || null,
        p_gender: gender, p_region: region, p_bio: bio.trim(), p_language: lang
      });
      if (updateError) throw updateError;
      if (photos.length) {
        for (let i = 0; i < photos.length; i++) {
          const file = photos[i];
          if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
            throw new Error("Use JPG, PNG or WEBP images under 5 MB each.");
          }
          const path = user.id + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: false });
          if (uploadError) throw uploadError;
          const { error: rowError } = await supabase.from("profile_photos").insert({ user_id: user.id, storage_path: path, position: (existingPhotoCount || 0) + i + 1 });
          if (rowError) throw rowError;
        }
      }
      const { data: ownProfile, error: refreshError } = await supabase.rpc("get_my_profile");
      const refreshed = (Array.isArray(ownProfile) ? ownProfile[0] : ownProfile) as Profile | null;
      setProfile(refreshed || {
        id: user.id,
        display_name: name.trim() || profile?.display_name || user.user_metadata?.display_name || null,
        phone: phone.trim() || profile?.phone || user.user_metadata?.phone || null,
        gender, region, bio: bio.trim(), registration_complete: profile?.registration_complete || false
      });
      const { count: finalPhotoCount } = await supabase.from("profile_photos").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      setExistingPhotos(finalPhotoCount ?? (existingPhotoCount || 0) + photos.length);
      setPhotos([]);
      setMessage(refreshError ? (t.saved + " Please refresh to reload your profile status.") : t.saved);
    } catch (e) { const detail = e && typeof e === "object" && "message" in e ? String((e as {message: unknown}).message) : e instanceof Error ? e.message : t.authError; setMessage(detail || t.authError); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setProfile(null);
  }

  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">T</span><span>Tukutane <b>Chimbo</b></span></a>
      <div className="top-actions">
        <button className="lang" onClick={() => setLang(lang === "sw" ? "en" : "sw")}>{lang === "sw" ? "EN" : "SW"}</button>
        {user && <><a className="button button-quiet" href="/messages">Messages</a><a className="button button-quiet" href="/membership">Membership</a>{user.email?.toLowerCase() === "askofutza41@gmail.com" && <a className="button button-quiet" href="/admin">Admin</a>}<button className="button button-quiet" onClick={logout}>{t.logout}</button></>}
      </div>
    </header>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">TUKUTANE CHIMBO · TANZANIA</span><h1>{t.welcome}</h1><p>{t.tagline}</p></div>
      <div className="hero-orb" aria-hidden="true"><span>♥</span></div>
    </section>
    {!configured && <div className="notice error">{t.setup}</div>}
    {message && <div className="notice">{message}</div>}
    {recoveryMode ? <section className="panel auth-panel"><div className="section-heading"><div><span className="eyebrow">ACCOUNT SECURITY</span><h2>Set a new password</h2></div></div><label className="wide">New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button className="button button-primary full" disabled={busy || newPassword.length < 8} onClick={updateRecoveredPassword}>{busy ? t.loading : "Update password"}</button></section> : !user ? <section className="panel auth-panel">
      <div className="section-heading"><div><span className="eyebrow">KARIBU / WELCOME</span><h2>{mode === "signup" ? t.signup : t.login}</h2></div></div>
      <div className="tabs"><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>{t.signup}</button><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{t.login}</button></div>
      <div className="form-grid">
        {mode === "signup" && <>
          <label>{t.name}<input value={name} onChange={e => setName(e.target.value)} required /></label>
          <label>{t.phone}<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+255…" /></label>
          <label>{t.gender}<select value={gender} onChange={e => setGender(e.target.value)}><option value="female">{t.female}</option><option value="male">{t.male}</option></select></label>
          <label>{t.region}<select value={region} onChange={e => setRegion(e.target.value)}>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
          <label className="wide">{t.bio}<textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={500} /></label>
        </>}
        <label className="wide">{t.email}<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="wide">{t.password}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
      </div>
      <button className="button button-primary full" disabled={busy || !configured || !email || password.length < 8 || (mode === "signup" && !name.trim())} onClick={authenticate}>{busy ? t.loading : mode === "signup" ? t.signup : t.login}</button>
      {mode === "login" && <button type="button" className="button button-quiet full" disabled={busy || !email.trim()} onClick={requestPasswordReset}>Forgot password? Send reset email</button>}
      <p className="muted">{t.pending}</p>
    </section> : <div className="content-grid">
      <section className="panel profile-panel">
        <div className="section-heading"><div><span className="eyebrow">{t.account}</span><h2>{profile?.display_name || user.email}</h2></div><span className={profile?.registration_complete ? "status good" : "status"}>{profile?.registration_complete ? "Complete" : "Incomplete"}</span></div>
        <p className="muted">{t.signed}: {user.email}</p>
        <div className="form-grid">
          <label>{t.name}<input value={name || profile?.display_name || ""} onChange={e => setName(e.target.value)} /></label>
          <label>{t.phone}<input value={phone || profile?.phone || ""} onChange={e => setPhone(e.target.value)} /></label>
          <label>{t.gender}<select value={gender} onChange={e => setGender(e.target.value)}><option value="female">{t.female}</option><option value="male">{t.male}</option></select></label>
          <label>{t.region}<select value={region} onChange={e => setRegion(e.target.value)}>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
          <label className="wide">{t.bio}<textarea value={bio || profile?.bio || ""} onChange={e => setBio(e.target.value)} rows={3} maxLength={500} /></label>
          {gender === "female" && <label className="wide">{t.photos}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => setPhotos(Array.from(e.target.files || []).slice(0,Math.max(0,3-existingPhotos)))} /><small>{existingPhotos}/3 uploaded · {photos.length} selected · Max 5 MB each</small></label>}
        </div>
        <button className="button button-primary full" disabled={busy} onClick={saveProfile}>{busy ? t.loading : t.finish}</button>
      </section>
      <section className="panel community-panel"><div className="section-heading"><div><span className="eyebrow">{t.members}</span><h2>{t.members}</h2></div><span className="count">{members.length}</span></div>
        {members.length === 0 ? <p className="muted">{t.empty}</p> : <div className="member-list">{members.map(member => <article className="member" key={member.id}><div className="avatar">{(member.display_name || "?").slice(0,1).toUpperCase()}</div><div><b>{member.display_name || "Member"}</b><span>{member.region || "Tanzania"} · {member.gender || ""}</span><p>{member.bio || ""}</p><a className="button button-quiet" href={"/messages?with=" + member.id}>Message</a></div></article>)}</div>}
        <p className="safety-note">{t.note}</p>
      </section>
    </div>}
    <footer><span>© {new Date().getFullYear()} Tukutane Chimbo</span><span>Made for Tanzania 🇹🇿</span></footer>
  </main>;
}