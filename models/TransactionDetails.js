const mongoose = require("mongoose");

const BankToBankTransactionSchema = new mongoose.Schema({
    through:String,
    senderAccount: String,
    senderName: String,
    senderIfscCode: String,
    senderBankName: String,
    receiverName: String,
    receiverAccount: String,
    receiverIfscCode: String,
    receiverBankName:String,
    amount: Number,
    status: String, // pending, success, failed
    timestamp: { type: Date, default: Date.now },
});

const BankToBankTransaction = mongoose.model("TransactionDetails", BankToBankTransactionSchema);

module.exports = BankToBankTransaction;  
