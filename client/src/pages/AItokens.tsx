import React, { useState } from 'react';
import { Zap, Check, TrendingUp, Shield, Clock } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const TokenCard = ({ tokens, price, isPopular, discount }: any) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative bg-white rounded-2xl p-6 transition-all duration-300 ${
        isHovered ? 'scale-105 shadow-2xl' : 'shadow-lg'
      } border-2 ${isPopular ? 'border-green-500' : 'border-gray-200'} overflow-hidden`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isPopular && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg shadow-md">
          POPULAR
        </div>
      )}

      {discount && (
        <div className="absolute top-0 left-0 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-br-lg shadow-md">
          Save {discount}%
        </div>
      )}

      <div className="relative">
        <div
          className={`flex items-center justify-center w-16 h-16 mx-auto mb-4 ${
            isPopular
              ? 'bg-gradient-to-br from-green-400 to-emerald-600'
              : 'bg-gradient-to-br from-green-500 to-green-600'
          } rounded-full shadow-lg`}
        >
          <Zap className="w-8 h-8 text-white" />
        </div>

        <h3 className="text-3xl font-bold text-gray-800 text-center mb-2">
          {tokens.toLocaleString()}
        </h3>
        <p className="text-gray-500 text-center text-sm mb-4">Tokens</p>

        <div className="text-center mb-6">
          <span className="text-5xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            ₹{price}
          </span>
        </div>

        <button
          className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
            isPopular
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg'
              : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md'
          } ${isHovered ? 'shadow-xl transform -translate-y-1' : ''}`}
        >
          Buy Now
        </button>

        <div className="mt-6 space-y-2">
          <div className="flex items-center text-gray-600 text-sm">
            <Check className="w-4 h-4 mr-2 text-green-500" />
            Instant delivery
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <Check className="w-4 h-4 mr-2 text-green-500" />
            No expiration
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <Check className="w-4 h-4 mr-2 text-green-500" />
            24/7 support
          </div>
        </div>
      </div>

      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          isPopular ? 'from-green-50 to-emerald-50' : 'from-green-50/50 to-emerald-50/50'
        } opacity-0 ${isHovered ? 'opacity-100' : ''} transition-opacity duration-300`}
      />
    </div>
  );
};

export default function TokenCardMain() {
  const plans = [
    { tokens: 100000, price: 499, isPopular: false, discount: null },
    { tokens: 300000, price: 999, isPopular: true, discount: 33 },
    { tokens: 600000, price: 1500, isPopular: false, discount: 50 },
    { tokens: 1000000, price: 2199, isPopular: false, discount: 56 },
  ];

  return (
    <DashboardLayout>
      {/* ✅ DO NOT use min-h-screen or absolute full-screen backgrounds */}
      <div className="p-6 space-y-12">
        {/* Background gradients applied ONLY via Tailwind background on content */}
        <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-3xl p-8 relative overflow-hidden">
          {/* Confined background effects */}
          <div className="absolute inset-0 overflow-hidden -z-10">
            <div className="absolute top-1/4 -left-16 w-96 h-96 bg-green-200/30 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -right-16 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
          </div>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md">
                Special Offer
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 bg-clip-text text-transparent">
              Buy AI Tokens
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Power your AI applications with our flexible token packages. Choose the plan that fits your needs.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {plans.map((plan, index) => (
              <TokenCard key={index} {...plan} />
            ))}
          </div>

          {/* Features Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">
              Why Choose Our Tokens?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Best Value</h3>
                <p className="text-gray-600 text-sm">
                  Get more tokens for less with our bulk pricing. Save up to 56% on larger packages.
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg shadow-md">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Secure Payment</h3>
                <p className="text-gray-600 text-sm">
                  Your transactions are protected with industry-standard encryption and security.
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg shadow-md">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Instant Access</h3>
                <p className="text-gray-600 text-sm">
                  Tokens are credited to your account immediately after purchase. No waiting time.
                </p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-10 text-center">
            <p className="text-gray-500 text-sm">
              * 1 Token = 1 Character for AI text generation | All prices in Indian Rupees (₹)
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Questions? Contact our support team at{' '}
              <span className="text-green-600 font-medium">support@example.com</span>
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}