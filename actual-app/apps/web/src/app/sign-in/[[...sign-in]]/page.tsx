import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpenText } from "lucide-react";

const clerkAppearance = {
  variables: {
    colorPrimary: "#6F155F",
    colorText: "#1c1520",
    colorTextSecondary: "#5f5666",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#1c1520",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    rootBox: "w-full max-w-[420px] mx-auto",
    card: "shadow-none border border-[var(--rp-line)] rounded-2xl bg-white",
    headerTitle: "font-display text-[var(--rp-ink)]",
    headerSubtitle: "text-[var(--rp-muted)]",
    socialButtonsBlockButton:
      "border border-[var(--rp-line)] hover:bg-[var(--rp-brand-soft)] transition",
    formButtonPrimary:
      "bg-[var(--rp-brand)] hover:bg-[var(--rp-brand-deep)] shadow-none",
    footerActionLink: "text-[var(--rp-brand)] hover:text-[var(--rp-brand-deep)]",
  },
} as const;

export default function SignInPage() {
  const { userId } = auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--rp-canvas)] lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[var(--rp-brand)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[var(--rp-accent)]/20 blur-3xl" />
        <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
            <BookOpenText className="h-4 w-4 text-[#f3d9a4]" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            ReportPeer AI
          </span>
        </Link>

        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Welcome back to your FYP workspace.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-white/80">
            Continue drafting with Academic AI Copilot, keep university
            formatting intact, and export DOCX or PDF when you are ready.
          </p>
        </div>

        <p className="relative z-10 text-xs text-white/55">
          Developed by Muskan Kamran
        </p>
      </div>

      <div className="flex min-h-screen flex-col px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Link href="/" className="flex items-center gap-2 text-[var(--rp-brand)]">
            <BookOpenText className="h-5 w-5" />
            <span className="font-display text-lg font-semibold">ReportPeer AI</span>
          </Link>
          <Link href="/sign-up" className="text-sm font-semibold text-[var(--rp-muted)]">
            Sign up
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--rp-ink)]">
              Sign in
            </h2>
            <p className="mt-2 text-sm text-[var(--rp-muted)]">
              Use email or Google to open your dashboard.
            </p>
          </div>

          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
