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

interface Props {
  onSuccess: (user: User) => void;
}

export function LoginPage({ onSuccess }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [devEmail, setDevEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) return;

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
  }, [googleClientId]);

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const user = await api.auth.devLogin(devEmail.trim(), devEmail.split("@")[0]);
      onSuccess(user);
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
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

        {/* Sign-in card */}
        <div className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-5">
          <p className="text-sm text-slate-400 text-center">Sign in to continue</p>

          {/* Google button container */}
          {googleClientId && (
            <div
              ref={buttonRef}
              className={`overflow-hidden rounded-xl${loading ? " opacity-50 pointer-events-none" : ""}`}
            />
          )}

          {/* Dev login fallback */}
          {!googleClientId && (
            <form onSubmit={handleDevLogin} className="w-full flex flex-col gap-3">
              <p className="text-[10px] text-slate-600 text-center uppercase tracking-wider">
                Dev mode — no Google Client ID configured
              </p>
              <input
                type="email"
                placeholder="your@email.com"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5
                  text-sm text-white placeholder:text-slate-600
                  focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40
                  disabled:opacity-40 transition-all"
              />
              <button
                type="submit"
                disabled={loading || !devEmail.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700
                  hover:from-purple-500 hover:to-purple-600
                  text-white text-sm font-medium tracking-wide
                  disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all shadow-[0_0_16px_rgba(147,51,234,0.35)]"
              >
                {loading ? "Signing in…" : "Continue"}
              </button>
            </form>
          )}

          {loading && googleClientId && (
            <p className="text-xs text-slate-500 animate-pulse">Signing in…</p>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
