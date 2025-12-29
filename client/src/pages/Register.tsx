import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, AlertCircle, User, Mail, Phone, Lock, Chrome, Check, X, ChevronDown } from "lucide-react";

const countries = [
    { code: "91", flag: "🇮🇳", name: "India" },
    { code: "1", flag: "🇺🇸", name: "USA" },
    { code: "44", flag: "🇬🇧", name: "UK" },
    { code: "86", flag: "🇨🇳", name: "China" },
    { code: "81", flag: "🇯🇵", name: "Japan" },
    { code: "49", flag: "🇩🇪", name: "Germany" },
    { code: "33", flag: "🇫🇷", name: "France" },
    { code: "61", flag: "🇦🇺", name: "Australia" },
    { code: "7", flag: "🇷🇺", name: "Russia" },
    { code: "55", flag: "🇧🇷", name: "Brazil" },
    { code: "27", flag: "🇿🇦", name: "South Africa" },
    { code: "82", flag: "🇰🇷", name: "South Korea" },
    { code: "34", flag: "🇪🇸", name: "Spain" },
    { code: "39", flag: "🇮🇹", name: "Italy" },
    { code: "31", flag: "🇳🇱", name: "Netherlands" },
];

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [countryCode, setCountryCode] = useState("91");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [, setLocation] = useLocation();

    const API_URL = "/api";

    const passwordValidation = {
        minLength: password.length >= 6,
        hasUpperCase: /[A-Z]/.test(password),
        hasLowerCase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const passwordsMatch = password === confirmPassword && confirmPassword !== "";

    const getPasswordStrength = () => {
        const validCount = Object.values(passwordValidation).filter(Boolean).length;
        if (validCount <= 2) return { text: "Weak", color: "text-red-600", bg: "bg-red-500" };
        if (validCount <= 3) return { text: "Medium", color: "text-yellow-600", bg: "bg-yellow-500" };
        return { text: "Strong", color: "text-green-600", bg: "bg-green-500" };
    };

    const passwordStrength = getPasswordStrength();

    const sendOTP = async () => {
        const fullPhone = `${countryCode}${phone}`;
        
        if (!phone || phone.length < 10) {
            setError("Please enter a valid phone number");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_URL}/auth/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: fullPhone }),
            });

            const data = await response.json();

            if (response.ok) {
                setOtpSent(true);
                alert("OTP sent to your WhatsApp!");
            } else {
                setError(data.message || "Failed to send OTP");
            }
        } catch (err) {
            setError("Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const verifyOTP = async () => {
        const fullPhone = `${countryCode}${phone}`;
        
        if (!otp || otp.length !== 6) {
            setError("Please enter a valid 6-digit OTP");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_URL}/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: fullPhone, otp }),
            });

            const data = await response.json();

            if (response.ok) {
                setOtpVerified(true);
                alert("Phone number verified!");
            } else {
                setError(data.message || "Invalid OTP");
            }
        } catch (err) {
            setError("OTP verification failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            window.location.href = `${API_URL}/auth/google`;
        } catch (err) {
            setError("Google sign-in failed");
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        setError("");

        if (!otpVerified) {
            setError("Please verify your phone number first");
            return;
        }

        if (!passwordValidation.minLength) {
            setError("Password must be at least 6 characters");
            return;
        }

        if (!passwordsMatch) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const fullPhone = `${countryCode}${phone}`;
            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, phone: fullPhone }),
            });

            const data = await response.json();

            if (response.ok) {
                alert("Account created successfully!");
                setLocation("/");
            } else {
                setError(data.message || "Registration failed");
            }
        } catch (err) {
            setError("Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const selectedCountry = countries.find(c => c.code === countryCode);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-0">
                <CardHeader className="text-center space-y-4 pb-2">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <MessageSquare className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-gray-900">WhatsApp Business API</CardTitle>
                        <CardDescription className="text-gray-500 mt-1">Create your account</CardDescription>
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
                            <Label htmlFor="register-name" className="text-gray-700">Full Name</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    id="register-name"
                                    type="text"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="register-email" className="text-gray-700">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    id="register-email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="register-phone" className="text-gray-700">Phone Number</Label>
                            <div className="relative flex gap-2">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                        className="h-10 px-3 flex items-center gap-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={otpVerified}
                                    >
                                        <span className="text-2xl leading-none">{selectedCountry?.flag}</span>
                                        <span className="text-sm font-medium">+{countryCode}</span>
                                        <ChevronDown className="h-3 w-3 text-gray-400" />
                                    </button>
                                    {showCountryDropdown && !otpVerified && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-10" 
                                                onClick={() => setShowCountryDropdown(false)}
                                            />
                                            <div className="absolute top-full mt-1 w-72 bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                                                {countries.map((country) => (
                                                    <button
                                                        key={country.code}
                                                        type="button"
                                                        onClick={() => {
                                                            setCountryCode(country.code);
                                                            setShowCountryDropdown(false);
                                                        }}
                                                        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-100 text-left transition-colors"
                                                    >
                                                        <span className="text-2xl leading-none">{country.flag}</span>
                                                        <span className="text-sm flex-1">{country.name}</span>
                                                        <span className="text-sm text-gray-600 font-medium">+{country.code}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="relative flex-1">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="register-phone"
                                        type="tel"
                                        placeholder="1234567890"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                        className="pl-10"
                                        disabled={otpVerified}
                                    />
                                </div>
                            </div>
                            {!otpSent && !otpVerified && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={sendOTP}
                                    disabled={loading}
                                    className="w-full mt-2"
                                >
                                    Send OTP
                                </Button>
                            )}
                        </div>

                        {otpSent && !otpVerified && (
                            <div className="space-y-2">
                                <Label htmlFor="otp" className="text-gray-700">Enter OTP</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    placeholder="6-digit code"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    maxLength={6}
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={verifyOTP}
                                        disabled={loading}
                                        className="flex-1"
                                    >
                                        Verify OTP
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={sendOTP}
                                        disabled={loading}
                                        className="flex-1"
                                    >
                                        Resend
                                    </Button>
                                </div>
                            </div>
                        )}

                        {otpVerified && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                                <Check className="h-4 w-4" />
                                <span className="font-medium">Phone verified</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="register-password" className="text-gray-700">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    id="register-password"
                                    type="password"
                                    placeholder="Create a strong password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            
                            {password && (
                                <div className="space-y-2 mt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600">Password strength:</span>
                                        <span className={`text-xs font-semibold ${passwordStrength.color}`}>
                                            {passwordStrength.text}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${passwordStrength.bg} transition-all duration-300`}
                                            style={{ 
                                                width: `${(Object.values(passwordValidation).filter(Boolean).length / 5) * 100}%` 
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1 pt-1">
                                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                                            {passwordValidation.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                            <span>At least 6 characters</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                                            {passwordValidation.hasUpperCase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                            <span>One uppercase letter</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                                            {passwordValidation.hasLowerCase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                            <span>One lowercase letter</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                                            {passwordValidation.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                            <span>One number</span>
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                                            {passwordValidation.hasSpecialChar ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                            <span>One special character</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password" className="text-gray-700">Confirm Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            {confirmPassword && (
                                <div className={`flex items-center gap-2 text-xs ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                                    {passwordsMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                    <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                                </div>
                            )}
                        </div>
                        
                        <Button
                            onClick={handleRegister}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                            disabled={loading || !otpVerified || !passwordsMatch}
                        >
                            {loading ? "Creating account..." : "Create Account"}
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
                            Sign up with Google
                        </Button>

                        <div className="text-center text-sm text-gray-600 mt-4">
                            Already have an account?{" "}
                            <Link href="/login" className="text-emerald-600 hover:underline font-medium">
                                Sign in
                            </Link>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}