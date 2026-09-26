import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  FileDown,
  Layers3,
  Sparkles,
  Type,
} from "lucide-react";

const features = [
  {
    icon: Layers3,
    title: "Smart Structure",
    body: "Chapters, headings, and numbering stay consistent as you write.",
  },
  {
    icon: Type,
    title: "Automatic Formatting",
    body: "Margins, typography, captions, and layout stay under control.",
  },
  {
    icon: Sparkles,
    title: "Academic AI",
    body: "Draft, improve, and refine section content with project context.",
  },
  {
    icon: FileDown,
    title: "DOCX + PDF",
    body: "Export a structured report when you are ready to submit.",
  },
];

const aiCapabilities = ["Generate", "Improve", "Expand", "Grammar & Academic Tone"];

const guidelineChips = [
  "Headings",
  "Margins",
  "TOC",
  "Figures",
  "Tables",
  "References",
  "Page Numbers",
];

export default function Home() {
  const { userId } = auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--rp-canvas)] text-[var(--rp-ink)]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(111,21,95,0.10),_transparent_50%),radial-gradient(ellipse_at_80%_20%,_rgba(201,146,46,0.08),_transparent_45%),linear-gradient(180deg,#fbf8fa_0%,#f4f0f3_100%)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-[var(--rp-line)]/70 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5 text-[var(--rp-brand)]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--rp-brand)] text-white shadow-sm">
              <BookOpenText className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              ReportPeer AI
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--rp-muted)] transition hover:text-[var(--rp-brand)]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[var(--rp-brand)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--rp-brand-deep)] sm:px-4"
            >
              Create Your Report
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* 1. HERO */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="rp-fade-up max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--rp-brand)]/15 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--rp-brand)] shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-[var(--rp-accent)]" />
                AI-Powered FYP Report Platform
              </span>
              <h1 className="mt-5 font-display text-[2.45rem] font-semibold leading-[1.1] tracking-tight text-[var(--rp-ink)] sm:text-5xl lg:text-[3.25rem]">
                Stop Fighting With Your FYP Report.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--rp-muted)] sm:text-base">
                Write your project. ReportPeer handles the structure, formatting,
                numbering, references, and university requirements.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--rp-brand)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--rp-brand-deep)]"
                >
                  Create Your Report
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#product"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--rp-line)] bg-white/90 px-5 py-3 text-sm font-semibold text-[var(--rp-ink)] transition hover:border-[var(--rp-brand)]/30"
                >
                  See How It Works
                </a>
              </div>
            </div>

            {/* Visual focus — miniature ReportPeer workspace */}
            <div className="rp-fade-up-delay relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -inset-3 rounded-[2rem] bg-[var(--rp-brand)]/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-gradient-to-br from-[var(--rp-brand)] via-[#5c134f] to-[var(--rp-brand-deep)] p-4 text-white shadow-[0_28px_70px_-24px_rgba(79,15,68,0.7)] sm:p-5">
                <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[var(--rp-accent)]/25 blur-2xl" />
                <div className="absolute -bottom-12 left-6 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

                <div className="relative space-y-3.5">
                  {/* Report header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                        FYP Report
                      </p>
                      <h2 className="mt-1 truncate font-display text-lg font-semibold leading-snug sm:text-xl">
                        Smart Campus Management System
                      </h2>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#f3d9a4]/35 bg-[#f3d9a4]/10 px-2.5 py-1 text-[10px] font-semibold text-[#f3d9a4]">
                      JUW Guidelines · Validated
                    </span>
                  </div>

                  {/* Document + structure */}
                  <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        Report workspace
                      </p>
                      <div className="mt-2.5 space-y-1.5 text-[13px]">
                        <div className="rounded-lg bg-white/10 px-2.5 py-1.5 font-medium">
                          Chapter 1 — Introduction
                        </div>
                        <div className="rounded-lg bg-white/5 px-2.5 py-1.5 pl-5 text-white/80">
                          1.1 Overview
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-white/85">
                          <span>Table of Contents</span>
                          <span className="text-[11px] text-[#f3d9a4]">✓</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/80">
                            <span>Figure 1.1</span>
                            <span className="text-[#f3d9a4]">✓</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/80">
                            <span>Table 2.1</span>
                            <span className="text-[#f3d9a4]">✓</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/80">
                          <span>References</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">[1]</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">[2]</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        Report Structure
                      </p>
                      <ul className="mt-2.5 space-y-2 text-xs text-white/85">
                        {["Headings", "Numbering", "Figures & Tables", "References"].map(
                          (item) => (
                            <li key={item} className="flex items-center gap-2">
                              <span className="text-[#f3d9a4]">✓</span>
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Academic AI Copilot strip */}
                  <div className="rounded-2xl border border-[#f3d9a4]/30 bg-black/20 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#f3d9a4]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Academic AI Copilot
                      </div>
                      <span className="text-[11px] text-white/70">
                        Project context connected ✓
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] leading-snug text-white/85">
                      Generate, improve or expand your section while keeping your
                      project facts and academic tone consistent.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["Generate", "Improve", "Expand"].map((action) => (
                        <span
                          key={action}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. PROBLEM → SOLUTION */}
        <section id="product" className="scroll-mt-24 border-y border-[var(--rp-line)] bg-white/80">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--rp-ink)] sm:text-4xl">
                Your FYP is already enough work.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--rp-muted)] sm:text-base">
                You shouldn&apos;t spend hours fixing Word formatting, TOC, figure
                and table numbering, references, page numbers, and layout every time
                the report changes.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[var(--rp-line)] bg-white p-5 shadow-sm transition hover:border-[var(--rp-brand)]/25"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--rp-brand-soft)] text-[var(--rp-brand)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-[var(--rp-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--rp-muted)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. ACADEMIC AI COPILOT */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/50 bg-gradient-to-br from-[var(--rp-brand)] via-[#5a124e] to-[var(--rp-brand-deep)] p-6 text-white shadow-[0_28px_70px_-28px_rgba(79,15,68,0.65)] sm:p-8 lg:p-10">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[var(--rp-accent)]/20 blur-2xl" />
            <div className="absolute -bottom-16 left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#f3d9a4]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Academic AI Copilot
                </div>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Write Better. Stay Focused.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80 sm:text-[15px]">
                  AI understands your project context and selected section to help
                  generate, improve, expand and refine academic content without
                  inventing project facts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {aiCapabilities.map((label) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-5 text-center text-sm font-semibold text-white backdrop-blur-sm"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. UNIVERSITY GUIDELINES */}
        <section className="border-y border-[var(--rp-line)] bg-white/80">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="rounded-2xl border border-[var(--rp-line)] bg-[var(--rp-canvas)] p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-10">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--rp-ink)] sm:text-3xl">
                  Built Around Your University&apos;s Requirements
                </h2>
                <p className="mt-3 text-sm text-[var(--rp-muted)]">
                  <span className="font-semibold text-[var(--rp-ink)]">
                    Currently supported: Jinnah University for Women (JUW)
                  </span>
                  <br />
                  Additional university templates are being developed.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 lg:mt-0 lg:max-w-md lg:justify-end">
                {guidelineChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[var(--rp-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--rp-ink)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. FINAL CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--rp-ink)] sm:text-4xl">
              Focus on your project.
              <br className="hidden sm:block" /> Let ReportPeer handle the report.
            </h2>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--rp-brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--rp-brand-deep)]"
            >
              Create Your Report
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--rp-line)] bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-[var(--rp-brand)]">
            <BookOpenText className="h-4 w-4" />
            <span className="text-sm font-semibold">ReportPeer AI</span>
          </div>
          <p className="text-xs text-[var(--rp-muted)]">Developed by Muskan Kamran</p>
        </div>
      </footer>
    </div>
  );
}
