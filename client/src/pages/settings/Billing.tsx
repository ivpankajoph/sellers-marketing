import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Transaction {
  id: string;
  wallet: "aitoken" | "whatsapp";
  type: "deposit";
  amount: number;
  createdAt: string;
}

interface Billing {
  aitokenWallet: number;
  whatsappWallet: number;
  transactions: Transaction[];
}

const whatsappAccount = {
  connected: true,
  name: "Life Changing Networks",
  displayPhoneNumber: "+91 98765 43210",
  phoneNumberId: "848441401690739",
  whatsappBusinessAccountId: "3646219455517188",
};

const COMPANY_NAME = "Life Changing Networks";
const COMPANY_ADDRESS = "Office No. 834, Gaur Chowk, Amrapali Leisure Valley, Noida, Greater Noida, Uttar Pradesh 201318";

const getInitialData = (): Billing => {
  const stored = localStorage.getItem("billing_data");
  if (stored) {
    return JSON.parse(stored);
  }

  const initialData: Billing = {
    aitokenWallet: 1500,
    whatsappWallet: 2500,
    transactions: [
      {
        id: "txn_001",
        wallet: "whatsapp",
        type: "deposit",
        amount: 1000,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "txn_002",
        wallet: "aitoken",
        type: "deposit",
        amount: 500,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "txn_003",
        wallet: "whatsapp",
        type: "deposit",
        amount: 1500,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "txn_004",
        wallet: "aitoken",
        type: "deposit",
        amount: 1000,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };

  localStorage.setItem("billing_data", JSON.stringify(initialData));
  return initialData;
};

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg animate-in slide-in-from-top ${
        type === "success" ? "bg-green-500" : "bg-red-500"
      } text-white font-medium`}
    >
      {message}
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [billing, setBilling] = useState<Billing>(getInitialData());
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isWaDialogOpen, setIsWaDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const downloadReceipt = (transaction: Transaction) => {
    try {
      const doc = new jsPDF();

      // Company Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(COMPANY_NAME, 14, 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const addressLines = doc.splitTextToSize(COMPANY_ADDRESS, 170);
      doc.text(addressLines, 14, 26);

      // Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Payment Receipt", 14, 46);

      // Transaction Details
      autoTable(doc, {
        startY: 54,
        theme: "grid",
        head: [["Field", "Details"]],
        body: [
          ["Receipt No.", transaction.id],
          ["Date & Time", formatDate(transaction.createdAt)],
          ["Wallet", transaction.wallet === "aitoken" ? "AI Token Wallet" : "WhatsApp Wallet"],
          ["Description", "Deposit"],
          ["Amount (INR)", `₹${transaction.amount.toLocaleString("en-IN")}`],
          ["Status", "Completed"],
        ],
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("This is a computer-generated receipt. No signature required.", 14, finalY);

      doc.save(`receipt-${transaction.id}.pdf`);
      setToast({ message: "Receipt downloaded!", type: "success" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      setToast({ message: "Failed to generate receipt", type: "error" });
    }
  };

  const handleDeposit = (wallet: "aitoken" | "whatsapp") => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0 || isNaN(amount)) {
      setToast({ message: "Please enter a valid amount", type: "error" });
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const newTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        wallet,
        type: "deposit",
        amount,
        createdAt: new Date().toISOString(),
      };

      const updatedBilling: Billing = {
        ...billing,
        aitokenWallet:
          wallet === "aitoken" ? billing.aitokenWallet + amount : billing.aitokenWallet,
        whatsappWallet:
          wallet === "whatsapp" ? billing.whatsappWallet + amount : billing.whatsappWallet,
        transactions: [...billing.transactions, newTransaction],
      };

      localStorage.setItem("billing_data", JSON.stringify(updatedBilling));
      setBilling(updatedBilling);
      setIsAiDialogOpen(false);
      setIsWaDialogOpen(false);
      setDepositAmount("");
      setIsLoading(false);
      setToast({ message: "Amount added to wallet successfully!", type: "success" });
    }, 800);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const QuickAmountButtons = ({ onClick }: { onClick: (amt: string) => void }) => (
    <div className="grid grid-cols-3 gap-2">
      {[100, 500, 1000].map((amt) => (
        <button
          key={amt}
          className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          onClick={() => onClick(amt.toString())}
        >
          ₹{amt}
        </button>
      ))}
    </div>
  );

  const DepositModalContent = ({ wallet }: { wallet: "aitoken" | "whatsapp" }) => (
    <>
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Amount (INR)</label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 100"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            min="1"
            step="1"
          />
        </div>
        <QuickAmountButtons onClick={setDepositAmount} />
      </div>
      <div className="p-6 border-t bg-slate-50 flex justify-end gap-2">
        <button
          className="px-4 py-2 border border-slate-300 rounded-md hover:bg-white transition-colors"
          onClick={() => {
            wallet === "aitoken" ? setIsAiDialogOpen(false) : setIsWaDialogOpen(false);
            setDepositAmount("");
          }}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
          onClick={() => handleDeposit(wallet)}
          disabled={isLoading}
        >
          {isLoading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          Confirm
        </button>
      </div>
    </>
  );

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Billing & Wallets</h2>
            <p className="text-slate-600 mt-1">Manage your INR wallets for AI and WhatsApp services.</p>
          </div>

          {/* WhatsApp Account Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-slate-900">WhatsApp Account</h3>
                <p className="text-sm text-slate-600">Connected business profile</p>
              </div>
              <svg
                className="h-6 w-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div className="p-6">
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Business Name:</span> {whatsappAccount.name}
                </p>
                <p>
                  <span className="font-medium">Phone:</span> {whatsappAccount.displayPhoneNumber}
                </p>
                <p>
                  <span className="font-medium">Phone Number ID:</span> {whatsappAccount.phoneNumberId}
                </p>
                <p>
                  <span className="font-medium">WABA ID:</span>{" "}
                  {whatsappAccount.whatsappBusinessAccountId}
                </p>
              </div>
            </div>
          </div>

          {/* Wallet Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* AI Token Wallet */}
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-200 shadow-sm">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-slate-900">AI Token Wallet</h3>
                  <p className="text-sm text-slate-600">For AI-powered features</p>
                </div>
                <svg
                  className="h-5 w-5 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-slate-600">₹</span>
                  <span className="text-3xl font-bold text-slate-900">
                    {billing.aitokenWallet.toLocaleString("en-IN")}
                  </span>
                </div>
                <button
                  className="mt-3 w-full px-4 py-2 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  onClick={() => setIsAiDialogOpen(true)}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Money
                </button>
              </div>
            </div>

            {/* WhatsApp Wallet */}
            <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-200 shadow-sm">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-slate-900">WhatsApp Wallet</h3>
                  <p className="text-sm text-slate-600">For WhatsApp messaging</p>
                </div>
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-slate-600">₹</span>
                  <span className="text-3xl font-bold text-slate-900">
                    {billing.whatsappWallet.toLocaleString("en-IN")}
                  </span>
                </div>
                <button
                  className="mt-3 w-full px-4 py-2 border border-green-300 rounded-md hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                  onClick={() => setIsWaDialogOpen(true)}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Money
                </button>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="p-6 border-b">
              <h3 className="text-lg font-medium text-slate-900">Transaction History</h3>
              <p className="text-sm text-slate-600">All wallet deposits in INR.</p>
            </div>
            <div className="p-6">
              {billing.transactions && billing.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left text-sm font-medium text-slate-600">
                        <th className="pb-3">Date & Time</th>
                        <th className="pb-3">Wallet</th>
                        <th className="pb-3">Description</th>
                        <th className="pb-3 text-right">Amount (₹)</th>
                        <th className="pb-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.transactions
                        .slice()
                        .reverse()
                        .map((transaction) => (
                          <tr key={transaction.id} className="border-b last:border-0">
                            <td className="py-4 font-medium text-sm">
                              {formatDate(transaction.createdAt)}
                            </td>
                            <td className="py-4">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                                  transaction.wallet === "aitoken"
                                    ? "border border-blue-500 text-blue-600 bg-blue-50"
                                    : "border border-green-500 text-green-600 bg-green-50"
                                }`}
                              >
                                {transaction.wallet === "aitoken" ? "AI Token" : "WhatsApp"}
                              </span>
                            </td>
                            <td className="py-4 text-sm">Deposit</td>
                            <td className="py-4 text-right font-medium text-green-600">
                              +₹{transaction.amount.toLocaleString("en-IN")}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                className="p-2 hover:bg-slate-100 rounded-md transition-colors"
                                onClick={() => downloadReceipt(transaction)}
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">No transactions yet.</div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-500">
            All balances and transactions are in Indian Rupees (₹).
          </p>
        </div>

        {/* AI Wallet Modal */}
        <Modal
          isOpen={isAiDialogOpen}
          onClose={() => {
            setIsAiDialogOpen(false);
            setDepositAmount("");
          }}
          title="Add to AI Wallet"
          description="Add INR to use AI services."
        >
          <DepositModalContent wallet="aitoken" />
        </Modal>

        {/* WhatsApp Wallet Modal */}
        <Modal
          isOpen={isWaDialogOpen}
          onClose={() => {
            setIsWaDialogOpen(false);
            setDepositAmount("");
          }}
          title="Add to WhatsApp Wallet"
          description="Add INR to send WhatsApp messages."
        >
          <DepositModalContent wallet="whatsapp" />
        </Modal>
      </div>
    </DashboardLayout>
  );
}