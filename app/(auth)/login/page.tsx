"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const EASE = [0.215, 0.61, 0.355, 1] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

const PROOF_DROPS = [
  { text: "spent ₹240 at Third Wave Coffee", dot: "#22c55e" },
  { text: "idea: weekend trip to Coorg", dot: "#a855f7" },
  { text: "finished reading Atomic Habits", dot: "#f59e0b" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (showOtpInput) otpRefs.current[0]?.focus();
  }, [showOtpInput]);

  const otpValue = otp.join("");

  const handleSendOtp = async (isResend = false) => {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      toast.error("Please enter your email");
      return;
    }
    if (!EMAIL_RE.test(clean)) {
      toast.error("That email doesn't look right");
      return;
    }
    if (!isResend && sending) return;
    if (isResend && (sending || cooldown > 0)) return;

    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email: clean });
    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setEmail(clean);
    setShowOtpInput(true);
    setCooldown(RESEND_SECONDS);
    toast.success(isResend ? "New code sent" : "Code sent — check your inbox");
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length < 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otpValue,
      type: "email",
    });

    if (error) {
      toast.error(error.message);
      setVerifying(false);
      return;
    }
    toast.success("Welcome back");
    // Proxy routes a fresh session to /setup or /home — push into the
    // app and refresh so the new cookies are picked up immediately.
    router.refresh();
    router.push("/home");
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleVerifyOtp();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    setOtp(digits.split("").concat(Array(6 - digits.length).fill("")).slice(0, 6));
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        {/* ── Brand panel ── */}
        <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20"
            style={{ backgroundColor: "#7F77DD" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full opacity-15"
            style={{ backgroundColor: "#1D9E75" }}
          />
          <Link href="/" className="relative flex items-center gap-2 text-sm font-semibold text-white/60 transition-colors hover:text-white">
            <ArrowLeft size={15} /> Back home
          </Link>

          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B9B3F0]">
              Mindrop — your second brain
            </p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight">
              Your mind,
              <br />
              <em className="italic text-[#B9B3F0]">remembered.</em>
            </h1>
            <p className="mt-4 max-w-[42ch] text-[15px] leading-7 text-white/60">
              One box for expenses, ideas, books, travel. Drop it in seconds,
              ask for it back anytime.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              {PROOF_DROPS.map((d, i) => (
                <motion.div
                  key={d.text}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: EASE }}
                  className={`flex items-center gap-2 rounded-xl bg-white/[0.07] px-4 py-2.5 ring-1 ring-white/10 ${
                    i === 1 ? "ml-6" : i === 2 ? "ml-3" : ""
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.dot }} />
                  <span className="text-[13px] font-medium text-white/85">{d.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="relative flex items-center gap-2 text-[13px] font-medium text-white/45">
            <ShieldCheck size={15} className="text-success" />
            Passwordless OTP · keys stay server-side · private by design
          </p>
        </aside>

        {/* ── Form panel ── */}
        <section className="flex flex-col px-5 py-8 sm:px-10 md:px-16 lg:justify-center lg:py-12">
          <Link
            href="/"
            className="mb-8 flex items-center gap-2 text-sm font-semibold text-ink-3 transition-colors hover:text-ink lg:hidden"
          >
            <ArrowLeft size={15} /> Back home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="mx-auto w-full max-w-md"
          >
            <span className="font-display text-[26px] italic tracking-tight lg:hidden">
              Mindrop<span className="not-italic text-brand">.</span>
            </span>

            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand lg:mt-0">
              {showOtpInput ? "Check your inbox" : "Welcome"}
            </p>
            <h2 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight">
              {showOtpInput ? (
                <>
                  Enter your <em className="italic text-brand">code.</em>
                </>
              ) : (
                <>
                  Log in to <em className="italic text-brand">your mind.</em>
                </>
              )}
            </h2>
            <p className="mt-3 text-[15px] leading-6 text-ink-2">
              {showOtpInput ? (
                <>
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-ink">{email}</span>. It expires in a few minutes.
                </>
              ) : (
                "No password to forget. We'll email you a one-time code."
              )}
            </p>

            {!showOtpInput ? (
              <div className="mt-8">
                <label htmlFor="email" className="mb-2 block text-[13px] font-bold text-ink">
                  Email address
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 transition-colors focus-within:border-brand">
                  <Mail size={17} className="shrink-0 text-ink-3" />
                  <input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    placeholder="you@example.com"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    className="h-14 w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
                <button
                  onClick={() => handleSendOtp()}
                  disabled={sending}
                  className="group mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> Sending code…
                    </>
                  ) : (
                    <>
                      Send login code
                      <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
                <p className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-ink-3">
                  <Lock size={13} className="mt-0.5 shrink-0" />
                  Passwordless by design — the code proves it&apos;s you, no password database to leak.
                </p>
              </div>
            ) : (
              <div className="mt-8">
                <div className="flex gap-2.5" onPaste={handleOtpPaste}>
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Digit ${i + 1}`}
                      className="h-13 w-full rounded-2xl border border-line bg-white py-3.5 text-center font-display text-2xl text-ink outline-none transition-colors focus:border-brand"
                    />
                  ))}
                </div>
                <button
                  onClick={handleVerifyOtp}
                  disabled={verifying || otpValue.length < 6}
                  className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white shadow-[0_16px_32px_-12px_rgba(127,119,221,0.6)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify & open my mind"
                  )}
                </button>
                <div className="mt-4 flex items-center justify-between text-sm font-semibold">
                  <button
                    onClick={() => {
                      setShowOtpInput(false);
                      setOtp(["", "", "", "", "", ""]);
                    }}
                    className="flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink"
                  >
                    <Pencil size={13} /> Change email
                  </button>
                  <button
                    onClick={() => handleSendOtp(true)}
                    disabled={sending || cooldown > 0}
                    className="text-brand transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    {sending
                      ? "Sending…"
                      : cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : "Resend code"}
                  </button>
                </div>
              </div>
            )}

            <p className="mt-10 border-t border-hairline pt-5 text-center text-[13px] font-medium text-ink-3">
              New to Mindrop? The code creates your account automatically.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
