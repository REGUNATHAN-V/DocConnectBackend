const express = require("express");
const router = express.Router();
const Bank = require("../models/BankInfo");
const TransactionHistory = require('../models/TransactionDetails'); 
// const UPILiteTransaction = require("../models/UPILiteTransaction");


// const paytmchecksum = require('paytmchecksum');

// const merchantKey = "your-merchant-key";
// const merchantId = "your-merchant-id";
// const website = "your-website";
// const channelId = "WEB";
// const industryTypeId = "Retail";

// API to initiate real payment
// router.post("/bank-to-bank", async (req, res) => {
//     try {
//         const {
//             senderAccount,
//             senderName,
//             senderIfscCode,
//             receiverName,
//             receiverAccount,
//             receiverIfscCode,
//             amount
//         } = req.body;

//         if (!senderAccount || !senderName || !senderIfscCode || !receiverName || !receiverAccount || !receiverIfscCode || !amount) {
//             return res.status(400).json({ error: "All fields are required" });
//         }

//         const numericAmount = Number(amount);
//         if (isNaN(numericAmount) || numericAmount <= 0) {
//             return res.status(400).json({ error: "Amount must be valid" });
//         }

//         const sender = await Bank.findOne({ accountNumber: senderAccount, ifscCode: senderIfscCode });
//         const receiver = await Bank.findOne({ accountNumber: receiverAccount, ifscCode: receiverIfscCode });

//         if (!sender || !receiver) {
//             return res.status(404).json({ error: "Sender or Receiver account not found" });
//         }

//         if (sender.bankBalance < numericAmount) {
//             return res.status(400).json({ error: "Insufficient balance in sender's account" });
//         }

//         // Step 1: Create a payment request with Paytm
//         const orderId = `ORDER-${new Date().getTime()}`;
//         const paramList = {
//             MID: merchantId,
//             ORDERID: orderId,
//             CUSTID: senderAccount, // or use a unique customer ID
//             TXN_AMOUNT: numericAmount.toFixed(2),
//             CHANNELID: channelId,
//             INDUSTRY_TYPE_ID: industryTypeId,
//             WEBSITE: website,
//             CALLBACKURL: "http://yourserver.com/callback",
//         };

//         const checksum = await paytmchecksum.generateSignature(paramList, merchantKey);
//         paramList.CHECKSUMHASH = checksum;

//         // Send payment params to frontend
//         res.json({
//             paymentParams: paramList,
//             orderId: orderId,
//         });

//     } catch (error) {
//         console.error("Error processing transaction:", error);
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// });

// // API to handle Paytm payment callback and verify transaction status
// router.post("/callback", async (req, res) => {
//     const paytmParams = req.body;
//     const checksumHash = paytmParams.CHECKSUMHASH;

//     // Step 2: Verify the payment status
//     const isValid = paytmchecksum.verifySignature(paytmParams, merchantKey, checksumHash);

//     if (isValid) {
//         if (paytmParams.STATUS === "TXN_SUCCESS") {
//             const { senderAccount, receiverAccount, TXN_AMOUNT } = paytmParams;

//             // Step 3: Update the bank balances
//             const sender = await Bank.findOne({ accountNumber: senderAccount });
//             const receiver = await Bank.findOne({ accountNumber: receiverAccount });

//             if (sender.bankBalance < TXN_AMOUNT) {
//                 return res.status(400).json({ error: "Insufficient funds" });
//             }

//             sender.bankBalance -= TXN_AMOUNT;
//             receiver.bankBalance += TXN_AMOUNT;

//             await sender.save();
//             await receiver.save();

//             // Step 4: Record the transaction
//             const transaction = new TransactionHistory({
//                 senderAccount,
//                 senderName: sender.accountHolderName,
//                 senderIfscCode: sender.ifscCode,
//                 receiverName: receiver.accountHolderName,
//                 receiverAccount,
//                 receiverIfscCode: receiver.ifscCode,
//                 amount: TXN_AMOUNT,
//                 status: "success",
//             });

//             await transaction.save();

//             return res.json({
//                 message: "Transaction Successful",
//                 transactionId: transaction._id,
//                 status: "success",
//                 transactionDate: transaction.timestamp,
//             });
//         } else {
//             return res.status(400).json({ error: "Transaction failed" });
//         }
//     } else {
//         return res.status(400).json({ error: "Checksum verification failed" });
//     }
// });

