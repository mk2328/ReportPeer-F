import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BookOpenText } from "lucide-react";

export default function Home() {
  const { userId } = auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2 text-[#6F155F]">
            <BookOpenText className="h-5 w-5 text-[#E8A93B]" />
            <span className="font-semibold text-lg tracking-tight">ReportPeer AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-slate-600 hover:text-[#6F155F]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[#6F155F] hover:bg-[#57104b] text-white px-4 py-2 text-sm font-semibold"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8A93B]">
          FYP report platform
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-tight text-slate-900">
          Write your FYP report.
          <span className="block text-[#6F155F]">Formatted perfectly.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600">
          Build your final year project report chapter by chapter. ReportPeer
          keeps the university structure and formatting while you focus on the
          content.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="rounded-lg bg-[#6F155F] hover:bg-[#57104b] text-white px-5 py-2.5 text-sm font-semibold"
          >
            Create your report
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#6F155F]/40"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-10 text-xs tracking-wide text-slate-400">
          Trusted format · JUW · NED · IBA · FAST
        </p>
      </main>
    </div>
  );
}
