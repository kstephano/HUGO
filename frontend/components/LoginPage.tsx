"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

type Mode = "main" | "login" | "register";

interface Props {
  onSuccess: (user: User) => void;
}

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 " +
  "text-sm text-white placeholder:text-slate-600 " +
  "focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 " +
  "disabled:opacity-40 transition-all";

const btnClass =
  "w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 " +
  "hover:from-purple-500 hover:to-purple-600 " +
  "text-white text-sm font-medium tracking-wide " +
  "disabled:opacity-30 disabled:cursor-not-allowed " +
  "transition-all shadow-[0_0_16px_rgba(147,51,234,0.35)] hover:shadow-[0_0_22px_rgba(147,51,234,0.55)]";

export function LoginPage({ onSuccess }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId || mode !== "main") return;

    const initGoogle = () => {
      window.google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential: string }) => {
          setLoading(true);
          setError(null);
          try {
            const user = await api.auth.google(response.credential);
            onSuccess(user);
          } catch {
            setError("Google sign-in failed. Please try again.");
          } finally {
            setLoading(false);
          }
        },
      });
      if (buttonRef.current) {
        window.google?.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          shape: "rectangular",
          theme: "outline",
          text: "signin_with",
          size: "large",
          logo_alignment: "left",
          width: 280,
        });
      }
    };

    if (window.google) {
      initGoogle();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    }
  }, [googleClientId, mode]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await api.auth.emailLogin(loginEmail.trim(), loginPassword);
      onSuccess(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("401") ? "Invalid email or password." : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      setError("Passwords don't match.");
      return;
    }
    if (regPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await api.auth.register(regEmail.trim(), regName.trim(), regPassword);
      onSuccess(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("409") ? "An account with this email already exists." : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[rgba(3,7,18,0.35)]">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/images/hugo-logo.png"
            alt="Hugo"
            width={72}
            height={72}
            className="rounded-full shadow-[0_0_32px_rgba(245,158,11,0.3)]"
          />
          <div className="text-center">
            <p className="text-2xl font-light text-amber-400 tracking-[0.45em]">H . U . G . O</p>
            <p className="text-[11px] text-slate-500 tracking-[0.25em] uppercase mt-1">
              Helpful Universal Guidance Operator
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">

          {/* ── Main: Google + email options ── */}
          {mode === "main" && (
            <>
              <p className="text-sm text-slate-400 text-center">Sign in to continue</p>

              {googleClientId && (
                <div
                  ref={buttonRef}
                  className={`overflow-hidden rounded-xl${loading ? " opacity-50 pointer-events-none" : ""}`}
                />
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] text-slate-600 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={() => switchMode("login")}
                className={btnClass}
              >
                Sign in with email
              </button>

              <p className="text-center text-xs text-slate-500">
                No account?{" "}
                <button onClick={() => switchMode("register")} className="text-purple-400 hover:text-purple-300 transition-colors">
                  Create one
                </button>
              </p>
            </>
          )}

          {/* ── Email login ── */}
          {mode === "login" && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => switchMode("main")} className="text-slate-500 hover:text-slate-300 transition-colors text-xs">
                  ← Back
                </button>
                <p className="text-sm text-slate-400 flex-1 text-center pr-6">Sign in</p>
              </div>

              <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                />
                <button type="submit" disabled={loading || !loginEmail || !loginPassword} className={btnClass}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <p className="text-center text-xs text-slate-500">
                No account?{" "}
                <button onClick={() => switchMode("register")} className="text-purple-400 hover:text-purple-300 transition-colors">
                  Create one
                </button>
              </p>
            </>
          )}

          {/* ── Register ── */}
          {mode === "register" && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => switchMode("main")} className="text-slate-500 hover:text-slate-300 transition-colors text-xs">
                  ← Back
                </button>
                <p className="text-sm text-slate-400 flex-1 text-center pr-6">Create account</p>
              </div>

              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Your name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                />
                <input
                  type="password"
                  placeholder="Password (min 8 characters)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  required
                  disabled={loading}
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={loading || !regName || !regEmail || !regPassword || !regConfirm}
                  className={btnClass}
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>

              <p className="text-center text-xs text-slate-500">
                Already have an account?{" "}
                <button onClick={() => switchMode("login")} className="text-purple-400 hover:text-purple-300 transition-colors">
                  Sign in
                </button>
              </p>
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center -mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
