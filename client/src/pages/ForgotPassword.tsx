import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, KeyRound, MailCheck } from "lucide-react";

type ForgotPasswordResponse = {
  success?: boolean;
  message?: string;
  debugResetUrl?: string;
  error?: string;
};

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [debugResetUrl, setDebugResetUrl] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setDebugResetUrl("");

    if (!identifier.trim()) {
      setError("Please enter your email or username.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = (await response.json()) as ForgotPasswordResponse;

      if (!response.ok) {
        setError(data.error || "Could not process request right now.");
        return;
      }

      setMessage(
        data.message ||
          "If your account exists, a password reset link has been sent."
      );
      if (data.debugResetUrl) {
        setDebugResetUrl(data.debugResetUrl);
      }
    } catch (requestError) {
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
            <KeyRound className="h-7 w-7 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Forgot Password
            </CardTitle>
            <CardDescription className="text-gray-500 mt-1">
              Enter your email or username to reset your password
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              <MailCheck className="h-4 w-4 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-gray-700">
                Email or Username
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Enter email or username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              disabled={loading}
            >
              {loading ? "Sending reset link..." : "Send Reset Link"}
            </Button>
          </form>

          {debugResetUrl && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">Development reset link</p>
              <Link
                href={debugResetUrl.replace(/^https?:\/\/[^/]+/, "")}
                className="underline break-all"
              >
                {debugResetUrl}
              </Link>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
