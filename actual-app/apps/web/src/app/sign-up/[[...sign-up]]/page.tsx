import { SignUp } from "@clerk/nextjs";
import { BookOpenText } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      
      {/* Left Brand Panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#6F155F] text-white relative overflow-hidden">
        <div className="flex items-center gap-2">
          <BookOpenText className="h-6 w-6 text-[#E8A93B]" />
          <span className="font-semibold text-xl tracking-tight">ReportPeer AI</span>
        </div>
        
        <div className="relative z-10 max-w-xl">
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight">
            Write your FYP report.<br />
            <span className="text-[#E8A93B] inline-block whitespace-nowrap mt-1">
              Formatted perfectly.
            </span>
          </h1>
          <p className="mt-6 text-sm text-white/80 leading-relaxed max-w-md">
            A chapter-by-chapter editor that follows your university's official
            Word template — captions, headings, tables, and all — while AI helps
            you draft and polish.
          </p>
        </div>
        
        <div className="text-xs text-white/60 tracking-wide">
          Trusted format · JUW · NED · IBA · FAST
        </div>
        
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#E8A93B]/10 blur-3xl" />
      </div>

      {/* Right Form Workspace */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 bg-gray-50/50 lg:bg-white">
        {/* Mobile Header - Visible only on small screens */}
        <div className="lg:hidden flex items-center gap-2 mb-8 text-[#6F155F]">
          <BookOpenText className="h-6 w-6 text-[#E8A93B]" />
          <span className="font-bold text-xl tracking-tight">ReportPeer AI</span>
        </div>

        {/* Standard Clerk Box Wrapper */}
        <div className="w-full flex justify-center items-center">
          <SignUp
            afterSignInUrl="/dashboard"
            afterSignUpUrl="/dashboard"
            appearance={{
              variables: {
                colorPrimary: '#6F155F',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}