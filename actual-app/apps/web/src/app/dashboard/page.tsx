"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  BookOpenText,
  Plus,
  FileText,
  Clock,
  Building2,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Project {
  _id: string;
  title: string;
  university: string;
  status: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [university, setUniversity] = useState("JUW");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const router = useRouter();

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      void fetchProjects();
    }
  }, [isLoaded, user]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, university }),
      });

      if (res.ok) {
        const data = await res.json();
        setTitle("");
        setUniversity("JUW");
        setIsModalOpen(false);

        if (data.projectId) {
          router.push(`/editor/${data.projectId}`);
        } else {
          await fetchProjects();
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setCreateError(
          errorData.error || `Failed to create project (${res.status}).`
        );
      }
    } catch (err) {
      console.error("Failed to create project exception:", err);
      setCreateError("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--rp-canvas)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(111,21,95,0.08),_transparent_55%)]" />

      <header className="sticky top-0 z-30 border-b border-[var(--rp-line)]/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2.5 text-[var(--rp-brand)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--rp-brand)] text-white">
              <BookOpenText className="h-4 w-4" />
            </span>
            <span className="truncate font-display text-lg font-semibold tracking-tight sm:text-xl">
              ReportPeer AI
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-[var(--rp-muted)] sm:inline">
              {!isLoaded ? "Loading…" : user?.fullName || "Account"}
            </span>
            <UserButton
              afterSignOutUrl="/"
              appearance={{ elements: { avatarBox: "h-8 w-8" } }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--rp-accent)]">
              Workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--rp-ink)] sm:text-4xl">
              Hello, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--rp-muted)]">
              Your FYP projects live here — create a report, open the editor, and
              use Academic AI Copilot when you are ready to draft.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--rp-brand)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--rp-brand-deep)] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Create new project
          </button>
        </div>

        {!isLoaded || isLoading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-[var(--rp-muted)]">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--rp-brand)]" />
            <p className="mt-3 text-sm font-medium">Loading your projects…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--rp-brand)]/25 bg-white px-6 py-12 text-center sm:px-10 sm:py-16">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--rp-brand-soft)] text-[var(--rp-brand)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold text-[var(--rp-ink)]">
              Create your first FYP report
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--rp-muted)]">
              Start a project with your university template, fill the Project AI
              Profile, then draft chapters with AI assistance and export DOCX/PDF.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--rp-brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--rp-brand-deep)]"
            >
              <Plus className="h-4 w-4" />
              Create Your Report
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project._id}
                href={`/editor/${project._id}`}
                className="group flex min-h-[210px] flex-col justify-between rounded-2xl border border-[var(--rp-line)] bg-white p-5 shadow-sm transition hover:border-[var(--rp-brand)]/30 hover:shadow-md sm:p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--rp-brand-soft)] text-[var(--rp-brand)]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-[#f8efd8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8a6518]">
                      {project.status || "In progress"}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-xl leading-snug text-[var(--rp-ink)] transition group-hover:text-[var(--rp-brand)]">
                    {project.title}
                  </h3>
                </div>

                <div className="mt-6 space-y-2 border-t border-[var(--rp-line)] pt-4 text-xs font-medium text-[var(--rp-muted)]">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{project.university}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Updated{" "}
                    {new Date(project.updatedAt).toLocaleDateString() ===
                    new Date().toLocaleDateString()
                      ? "Today"
                      : new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex min-h-[210px] items-center justify-center rounded-2xl border-2 border-dashed border-[var(--rp-line)] bg-white/70 p-6 text-[var(--rp-muted)] transition hover:border-[var(--rp-brand)]/40 hover:text-[var(--rp-brand)]"
            >
              <div className="text-center">
                <Plus className="mx-auto h-6 w-6 stroke-[2.5]" />
                <div className="mt-2 text-sm font-semibold">New project</div>
              </div>
            </button>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[var(--rp-line)] bg-white p-6 shadow-xl sm:rounded-2xl">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-[var(--rp-muted)] transition hover:text-[var(--rp-ink)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="pr-8 font-display text-2xl font-semibold tracking-tight text-[var(--rp-ink)]">
              Create new project
            </h2>
            <p className="mt-1 text-sm text-[var(--rp-muted)]">
              Choose a title and university template to open the editor.
            </p>

            <form onSubmit={handleCreateProject} className="mt-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--rp-ink)]">
                  Project / Thesis Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Smart Campus Management System"
                  className="w-full rounded-xl border border-[var(--rp-line)] px-3 py-2.5 text-sm text-[var(--rp-ink)] outline-none transition focus:border-[var(--rp-brand)] focus:ring-1 focus:ring-[var(--rp-brand)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--rp-ink)]">
                  University Template
                </label>
                <select
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full rounded-xl border border-[var(--rp-line)] bg-white px-3 py-2.5 text-sm text-[var(--rp-ink)] outline-none transition focus:border-[var(--rp-brand)] focus:ring-1 focus:ring-[var(--rp-brand)]"
                >
                  <option value="JUW">Jinnah University for Women (JUW)</option>
                  <option value="NED University">NED University</option>
                  <option value="IBA">IBA Karachi</option>
                  <option value="FAST-NUCES">FAST-NUCES</option>
                </select>
              </div>

              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-[var(--rp-line)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[var(--rp-muted)] transition hover:text-[var(--rp-ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--rp-brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--rp-brand-deep)] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create project"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
