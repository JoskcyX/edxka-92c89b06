import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Rocket, Timer, Trophy, Users, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuizPop — Live Classroom Quizzes Your Students Race Through" },
      {
        name: "description",
        content:
          "Tutors build a quiz, share one link, and hit start. Students join a live lobby, answer against the clock, and land on a speed-and-accuracy leaderboard.",
      },
      { property: "og:title", content: "QuizPop — Live Classroom Quizzes" },
      {
        property: "og:description",
        content:
          "Build a quiz, share one link, hit start. Students race the clock and the leaderboard builds itself.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const join = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    navigate({ to: "/join/$code", params: { code: clean } });
  };

  return (
    <div className="min-h-screen confetti-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-bold">
          Quiz<span className="text-primary">Pop</span>
        </span>
        <Button asChild variant="outline" className="chunky rounded-full border-2 font-bold">
          <Link to="/auth">Tutor sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="grid items-center gap-12 py-10 md:grid-cols-2 md:py-16">
          <div className="pop-in">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-secondary bg-accent px-4 py-1.5 text-sm font-bold text-accent-foreground">
              <Sparkles className="size-4" /> Live, timed, deliciously competitive
            </span>
            <h1 className="mt-6 text-5xl leading-[1.05] font-bold md:text-6xl">
              One link. Your whole class.{" "}
              <span className="text-primary">Racing the clock.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Write 5 questions or 40. Share the link. When you press start, every student gets the
              same questions, one at a time, against a countdown — and the leaderboard ranks them by
              correct answers, then raw speed.
            </p>

            <form
              onSubmit={join}
              className="mt-8 flex max-w-md flex-col gap-3 surface-card p-4 sm:flex-row"
            >
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ENTER QUIZ CODE"
                maxLength={10}
                aria-label="Quiz code"
                className="h-12 rounded-xl border-2 text-center text-lg font-bold tracking-[0.25em] sm:text-left sm:tracking-[0.2em]"
              />
              <Button type="submit" className="chunky h-12 rounded-xl px-6 text-base font-bold">
                Join quiz
              </Button>
            </form>
          </div>

          <div className="pop-in surface-card p-6">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">Live lobby</p>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                12 waiting
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["Amara", "Tobi", "Zainab", "Chidi", "Ife", "Musa"].map((name, index) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-xl border-2 border-border bg-muted px-3 py-2 text-sm font-bold"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                    {name[0]}
                  </span>
                  {name}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border-2 border-dashed border-secondary p-4 text-center">
              <p className="font-display text-3xl font-bold text-primary">00:14</p>
              <p className="text-sm text-muted-foreground">until the tutor presses start</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { icon: Rocket, title: "Build fast", body: "Multiple choice, true/false or typed answers — as many as you like." },
            { icon: Users, title: "One shared link", body: "Students enter a name and phone number. No accounts, no downloads." },
            { icon: Timer, title: "Beat the clock", body: "Every question has its own countdown and auto-advances." },
            { icon: Trophy, title: "Instant ranking", body: "Sorted by correct answers first, then fastest total time." },
          ].map((item) => (
            <div key={item.title} className="surface-card p-5">
              <item.icon className="size-7 text-primary" />
              <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
