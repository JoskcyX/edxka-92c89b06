import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Plus, Radio, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/class/$classId")({
  head: () => ({
    meta: [
      { title: "Class control room — EDxKa" },
      { name: "description", content: "Approve students, share resources and push quizzes to your class." },
      { property: "og:title", content: "Class control room — EDxKa" },
      { property: "og:description", content: "Manage your EDxKa class." },
    ],
  }),
  component: ClassRoom,
});

function toLocalInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ClassRoom() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["class", classId] });

  const cls = useQuery({
    queryKey: ["class", classId, "info"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("id", classId).single();
      if (error) throw error;
      return data;
    },
  });
  const members = useQuery({
    queryKey: ["class", classId, "members"],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("class_members").select("*").eq("class_id", classId).order("joined_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const resources = useQuery({
    queryKey: ["class", classId, "resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_resources").select("*").eq("class_id", classId).order("order_index");
      if (error) throw error;
      return data;
    },
  });
  const linked = useQuery({
    queryKey: ["class", classId, "quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_quizzes").select("id, mode, pushed_at, quiz_id, quizzes(id, title, join_code, status, opens_at, closes_at)").eq("class_id", classId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const myQuizzes = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("id, title, join_code, status").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("class_members").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  const [rTitle, setRTitle] = useState("");
  const [rKind, setRKind] = useState<"link" | "note" | "video">("link");
  const [rUrl, setRUrl] = useState("");
  const [rBody, setRBody] = useState("");
  const addResource = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_resources").insert({
        class_id: classId, title: rTitle.trim(), kind: rKind, url: rUrl.trim() || null, body: rBody.trim(),
        order_index: resources.data?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { setRTitle(""); setRUrl(""); setRBody(""); inv(); toast.success("Resource added"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delResource = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("class_resources").delete().eq("id", id); if (error) throw error; },
    onSuccess: inv,
  });

  const [pick, setPick] = useState("");
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const addAsync = useMutation({
    mutationFn: async () => {
      if (!pick) throw new Error("Pick a quiz");
      const { error: e1 } = await supabase.from("quizzes").update({
        opens_at: opens ? new Date(opens).toISOString() : null,
        closes_at: closes ? new Date(closes).toISOString() : null,
        status: "live",
      }).eq("id", pick);
      if (e1) throw e1;
      const { error } = await supabase.from("class_quizzes").upsert({ class_id: classId, quiz_id: pick, mode: "async" }, { onConflict: "class_id,quiz_id" });
      if (error) throw error;
    },
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ["quizzes"] }); toast.success("Quiz published to class"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const push = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase.rpc("push_class_quiz", { _class_id: classId, _quiz_id: quizId });
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Pop quiz sent to your class!"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const unpublish = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase.from("quizzes").update({ status: "ended" }).eq("id", quizId);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Quiz closed"); },
  });

  if (cls.isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!cls.data) return <div className="p-10">Class not found.</div>;

  const link = typeof window !== "undefined" ? `${window.location.origin}/class/${cls.data.join_code}` : "";
  const pending = members.data?.filter((m) => m.status === "pending") ?? [];
  const approved = members.data?.filter((m) => m.status === "approved") ?? [];

  return (
    <div className="min-h-screen confetti-bg">
      <main className="mx-auto max-w-5xl px-6 py-8 pb-24">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"><ArrowLeft className="size-4" /> Dashboard</Link>
        <h1 className="mt-3 text-4xl font-bold">{cls.data.title}</h1>
        <div className="surface-card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-sm text-muted-foreground">Class code</p><p className="text-2xl font-bold tracking-widest">{cls.data.join_code}</p></div>
          <Button variant="outline" className="rounded-full border-2 font-bold" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}>
            <Copy className="size-4" /> Copy join link
          </Button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-2xl font-bold">Join requests ({pending.length})</h2>
            <div className="mt-3 grid gap-2">
              {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
              {pending.map((m) => (
                <div key={m.id} className="surface-card flex items-center justify-between gap-2 p-3">
                  <div><p className="font-bold">{m.name}</p><p className="text-xs text-muted-foreground">{m.phone}</p></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setStatus.mutate({ id: m.id, status: "approved" })}><Check className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: m.id, status: "rejected" })}><X className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <h2 className="mt-8 text-2xl font-bold">Roster ({approved.length})</h2>
            <div className="mt-3 grid gap-2">
              {approved.map((m) => (
                <div key={m.id} className="surface-card flex items-center justify-between p-3">
                  <div><p className="font-bold">{m.name}</p><p className="text-xs text-muted-foreground">{m.phone}</p></div>
                  <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: m.id, status: "rejected" })}>Remove</Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Quizzes</h2>
            <div className="surface-card mt-3 grid gap-2 p-4">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 rounded-xl border-2 border-input bg-background px-3">
                <option value="">Choose one of your quizzes…</option>
                {myQuizzes.data?.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold">Opens<Input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
                <label className="text-xs font-bold">Closes<Input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!pick || addAsync.isPending} onClick={() => addAsync.mutate()} variant="outline" className="rounded-full border-2 font-bold">Publish anytime quiz</Button>
                <Button disabled={!pick || push.isPending} onClick={() => push.mutate(pick)} className="chunky rounded-full font-bold"><Radio className="size-4" /> Push pop quiz now</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {linked.data?.map((l) => {
                const q = l.quizzes as unknown as { id: string; title: string; status: string; opens_at: string | null; closes_at: string | null } | null;
                if (!q) return null;
                return (
                  <div key={l.id} className="surface-card flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-bold">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.mode === "pop" ? "Pop quiz" : "Anytime"} · {q.status}
                        {q.opens_at ? ` · from ${toLocalInput(q.opens_at).replace("T", " ")}` : ""}
                        {q.closes_at ? ` · until ${toLocalInput(q.closes_at).replace("T", " ")}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline"><Link to="/quiz/$quizId" params={{ quizId: q.id }}>Results</Link></Button>
                      {q.status !== "ended" && <Button size="sm" variant="ghost" onClick={() => unpublish.mutate(q.id)}>Unpublish</Button>}
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 className="mt-8 text-2xl font-bold">Resources</h2>
            <form onSubmit={(e) => { e.preventDefault(); if (!rTitle.trim()) return toast.error("Add a title"); addResource.mutate(); }} className="surface-card mt-3 grid gap-2 p-4">
              <div className="flex gap-2">
                <Input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="Title" />
                <select value={rKind} onChange={(e) => setRKind(e.target.value as typeof rKind)} className="rounded-md border border-input bg-background px-2">
                  <option value="link">Link</option><option value="video">Video</option><option value="note">Note</option>
                </select>
              </div>
              {rKind !== "note" && <Input value={rUrl} onChange={(e) => setRUrl(e.target.value)} placeholder="https://…" />}
              <Textarea value={rBody} onChange={(e) => setRBody(e.target.value)} placeholder="Notes (optional)" />
              <Button disabled={addResource.isPending} className="rounded-full font-bold"><Plus className="size-4" /> Add resource</Button>
            </form>
            <div className="mt-3 grid gap-2">
              {resources.data?.map((r) => (
                <div key={r.id} className="surface-card flex items-center justify-between p-3">
                  <p className="font-bold">{r.title} <span className="text-xs text-muted-foreground">({r.kind})</span></p>
                  <Button size="sm" variant="ghost" onClick={() => delResource.mutate(r.id)}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
