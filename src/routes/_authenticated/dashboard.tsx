import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, LogOut, Plus, Radio, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { makeJoinCode } from "@/lib/quiz";
import { StudentProgress } from "@/components/StudentProgress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Tutor dashboard — EDxKa" },
      { name: "description", content: "Create quizzes, share links and open live sessions." },
      { property: "og:title", content: "Tutor dashboard — EDxKa" },
      { property: "og:description", content: "Create quizzes and run live sessions." },
    ],
  }),
  component: Dashboard,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  lobby: "Lobby open",
  live: "Live now",
  ended: "Finished",
};

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const quizzes = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, join_code, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createQuiz = useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const tutorId = userData.user?.id;
      if (!tutorId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("quizzes")
        .insert({ title: name, join_code: makeJoinCode(), tutor_id: tutorId })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      navigate({ to: "/quiz/$quizId", params: { quizId: data.id } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create quiz"),
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-2xl font-bold">
          ED<span className="text-primary">xKa</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
            <Link to="/my-courses">
              <BookOpen className="size-4" /> My courses
            </Link>
          </Button>
          <Button variant="outline" onClick={signOut} className="chunky rounded-full border-2 font-bold">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <h1 className="text-4xl font-bold">Your quizzes</h1>
        <p className="mt-2 text-muted-foreground">
          Create a quiz, add your questions, then share the link and press start.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const name = title.trim();
            if (!name) {
              toast.error("Give your quiz a title");
              return;
            }
            createQuiz.mutate(name);
          }}
          className="mt-6 flex flex-col gap-3 surface-card p-4 sm:flex-row"
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. SS2 Chemistry — Periodic Table"
            maxLength={120}
            className="h-12 rounded-xl border-2"
          />
          <Button
            type="submit"
            disabled={createQuiz.isPending}
            className="chunky h-12 rounded-xl px-6 font-bold"
          >
            <Plus className="size-4" /> New quiz
          </Button>
        </form>

        <div className="mt-8 grid gap-4">
          {quizzes.isLoading && <p className="text-muted-foreground">Loading your quizzes…</p>}
          {quizzes.data?.length === 0 && (
            <div className="surface-card p-10 text-center">
              <Trophy className="mx-auto size-10 text-primary" />
              <p className="mt-3 text-lg font-bold">No quizzes yet</p>
              <p className="text-sm text-muted-foreground">Your first one is one title away.</p>
            </div>
          )}
          {quizzes.data?.map((quiz) => (
            <Link
              key={quiz.id}
              to="/quiz/$quizId"
              params={{ quizId: quiz.id }}
              className="surface-card flex flex-wrap items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-0.5"
            >
              <div>
                <p className="text-xl font-bold">{quiz.title}</p>
                <p className="text-sm text-muted-foreground">
                  Code <span className="font-bold tracking-widest text-foreground">{quiz.join_code}</span>
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-bold ${
                  quiz.status === "live"
                    ? "border-primary bg-primary text-primary-foreground"
                    : quiz.status === "lobby"
                      ? "border-secondary bg-secondary text-secondary-foreground"
                      : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {quiz.status === "live" && <Radio className="size-4" />}
                {STATUS_LABEL[quiz.status] ?? quiz.status}
              </span>
            </Link>
          ))}
        </div>

        <ClassesSection />

        <div className="mt-12">
          <StudentProgress />
        </div>
      </main>
    </div>
  );
}
