import { useState } from 'react';
import { Smartphone, Lock, CreditCard } from 'lucide-react';

type FormStep = 'amount' | 'phone' | 'pin' | 'processing' | 'success' | 'error';

interface FormData {
  amount: string;
  phoneNumber: string;
  pin: string;
}

interface ApiResponse {
  ResponseCode: string;
  errorMessage?: string;
  [key: string]: any; 
}

const MpesaPayment = () => {
  const [step, setStep] = useState<FormStep>('amount');
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    phoneNumber: '',
    pin: ''
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleAmountSubmit = () => {
    if (!formData.amount || parseFloat(formData.amount) < 1) {
      setError('Please enter a valid amount');
      return;
    }
    setError('');
    setStep('phone');
  };

  const handlePhoneSubmit = () => {
    const phoneRegex = /^254[0-9]{9}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      setError('Please enter a valid phone number (254XXXXXXXXX)');
      return;
    }
    setError('');
    setStep('pin');
  };

  const handlePinSubmit = () => {
    if (formData.pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    setError('');
    initiatePayment();
  };

  const initiatePayment = async (): Promise<void> => {
  setLoading(true);
  setStep('processing');
  
  try {
    const response = await fetch('/api/mpesa/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: formData.amount,
        phoneNumber: formData.phoneNumber,
        accountReference: 'ORDER_' + Date.now(),
        transactionDesc: 'Payment for services'
      }),
    });

    const data: ApiResponse = await response.json();

    if (response.ok && data.ResponseCode === '0') {
      setStep('success');
    } else {
      setError(data.errorMessage || 'Payment failed. Please try again.');
      setStep('error');
    }
  } catch (err) {
    setError('Network error. Please check your connection and try again.');
    setStep('error');
  } finally {
    setLoading(false);
  }
};

  const resetForm = () => {
    setStep('amount');
    setFormData({ amount: '', phoneNumber: '', pin: '' });
    setError('');
    setLoading(false);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
    };

    const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
        action();
    }
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">M-Pesa Payment</h1>
          <p className="text-gray-600 mt-2">Secure mobile money payment</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2">
            {['amount', 'phone', 'pin'].map((stepName, index) => (
              <div
                key={stepName}
                className={`w-3 h-3 rounded-full ${
                  step === stepName ? 'bg-green-600' : 
                  ['phone', 'pin'].includes(step) && index === 0 ? 'bg-green-300' :
                  step === 'pin' && index === 1 ? 'bg-green-300' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Amount Step */}
        {step === 'amount' && (
          <div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Amount (KES)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAmountSubmit)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                placeholder="Enter amount"
              />
            </div>
            <button
              onClick={handleAmountSubmit}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
            >
              Continue
            </button>
          </div>
        )}

        {/* Phone Number Step */}
        {step === 'phone' && (
          <div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                M-Pesa Phone Number
              </label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handlePhoneSubmit)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="254712345678"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Amount: KES {formData.amount}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('amount')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition duration-200"
              >
                Back
              </button>
              <button
                onClick={handlePhoneSubmit}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* PIN Step */}
        {step === 'pin' && (
          <div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                M-Pesa PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  maxLength={4}
                  value={formData.pin}
                  onChange={(e) => handleInputChange('pin', e.target.value.replace(/\D/g, ''))}
                  onKeyPress={(e) => handleKeyPress(e, handlePinSubmit)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg tracking-widest"
                  placeholder="••••"
                />
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <p>Amount: KES {formData.amount}</p>
                <p>Phone: {formData.phoneNumber}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('phone')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition duration-200"
              >
                Back
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 disabled:opacity-50"
              >
                Pay Now
              </button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Payment</h3>
            <p className="text-gray-600">Please wait while we process your payment...</p>
            <p className="text-sm text-gray-500 mt-4">
              Check your phone for M-Pesa prompt
            </p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="text-center">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Payment Successful!</h3>
            <p className="text-gray-600 mb-6">Your payment has been processed successfully.</p>
            <button
              onClick={resetForm}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
            >
              Make Another Payment
            </button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="text-center">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Payment Failed</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('pin')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition duration-200"
              >
                Try Again
              </button>
              <button
                onClick={resetForm}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MpesaPayment;