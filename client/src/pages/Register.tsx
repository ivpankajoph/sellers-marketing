import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";

type CountryOption = {
  iso2: string;
  dialCode: string;
  name: string;
};

const countries: CountryOption[] = [
  { iso2: "in", dialCode: "+91", name: "India" },
  { iso2: "us", dialCode: "+1", name: "United States" },
  { iso2: "gb", dialCode: "+44", name: "United Kingdom" },
  { iso2: "ae", dialCode: "+971", name: "United Arab Emirates" },
  { iso2: "sg", dialCode: "+65", name: "Singapore" },
  { iso2: "au", dialCode: "+61", name: "Australia" },
  { iso2: "de", dialCode: "+49", name: "Germany" },
  { iso2: "fr", dialCode: "+33", name: "France" },
  { iso2: "it", dialCode: "+39", name: "Italy" },
  { iso2: "br", dialCode: "+55", name: "Brazil" },
];

const passwordRules = {
  minLength: {
    label: "At least 6 characters",
    test: (value: string) => value.length >= 6,
  },
  uppercase: {
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  lowercase: {
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  number: {
    label: "One number",
    test: (value: string) => /[0-9]/.test(value),
  },
};

function getFlagUrl(iso2: string): string {
  return `https://flagcdn.com/w40/${iso2}.png`;
}

export default function Register() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [countryIso, setCountryIso] = useState("in");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const [, setLocation] = useLocation();

  const selectedCountry = useMemo(
    () => countries.find((country) => country.iso2 === countryIso) ?? countries[0],
    [countryIso]
  );

  const passwordChecks = useMemo(
    () =>
      Object.entries(passwordRules).map(([key, rule]) => ({
        key,
        label: rule.label,
        passed: rule.test(password),
      })),
    [password]
  );

  const matchedPassword = confirmPassword.length > 0 && password === confirmPassword;
  const score = passwordChecks.filter((check) => check.passed).length;
  const strength =
    score <= 1
      ? { label: "Weak", bar: "33%", color: "text-rose-600", bg: "bg-rose-500" }
      : score <= 3
        ? { label: "Medium", bar: "66%", color: "text-amber-600", bg: "bg-amber-500" }
        : { label: "Strong", bar: "100%", color: "text-emerald-600", bg: "bg-emerald-500" };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanUsername || !password) {
      setError("Name, username, and password are required.");
      return;
    }

    if (passwordChecks.some((check) => !check.passed)) {
      setError("Please set a stronger password that meets all requirements.");
      return;
    }

    if (!matchedPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await register(
        cleanUsername,
        password,
        cleanName,
        cleanEmail || undefined
      );

      if (!result.success) {
        setError(result.error || "Unable to create account.");
        return;
      }

      toast.success("Account created successfully");
      setLocation("/");
    } catch (registerError) {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_15%,#d1fae5_0%,#f5faf9_35%,#ecfdf5_70%,#e6f4ef_100%)]">
      <div className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-10 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-lime-300/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_30px_80px_-32px_rgba(8,47,38,0.45)] backdrop-blur lg:grid-cols-[1.05fr_1fr]">
          <aside className="hidden border-r border-emerald-100/70 bg-[linear-gradient(160deg,#073d2f_0%,#0b5d47_46%,#0f766e_100%)] p-9 text-white lg:flex lg:flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" />
              Premium Onboarding
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight font-heading">
              Build your WhatsApp growth engine.
            </h1>
            <p className="mt-4 max-w-md text-emerald-100/90">
              Create your workspace in under a minute and launch campaigns, automations,
              and analytics from one polished dashboard.
            </p>
            <div className="mt-10 space-y-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <p className="text-sm text-emerald-100/90">
                  Smart contact targeting, template campaigns, and AI-powered responses.
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-200" />
                  <p className="text-sm text-emerald-100/90">
                    Enterprise-grade account security and granular role management.
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-auto text-xs tracking-[0.2em] text-emerald-100/70 uppercase">
              WhatsApp Business API Suite
            </p>
          </aside>

          <section className="p-5 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/35">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
                  Create account
                </p>
                <h2 className="text-2xl font-black text-slate-900 font-heading">Sign Up</h2>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleRegister}>
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-name" className="text-slate-700">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Jane Smith"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-username" className="text-slate-700">
                    Username
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="janesmith"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email" className="text-slate-700">
                  Email (optional)
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-phone" className="text-slate-700">
                  WhatsApp Number (optional)
                </Label>
                <div className="relative flex gap-2">
                  <button
                    type="button"
                    className="flex h-11 min-w-36 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/50"
                    onClick={() => setShowCountryDropdown((open) => !open)}
                    aria-expanded={showCountryDropdown}
                  >
                    <img
                      src={getFlagUrl(selectedCountry.iso2)}
                      alt={`${selectedCountry.name} flag`}
                      className="h-4 w-6 rounded-sm object-cover shadow-sm"
                    />
                    <span className="text-sm font-semibold">{selectedCountry.dialCode}</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-500" />
                  </button>
                  <div className="relative flex-1">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                      className="h-11 rounded-xl border-slate-200 pl-10 focus-visible:ring-emerald-500"
                    />
                  </div>

                  {showCountryDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowCountryDropdown(false)}
                      />
                      <div className="absolute left-0 top-12 z-20 max-h-64 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                        {countries.map((country) => (
                          <button
                            type="button"
                            key={country.iso2}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-emerald-50"
                            onClick={() => {
                              setCountryIso(country.iso2);
                              setShowCountryDropdown(false);
                            }}
                          >
                            <img
                              src={getFlagUrl(country.iso2)}
                              alt={`${country.name} flag`}
                              className="h-4 w-6 rounded-sm object-cover shadow-sm"
                            />
                            <span className="flex-1 text-slate-700">{country.name}</span>
                            <span className="font-medium text-slate-500">{country.dialCode}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password" className="text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 rounded-xl border-slate-200 px-10 focus-visible:ring-emerald-500"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {password.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500">Password strength</span>
                      <span className={`font-semibold ${strength.color}`}>{strength.label}</span>
                    </div>
                    <div className="mb-3 h-1.5 rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${strength.bg}`}
                        style={{ width: strength.bar }}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                      {passwordChecks.map((check) => (
                        <div
                          key={check.key}
                          className={`inline-flex items-center gap-1.5 ${
                            check.passed ? "text-emerald-700" : "text-slate-500"
                          }`}
                        >
                          <CheckCircle2
                            className={`h-3.5 w-3.5 ${check.passed ? "opacity-100" : "opacity-35"}`}
                          />
                          <span>{check.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-slate-700">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 rounded-xl border-slate-200 px-10 focus-visible:ring-emerald-500"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <p
                    className={`text-xs ${matchedPassword ? "text-emerald-700" : "text-rose-600"}`}
                  >
                    {matchedPassword ? "Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-base font-semibold shadow-lg shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-600"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-emerald-700 transition hover:text-emerald-800 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
