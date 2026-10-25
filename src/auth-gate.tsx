import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type AuthMode = "signin" | "signup";

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [guestMode, setGuestMode] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        setGuestMode(false);
      }

      setCheckingSession(false);
    });

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;

        if (sessionError) {
          setError("Could not check your session. Please try again.");
        }

        setUser(data.session?.user ?? null);
        setCheckingSession(false);
      })
      .catch(() => {
        if (!active) return;

        setError("Could not connect to the authentication service.");
        setCheckingSession(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setNotice("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter your email address and password.");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: normalizedEmail,
            password,
          });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          setUser(data.session.user);
          setGuestMode(false);
          setNotice("Your account has been created and you are signed in.");
        } else {
          setNotice(
            "Registration was submitted. Check your email for a confirmation link, then return here and sign in. If no email arrives, the project's email settings may need attention.",
          );
          setMode("signin");
          setPassword("");
        }
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (signInError) {
          throw signInError;
        }

        setUser(data.user);
        setGuestMode(false);
        setNotice("");
        setPassword("");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setUser(null);
      setGuestMode(false);
      setPassword("");
      setNotice("You have signed out.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Sign-out failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return (
      <main style={styles.page}>
        <section style={styles.card} aria-live="polite">
          <Brand />
          <p style={styles.muted}>Checking your session...</p>
        </section>
      </main>
    );
  }

  if (user || guestMode) {
    return (
      <>
        <div style={styles.sessionBar}>
          <div style={styles.sessionText}>
            <span
              style={{
                ...styles.statusDot,
                background: user ? "#76e4c2" : "#a99aff",
              }}
            />
            <span>
              {user
                ? `Signed in${user.email ? ` as ${user.email}` : ""}`
                : "Guest mode · Projects remain on this device"}
            </span>
          </div>

          {user ? (
            <button
              type="button"
              style={styles.sessionButton}
              onClick={handleSignOut}
              disabled={busy}
            >
              {busy ? "Signing out..." : "Sign out"}
            </button>
          ) : (
            <button
              type="button"
              style={styles.sessionButton}
              onClick={() => {
                setGuestMode(false);
                setMode("signin");
                setError("");
                setNotice("");
              }}
            >
              Sign in
            </button>
          )}
        </div>

        {error && (
          <div style={styles.globalError} role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div style={styles.globalNotice} role="status">
            {notice}
          </div>
        )}

        {children}
      </>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Brand />

        <div style={styles.heading}>
          <p style={styles.eyebrow}>YOUR CREATIVE WORKSPACE</p>
          <h1 style={styles.title}>
            Ideas become <span style={styles.gradient}>something.</span>
          </h1>
          <p style={styles.subtitle}>
            Sign in to your GrowthFlow account or create one to get started.
            You can also continue as a guest while account-based storage is
            being completed.
          </p>
        </div>

        <div style={styles.tabs} role="group" aria-label="Authentication mode">
          <button
            type="button"
            style={{
              ...styles.tab,
              ...(mode === "signin" ? styles.activeTab : {}),
            }}
            aria-pressed={mode === "signin"}
            onClick={() => {
              setMode("signin");
              setError("");
              setNotice("");
            }}
          >
            Sign in
          </button>

          <button
            type="button"
            style={{
              ...styles.tab,
              ...(mode === "signup" ? styles.activeTab : {}),
            }}
            aria-pressed={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setError("");
              setNotice("");
            }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="growthflow-email" style={styles.label}>
            EMAIL ADDRESS
          </label>

          <input
            id="growthflow-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            style={styles.input}
          />

          <label htmlFor="growthflow-password" style={styles.label}>
            PASSWORD
          </label>

          <input
            id="growthflow-password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            minLength={mode === "signup" ? 8 : 1}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={
              mode === "signup"
                ? "At least 8 characters"
                : "Enter your password"
            }
            style={styles.input}
          />

          {error && (
            <div style={styles.error} role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div style={styles.notice} role="status">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              ...styles.primaryButton,
              opacity: busy ? 0.65 : 1,
            }}
          >
            {busy
              ? "Please wait..."
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div style={styles.separator}>
          <span />
          <small>OR</small>
          <span />
        </div>

        <button
          type="button"
          style={styles.guestButton}
          onClick={() => {
            setGuestMode(true);
            setError("");
            setNotice("");
          }}
        >
          Continue without an account
        </button>

        <p style={styles.footnote}>
          Guest projects remain in this browser. Signing in does not yet
          synchronize them to the cloud. Cloud storage will be connected in
          a later step.
        </p>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div style={styles.brand}>
      <span style={styles.brandMark}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12.1v8.1"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      </span>
      <span style={styles.brandName}>
        Growth<span style={styles.brandAccent}>Flow</span>
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "28px 16px",
    background:
      "radial-gradient(ellipse at 50% 0%, rgba(119,99,220,0.17), transparent 45%), #0b0d12",
    color: "#f3f5f8",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    padding: "clamp(22px, 6vw, 34px)",
    background: "rgba(20,23,32,0.96)",
    border: "1px solid #303342",
    borderRadius: "20px",
    boxShadow: "0 28px 90px rgba(0,0,0,0.35)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    marginBottom: "35px",
  },
  brandMark: {
    width: "38px",
    height: "38px",
    display: "grid",
    placeItems: "center",
    color: "#11131b",
    background: "linear-gradient(145deg, #b4a8ff, #7be7c9)",
    borderRadius: "12px",
  },
  brandName: {
    color: "#f3f5f8",
    fontSize: "21px",
    fontWeight: 750,
    letterSpacing: "-0.9px",
  },
  brandAccent: {
    color: "#b5a8ff",
  },
  heading: {
    marginBottom: "25px",
  },
  eyebrow: {
    margin: "0 0 12px",
    color: "#a7a0e2",
    fontSize: "10px",
    fontWeight: 750,
    letterSpacing: "1.4px",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "clamp(27px, 7vw, 35px)",
    lineHeight: 1.17,
    letterSpacing: "-1.5px",
  },
  gradient: {
    color: "#b8aaff",
  },
  subtitle: {
    margin: 0,
    color: "#9ca4b5",
    fontSize: "13px",
    lineHeight: 1.8,
  },
  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "5px",
    padding: "5px",
    marginBottom: "23px",
    background: "#0e1017",
    border: "1px solid #292d39",
    borderRadius: "11px",
  },
  tab: {
    minHeight: "39px",
    padding: "8px",
    color: "#9ca4b5",
    fontSize: "12px",
    fontWeight: 650,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "8px",
    cursor: "pointer",
  },
  activeTab: {
    color: "#e6e0ff",
    background: "#27233b",
    borderColor: "#494064",
  },
  form: {
    display: "grid",
    gap: "10px",
  },
  label: {
    marginTop: "6px",
    color: "#a3aabb",
    fontSize: "10px",
    fontWeight: 750,
    letterSpacing: "1px",
  },
  input: {
    width: "100%",
    minHeight: "46px",
    padding: "0 13px",
    color: "#f3f5f8",
    background: "#0f121a",
    border: "1px solid #303544",
    borderRadius: "9px",
    outlineOffset: "2px",
    fontSize: "13px",
  },
  primaryButton: {
    display: "flex",
    width: "100%",
    minHeight: "45px",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "10px",
    padding: "10px 16px",
    color: "#10121a",
    fontSize: "12px",
    fontWeight: 750,
    background: "linear-gradient(105deg, #b9aaff, #83e5ce)",
    border: 0,
    borderRadius: "9px",
    cursor: "pointer",
  },
  error: {
    padding: "11px",
    color: "#ffc3c3",
    background: "#321e25",
    border: "1px solid #65313c",
    borderRadius: "8px",
    fontSize: "12px",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },
  notice: {
    padding: "11px",
    color: "#a5eed8",
    background: "#172923",
    border: "1px solid #2c5144",
    borderRadius: "8px",
    fontSize: "12px",
    lineHeight: 1.7,
    overflowWrap: "anywhere",
  },
  separator: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "22px 0 15px",
    color: "#737c8e",
  },
  separatorLine: {
    flex: 1,
    height: "1px",
    background: "#2b303d",
  },
  guestButton: {
    width: "100%",
    minHeight: "43px",
    padding: "10px",
    color: "#ded8ff",
    background: "#1b1d29",
    border: "1px solid #363348",
    borderRadius: "9px",
    fontSize: "12px",
    fontWeight: 650,
    cursor: "pointer",
  },
  footnote: {
    margin: "18px 0 0",
    color: "#858ea0",
    fontSize: "10px",
    lineHeight: 1.8,
    textAlign: "center",
  },
  muted: {
    color: "#9ca4b5",
    fontSize: "13px",
  },
  sessionBar: {
    position: "relative",
    zIndex: 40,
    display: "flex",
    minHeight: "43px",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "7px 16px",
    color: "#cbd1de",
    background: "#11141d",
    borderBottom: "1px solid #292d39",
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "11px",
  },
  sessionText: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: "8px",
    overflowWrap: "anywhere",
  },
  statusDot: {
    width: "7px",
    height: "7px",
    flexShrink: 0,
    borderRadius: "50%",
  },
  sessionButton: {
    flexShrink: 0,
    padding: "7px 10px",
    color: "#d6ceff",
    background: "#27233b",
    border: "1px solid #494064",
    borderRadius: "7px",
    fontSize: "11px",
    cursor: "pointer",
  },
  globalError: {
    padding: "10px 16px",
    color: "#ffc3c3",
    background: "#321e25",
    fontSize: "12px",
  },
  globalNotice: {
    padding: "10px 16px",
    color: "#a5eed8",
    background: "#172923",
    fontSize: "12px",
  },
};
