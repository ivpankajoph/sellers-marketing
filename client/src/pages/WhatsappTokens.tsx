import React, { useState } from 'react';
import { MessageCircle, Check, TrendingUp, Shield, Clock } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const TokenCard = ({ tokens, price, isPopular, discount }:any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div
      className={`relative bg-white rounded-2xl p-6 transition-all duration-300 ${
        isHovered ? 'scale-105 shadow-2xl' : 'shadow-lg'
      } border-2 ${
        isPopular ? 'border-green-500' : 'border-gray-200'
      } overflow-hidden`}
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

      <div className="relative z-10">
        <div className={`flex items-center justify-center w-16 h-16 mx-auto mb-4 ${
          isPopular 
            ? 'bg-gradient-to-br from-green-400 to-emerald-600' 
            : 'bg-gradient-to-br from-green-500 to-green-600'
        } rounded-full shadow-lg`}>
          <MessageCircle className="w-8 h-8 text-white" />
        </div>

        <h3 className="text-3xl font-bold text-gray-800 text-center mb-2">
          ₹{tokens.toLocaleString()}
        </h3>
        <p className="text-gray-500 text-center text-sm mb-4">WhatsApp Credits</p>

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
            Instant activation
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <Check className="w-4 h-4 mr-2 text-green-500" />
            Valid for 1 year
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <Check className="w-4 h-4 mr-2 text-green-500" />
            24/7 support
          </div>
        </div>
      </div>

      <div className={`absolute inset-0 bg-gradient-to-br ${
        isPopular ? 'from-green-50 to-emerald-50' : 'from-green-50/50 to-emerald-50/50'
      } opacity-0 ${isHovered ? 'opacity-100' : ''} transition-opacity duration-300`} />
    </div>
  );
};

export default function WhatsTokenCardMain() {
  const plans = [
    { tokens: 5000, price: 5000, isPopular: false, discount: null },
    { tokens: 10000, price: 10000, isPopular: true, discount: null },
  ];

  return (
 <DashboardLayout>
       <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md">
              WhatsApp Business API
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 bg-clip-text text-transparent">
            Buy WhatsApp Tokens
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Power your business communication with WhatsApp Business API credits. Send messages, notifications, and more.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <TokenCard key={index} {...plan} />
          ))}
        </div>

        {/* Features Section */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">
            Why Choose Our WhatsApp Credits?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Best Value</h3>
              <p className="text-gray-600 text-sm">
                Direct 1:1 pricing with no hidden charges. Get exactly what you pay for with transparent billing.
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg shadow-md">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Secure & Reliable</h3>
              <p className="text-gray-600 text-sm">
                Official WhatsApp Business API integration with guaranteed message delivery and security.
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-green-700 rounded-lg shadow-md">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Instant Activation</h3>
              <p className="text-gray-600 text-sm">
                Credits are activated immediately after purchase. Start sending messages right away.
              </p>
            </div>
          </div>
        </div>

        {/* What You Can Do Section */}
        <div className="mt-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 text-white shadow-lg">
          <h2 className="text-2xl font-bold text-center mb-6">
            What Can You Do With WhatsApp Credits?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex items-start space-x-3">
              <Check className="w-5 h-5 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Send Marketing Messages</h4>
                <p className="text-sm text-green-50">Reach your customers with promotional offers and updates</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Check className="w-5 h-5 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Transaction Notifications</h4>
                <p className="text-sm text-green-50">Send order confirmations, payment receipts, and shipping updates</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Check className="w-5 h-5 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Customer Support</h4>
                <p className="text-sm text-green-50">Provide instant support and answer customer queries</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Check className="w-5 h-5 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Automated Chatbots</h4>
                <p className="text-sm text-green-50">Build intelligent bots for 24/7 customer engagement</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            * WhatsApp credits are used for sending messages via WhatsApp Business API | All prices in Indian Rupees (₹)
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Questions? Contact our support team at <span className="text-green-600 font-medium">support@example.com</span>
          </p>
        </div>
      </div>
    </div>
 </DashboardLayout>
  );
}