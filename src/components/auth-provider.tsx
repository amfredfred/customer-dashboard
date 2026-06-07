"use client";
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

type AuthValue = { session:Session|null; loading:boolean; configured:boolean; signOut:()=>Promise<void> };
const AuthContext = createContext<AuthValue>({ session:null, loading:true, configured:false, signOut:async()=>undefined });

export function AuthProvider({ children }:{ children:React.ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [session,setSession] = useState<Session|null>(null);
  const [loading,setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false); });
    const {data} = supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return () => data.subscription.unsubscribe();
  },[supabase]);
  return <AuthContext.Provider value={{session,loading,configured:Boolean(supabase),signOut:async()=>{await supabase?.auth.signOut();}}}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
