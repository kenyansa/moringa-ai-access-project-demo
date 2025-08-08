// server.js - Complete M-Pesa Backend Integration
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// M-Pesa Configuration
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  businessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE || '174379',
  passkey: process.env.MPESA_PASSKEY,
  callbackURL: process.env.MPESA_CALLBACK_URL,
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke'
};

// In-memory storage (use proper database in production)
const transactions = new Map();

// Utility Functions
function generateTransactionId() {
  return 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatPhoneNumber(phone) {
  // Remove any non-digits
  phone = phone.replace(/\D/g, '');
  
  // If it starts with 0, replace with 254
  if (phone.startsWith('0')) {
    phone = '254' + phone.substring(1);
  }
  
  // If it doesn't start with 254, add it
  if (!phone.startsWith('254')) {
    phone = '254' + phone;
  }
  
  return phone;
}

// Get M-Pesa Access Token
async function getAccessToken() {
  const auth = Buffer.from(
    `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
  ).toString('base64');
  
  try {
    const response = await axios.get(
      `${MPESA_CONFIG.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Access token error:', error.response?.data || error.message);
    throw new Error('Failed to get access token');
  }
}

// Generate STK Push Password
function generatePassword(timestamp) {
  return Buffer.from(
    `${MPESA_CONFIG.businessShortCode}${MPESA_CONFIG.passkey}${timestamp}`
  ).toString('base64');
}

// Validate request data
function validatePaymentRequest(data) {
  const { amount, phoneNumber, accountReference } = data;
  const errors = [];

  if (!amount || isNaN(amount) || parseFloat(amount) < 1) {
    errors.push('Invalid amount');
  }

  const phone = formatPhoneNumber(phoneNumber);
  if (!/^254[0-9]{9}$/.test(phone)) {
    errors.push('Invalid phone number format');
  }

  if (!accountReference || accountReference.length < 3) {
    errors.push('Invalid account reference');
  }

  return { errors, formattedPhone: phone };
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initiate M-Pesa STK Push
app.post('/api/mpesa/initiate', async (req, res) => {
  try {
    const { amount, phoneNumber, accountReference, transactionDesc } = req.body;
    
    // Validate input
    const { errors, formattedPhone } = validatePaymentRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        ResponseCode: '1',
        errorMessage: errors.join(', ')
      });
    }

    // Generate transaction ID and timestamp
    const transactionId = generateTransactionId();
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    
    // Get access token
    const accessToken = await getAccessToken();
    
    // Generate password
    const password = generatePassword(timestamp);
    
    // Prepare STK Push request
    const stkPushData = {
      BusinessShortCode: MPESA_CONFIG.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(parseFloat(amount)),
      PartyA: formattedPhone,
      PartyB: MPESA_CONFIG.businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: MPESA_CONFIG.callbackURL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc || 'Payment for services'
    };

    console.log('STK Push Request:', {
      ...stkPushData,
      Password: '[HIDDEN]'
    });

    // Send STK Push request
    const response = await axios.post(
      `${MPESA_CONFIG.baseURL}/mpesa/stkpush/v1/processrequest`,
      stkPushData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const mpesaResponse = response.data;
    console.log('M-Pesa Response:', mpesaResponse);

    // Store transaction record
    const transaction = {
      transactionId,
      checkoutRequestId: mpesaResponse.CheckoutRequestID,
      merchantRequestId: mpesaResponse.MerchantRequestID,
      amount: parseFloat(amount),
      phoneNumber: formattedPhone,
      accountReference,
      status: 'PENDING',
      timestamp: new Date(),
      mpesaResponse
    };

    transactions.set(transactionId, transaction);

    // Return success response
    res.json({
      ResponseCode: mpesaResponse.ResponseCode,
      ResponseDescription: mpesaResponse.ResponseDescription,
      transactionId,
      CheckoutRequestID: mpesaResponse.CheckoutRequestID
    });

  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    
    res.status(500).json({
      ResponseCode: '1',
      errorMessage: error.response?.data?.errorMessage || 'Payment initiation failed'
    });
  }
});

// M-Pesa Callback Handler
app.post('/api/mpesa/callback', (req, res) => {
  console.log('M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));
  
  try {
    const { Body } = req.body;
    const stkCallback = Body.stkCallback;
    
    // Find transaction by CheckoutRequestID
    const transaction = Array.from(transactions.values()).find(
      t => t.checkoutRequestId === stkCallback.CheckoutRequestID
    );

    if (transaction) {
      if (stkCallback.ResultCode === 0) {
        // Payment successful
        transaction.status = 'SUCCESS';
        transaction.mpesaReceiptNumber = stkCallback.CallbackMetadata?.Item?.find(
          item => item.Name === 'MpesaReceiptNumber'
        )?.Value;
        
        console.log(`Payment successful for transaction ${transaction.transactionId}`);
        
        // Here you would typically:
        // 1. Update your database
        // 2. Send confirmation email/SMS
        // 3. Trigger any business logic
        // 4. Update order status, etc.
        
      } else {
        // Payment failed or cancelled
        transaction.status = 'FAILED';
        transaction.failureReason = stkCallback.ResultDesc;
        
        console.log(`Payment failed for transaction ${transaction.transactionId}: ${stkCallback.ResultDesc}`);
      }
      
      transaction.callbackReceived = new Date();
      transaction.callbackData = stkCallback;
    }

    // Always respond with success to M-Pesa
    res.json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });

  } catch (error) {
    console.error('Callback processing error:', error);
    res.json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });
  }
});

// Query transaction status
app.get('/api/mpesa/status/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  const transaction = transactions.get(transactionId);
  
  if (!transaction) {
    return res.status(404).json({
      error: 'Transaction not found'
    });
  }
  
  res.json({
    transactionId,
    status: transaction.status,
    amount: transaction.amount,
    phoneNumber: transaction.phoneNumber,
    timestamp: transaction.timestamp,
    mpesaReceiptNumber: transaction.mpesaReceiptNumber
  });
});

// Get all transactions (for admin/debugging)
app.get('/api/mpesa/transactions', (req, res) => {
  const allTransactions = Array.from(transactions.values()).map(t => ({
    transactionId: t.transactionId,
    amount: t.amount,
    phoneNumber: t.phoneNumber,
    status: t.status,
    timestamp: t.timestamp,
    mpesaReceiptNumber: t.mpesaReceiptNumber
  }));
  
  res.json(allTransactions);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`M-Pesa server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`M-Pesa Base URL: ${MPESA_CONFIG.baseURL}`);
});

module.exports = app;