router.post("/bank-to-bank", async (req, res) => {
    console.log(req.body);
    try {
        const {
            senderAccount,
            senderName,
            senderIfscCode,
            senderBankName,
            receiverName,
            receiverAccount,
            receiverIfscCode,
             receiverBankName,
            amount
        } = req.body;

        if (!senderAccount || !senderName || !senderIfscCode || !receiverName || !receiverAccount || !receiverIfscCode || !amount) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const numericAmount = Number(amount);
        console.log("numericAmount",numericAmount)
        if (!senderAccount || !senderName || !senderIfscCode || !receiverName || !receiverAccount || !receiverIfscCode || isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: "All fields are required and amount must be valid" });
        }

        const sender = await Bank.findOne({ accountNumber: senderAccount, ifscCode: senderIfscCode });
        // console.log("sender",sender)
        // console.log("sender",typeof sender)
        const receiver = await Bank.findOne({ accountNumber: receiverAccount, ifscCode: receiverIfscCode });
        // console.log('receiver',receiver)
        // console.log('receiver',typeof receiver)

        if (!sender || !receiver) {
            return res.status(404).json({ error: "Sender or Receiver account not found" });
        }

        if (sender.bankBalance < numericAmount) {
            return res.status(400).json({ error: "Insufficient balance in sender's account" });
        }

        const transactionStatus = Math.random() > 0.1 ? "success" : "failed";

        if (transactionStatus === "success") {
            sender.bankBalance -= numericAmount;
            receiver.bankBalance += numericAmount;
            console.log('sender.bankBalance',sender.bankBalance);
            console.log('receiver.bankBalance',receiver.bankBalance);

            await sender.save();
            await receiver.save();
        }


        // Save transaction record
        const transaction = new TransactionHistory({
            through: "BankToBank",
            senderAccount,
            senderName,
            senderIfscCode,
            senderBankName,
            receiverName,           
            receiverBankName,
            receiverAccount,
            receiverIfscCode,
            amount,
            status: transactionStatus,
        });

        await transaction.save();

        res.json({
            message: transactionStatus === "success" ? "Transaction successful" : "Transaction failed",
            transactionId: transaction._id,
            status: transactionStatus,
            transactionDate: transaction.timestamp,
        });
    } catch (error) {
        console.error("Error processing transaction:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


//balance checking api

// Get bank balance using accountNumber and ifscCode
router.get("/balance/:accountNumber/:ifscCode", async (req, res) => {
    const { accountNumber, ifscCode } = req.params;

    try {
        const account = await Bank.findOne({ accountNumber, ifscCode });

        if (!account) {
            return res.status(404).json({ error: "Bank account not found" });
        }

        return res.json({
            accountNumber: account.accountNumber,
            bankBalance: account.bankBalance,
            accountHolderName: account.accountHolderName,
            bankName: account.bankName,
            ifscCode: account.ifscCode,
        });
    } catch (error) {
        console.error("Error fetching bank balance:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

//transaction history api 
router.get("/transactionsHistory/device/:deviceId", async (req, res) => {
    const { deviceId } = req.params;

    try {
        // Step 1: Find all accounts for the device
        const userAccounts = await Bank.find({ deviceId });

        if (!userAccounts || userAccounts.length === 0) {
            return res.status(404).json({ message: "No accounts found for this device" });
        }

        // Step 2: Get all account numbers
        const accountNumbers = userAccounts.map((account) => account.accountNumber);

        // Step 3: Find transactions where the user is sender or receiver
        const transactions = await TransactionHistory.find({
            $or: [
                { senderAccount: { $in: accountNumbers } },
                { receiverAccount: { $in: accountNumbers } },
            ],
        }).sort({ timestamp: -1 });

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transaction history by deviceId:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Add UPI Lite money

router.post("/add-upi-lite", async (req, res) => {
    const { senderAccount, senderName, senderIfscCode, senderBankName, amount, deviceId } = req.body;
  
    if (!senderAccount || !senderIfscCode || !amount || isNaN(amount) || !deviceId) {
      return res.status(400).json({ error: "Invalid data" });
    }
  
    const numericAmount = Number(amount);
  
    try {
      const currentAccount = await Bank.findOne({ accountNumber: senderAccount, ifscCode: senderIfscCode });
      if (!currentAccount) return res.status(404).json({ error: "Account not found" });
  
      // 🔍 Find any active UPI Lite account on this device
      const existingLiteAccount = await Bank.findOne({ deviceId, upiLiteActivated: true });
  
      let targetAccount;
  
      if (existingLiteAccount) {
        // ✅ UPI Lite already activated on this device — use that account
        targetAccount = existingLiteAccount;
      } else {
        // ❌ No UPI Lite yet — activate it on current account
        targetAccount = currentAccount;
        targetAccount.upiLiteActivated = true;
      }
  
      if (targetAccount.bankBalance < numericAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
  
      // Deduct and update
      targetAccount.bankBalance -= numericAmount;
      targetAccount.upiLiteBalance = (targetAccount.upiLiteBalance || 0) + numericAmount;
  
      await targetAccount.save();
  
      const transaction = new TransactionHistory({
        through: "UPILite",
        senderAccount: targetAccount.accountNumber,
        senderName: targetAccount.accountHolderName,
        senderIfscCode: targetAccount.ifscCode,
        senderBankName: targetAccount.bankName,
        amount: numericAmount,
        status: existingLiteAccount ? "UPI Lite balance updated" : "UPI Lite activated",
        transactionDate: new Date(),
      });
  
      await transaction.save();
  
      return res.json({
        status: transaction.status,
        upiLiteBalance: targetAccount.upiLiteBalance,
        transactionId: transaction._id,
        transactionDate: transaction.transactionDate,
      });
  
    } catch (error) {
      console.error("Error adding UPI Lite:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  
  
  

module.exports = router;
