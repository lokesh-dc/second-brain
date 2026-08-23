"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      toast.error(error.message);
    } else {
      setShowOtpInput(true);
      toast.success("OTP sent to your email");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      toast.error("Please enter the OTP");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      toast.error(error.message);
    }
    // Proxy picks up the new session and routes to /setup or /home
    router.refresh();
    setLoading(false);
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-[#0f172a] p-6">
      <div>
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center">
          <div className="mb-4 grid h-[100px] w-[100px] place-items-center rounded-full bg-indigo-500/10">
            <Brain size={48} className="text-indigo-500" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-50">
            mind
          </h1>
          <p className="mt-2 text-base text-[#94a3b8]">
            Your second brain, simplified.
          </p>
        </div>

        {!showOtpInput ? (
          <div className="w-full">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              placeholder="Email Address"
              type="email"
              autoCapitalize="none"
              className="mb-4 w-full rounded-2xl border border-[#334155] bg-[#1e293b] p-4 text-base text-slate-50 outline-none placeholder:text-[#94a3b8]"
            />
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="h-[58px] w-full rounded-2xl bg-indigo-500 font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-70"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>
        ) : (
          <div className="w-full">
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              placeholder="Enter OTP"
              inputMode="numeric"
              className="mb-4 w-full rounded-2xl border border-[#334155] bg-[#1e293b] p-4 text-base text-slate-50 outline-none placeholder:text-[#94a3b8]"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="h-[58px] w-full rounded-2xl bg-indigo-500 font-semibold text-white shadow-lg shadow-indigo-500/30 disabled:opacity-70"
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button
              onClick={() => setShowOtpInput(false)}
              className="mt-4 w-full py-2 text-center text-sm text-[#94a3b8]"
            >
              Change Email
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
