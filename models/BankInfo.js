const mongoose = require("mongoose");

const BankSchema = new mongoose.Schema({
    accountHolderName: { type: String, required: true },
    accountNumber: { type: String, required: true ,unique: true },
    ifscCode: { type: String, required: true },
    branchName: { type: String, required: true },
    bankName: { type: String, required: true},
    branchCode: { type: String, required: true },
    deviceId: { type: String, required: true },
    qrCodeUrl: String,      
    uniqueId: String,
    upiId:String,
    upiLiteBalance: { type: Number, default: 0 }, 
    upiLiteActivated: { type: Boolean, default: false },
    bankBalance: { type: Number },
    // bankBalance: { type: Number, default: 0 },
    UPIPIN: { type: String, required: true }, 
    qrCreatedAt: { type: Date, default: Date.now }     
});

const Bank = mongoose.model("BankInfo", BankSchema);

module.exports = Bank;
