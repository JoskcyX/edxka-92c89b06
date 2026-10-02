import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Clock, FileText, Link2, PlayCircle, Radio, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/class/$code")({
  head: () => ({
    meta: [
      { title: "Join your class — EDxKa" },
      { name: "description", content: "Request to join your tutor's class, access resources and take quizzes." },
      { property: "og:title", content: "Join your class — EDxKa" },
      { property: "og:description", content: "Request to join, get approved, and learn with your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20).regex(/^[0-9+\-\s()]+$/, "Phone can only contain numbers"),
});

type ClassInfo = { id: string; title: string; subject: string; description: string };
type Resource = { id: string; title: string; kind: "link" | "note" | "video"; url: string | null; body: string };
type ClassQuiz = { quiz_id: string; title: string; join_code: string; mode: "pop" | "async"; pushed_at: string | null; quiz_status: string; opens_at: string | null; closes_at: string | null };

function ClassPage() {
  const { code } = Route.useParams();
  const key = `edxka_class:${code.toUpperCase()}`;
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [quizzes, setQuizzes] = useState<ClassQuiz[]>([]);

  useEffect(() => {
    setMemberId(localStorage.getItem(key));
    supabase.rpc("get_class_by_code", { _code: code.toUpperCase() }).then(({ data }) => {
      setInfo((data?.[0] as ClassInfo) ?? null);
      setLoading(false);
    });
  }, [code, key]);

  const refresh = useCallback(async () => {
    if (!memberId) return;
    const { data } = await supabase.rpc("get_class_membership", { _member_id: memberId });
    const row = data?.[0];
    if (!row) { localStorage.removeItem(key); setMemberId(null); return; }
    setStatus(row.status);
    if (row.status === "approved") {
      const [r, q] = await Promise.all([
        supabase.rpc("get_class_resources", { _member_id: memberId }),
        supabase.rpc("get_class_quizzes", { _member_id: memberId }),
      ]);
      setResources((r.data as Resource[]) ?? []);
      setQuizzes((q.data as ClassQuiz[]) ?? []);
    }
  }, [memberId, key]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    const p = schema.safeParse({ name, phone });
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Check your details"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("request_class_join", { _class_id: info.id, _name: p.data.name, _phone: p.data.phone });
    setBusy(false);
    if (error || !data) { toast.error("Could not send your request"); return; }
    localStorage.setItem(key, data as string);
    setMemberId(data as string);
    setStatus("pending");
  };

  if (loading) return <Shell><p className="text-muted-foreground">Loading class…</p></Shell>;
  if (!info) return <Shell><h1 className="text-3xl font-bold">Class not found</h1><p className="mt-2 text-muted-foreground">Check the link with your tutor.</p></Shell>;

  const now = Date.now();
  const pop = quizzes.find((q) => q.mode === "pop" && q.pushed_at && q.quiz_status !== "ended");

  return (
    <Shell>
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{info.subject || "Class"}</p>
      <h1 className="mt-1 text-4xl font-bold">{info.title}</h1>
      {info.description && <p className="mt-2 text-muted-foreground">{info.description}</p>}

      {!memberId && (
        <form onSubmit={join} className="surface-card mt-8 grid gap-3 p-6">
          <p className="font-bold">Request to join this class</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="h-12 rounded-xl border-2" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="h-12 rounded-xl border-2" />
          <Button disabled={busy} className="chunky h-12 rounded-xl font-bold">Send request</Button>
        </form>
      )}

      {memberId && status === "pending" && (
        <div className="surface-card mt-8 p-8 text-center">
          <Clock className="mx-auto size-10 text-primary" />
          <p className="mt-3 text-xl font-bold">Waiting for your tutor to approve you</p>
          <p className="text-sm text-muted-foreground">Keep this page open — it updates automatically.</p>
        </div>
      )}

      {memberId && status === "rejected" && (
        <div className="surface-card mt-8 p-8 text-center">
          <p className="text-xl font-bold">Your request was declined</p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={() => { localStorage.removeItem(key); setMemberId(null); setStatus(null); }}>Try again</Button>
        </div>
      )}

      {memberId && status === "approved" && (
        <div className="mt-8 grid gap-8">
          {pop && (
            <Link to="/join/$code" params={{ code: pop.join_code }} className="surface-card flex items-center justify-between gap-4 border-primary bg-primary p-6 text-primary-foreground">
              <div className="flex items-center gap-3"><Radio className="size-6 animate-pulse" /><div><p className="text-sm font-bold uppercase">Pop quiz now</p><p className="text-xl font-bold">{pop.title}</p></div></div>
              <PlayCircle className="size-8" />
            </Link>
          )}
          <section>
            <h2 className="text-2xl font-bold">Quizzes</h2>
            <div className="mt-3 grid gap-3">
              {quizzes.filter((q) => q.mode === "async").length === 0 && <p className="text-sm text-muted-foreground">No quizzes yet.</p>}
              {quizzes.filter((q) => q.mode === "async").map((q) => {
                const notYet = q.opens_at && new Date(q.opens_at).getTime() > now;
                const closed = q.quiz_status === "ended" || (q.closes_at && new Date(q.closes_at).getTime() <= now);
                return (
                  <div key={q.quiz_id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.opens_at ? `Opens ${new Date(q.opens_at).toLocaleString()}` : "Open anytime"}
                        {q.closes_at ? ` · Closes ${new Date(q.closes_at).toLocaleString()}` : ""}
                      </p>
                    </div>
                    {closed ? <span className="text-sm font-bold text-muted-foreground">Closed</span>
                      : notYet ? <span className="text-sm font-bold text-muted-foreground">Not open yet</span>
                      : <Button asChild className="rounded-full font-bold"><Link to="/join/$code" params={{ code: q.join_code }}>Take quiz</Link></Button>}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-bold">Resources</h2>
            <div className="mt-3 grid gap-3">
              {resources.length === 0 && <p className="text-sm text-muted-foreground">No resources yet.</p>}
              {resources.map((r) => (
                <div key={r.id} className="surface-card p-4">
                  <p className="flex items-center gap-2 font-bold">
                    {r.kind === "video" ? <Video className="size-4 text-primary" /> : r.kind === "note" ? <FileText className="size-4 text-primary" /> : <Link2 className="size-4 text-primary" />}
                    {r.title}
                  </p>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-bold text-secondary underline">{r.url}</a>}
                  {r.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-6">
        <Link to="/" className="font-display text-2xl font-bold">ED<span className="text-primary">xKa</span></Link>
        <BookOpen className="size-5 text-secondary" />
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24">{children}</main>
    </div>
  );
}
