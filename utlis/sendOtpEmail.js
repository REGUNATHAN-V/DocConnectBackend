// const nodemailer = require("nodemailer");

// async function sendOtpEmail(email, otp, message) {

//   const transporter = nodemailer.createTransport({
//     service: "Gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS
//     },
//     tls: { rejectUnauthorized: false }
//   });

//   let subject = "";

//   if (message === "confirm removal of your LAST trusted device") {
//     subject = "Security Confirmation Required";
//   } else {
//     subject = "Email Verification OTP";
//   }

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: subject,
//     text: `Your request to ${message} requires OTP verification. OTP: ${otp}`
//   };

//   await transporter.sendMail(mailOptions);
//   console.log(`OTP sent to ${email}: ${otp}`);
// }

// module.exports = { sendOtpEmail };


const nodemailer = require("nodemailer");

async function sendOtpEmail(email, otp, message) {
  console.log("----- SEND OTP EMAIL START -----");

  console.log("Email:", email);
  console.log("OTP:", otp);
  console.log("Message:", message);

  console.log("ENV EMAIL_USER:", process.env.EMAIL_USER);
  console.log("ENV EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

  try {
    console.log("Creating transporter...");

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: { rejectUnauthorized: false }
    });

    console.log("Transporter created");

    let subject = "";

    if (message === "confirm removal of your LAST trusted device") {
      subject = "Security Confirmation Required";
    } else {
      subject = "Email Verification OTP";
    }

    console.log("Subject selected:", subject);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      text: `Your request to ${message} requires OTP verification. OTP: ${otp}`
    };

    console.log("Mail Options:", mailOptions);

    console.log("Sending email...");

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully");
    console.log("Response:", info);

    console.log(`OTP sent to ${email}: ${otp}`);
  } catch (error) {
    console.error("sendRegisterOtp ERROR:");
    console.error(error);
  }

  console.log("----- SEND OTP EMAIL END -----");
}

module.exports = { sendOtpEmail };