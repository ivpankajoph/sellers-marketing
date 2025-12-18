// src/app/login/Login.tsx
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, AlertCircle, AtSign, Chrome, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(identifier, password);
      if (success) {
        toast.success("Welcome back!");
        setLocation("/");
      } else {
        setError("Invalid email/username or password");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const API_URL = "http://localhost:8080/api";

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      window.location.href = `${API_URL}/auth/google`;
    } catch (err) {
      setError("Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">WhatsApp Business API</CardTitle>
            <CardDescription className="text-gray-500 mt-1">Sign in to your dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-identifier" className="text-gray-700">Email or Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="login-identifier"
                  type="text"
                  placeholder="Enter email or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
          </div>
          <Link href="/register" className="text-emerald-600 hover:underline font-medium">
            Sign up
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}