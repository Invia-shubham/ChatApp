// utils/sendOtp.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "shubham.mavesys@gmail.com",
    pass: "ybbi hpuu hctl vtvw", // App password for Gmail (not regular password)
  },
});

// module.exports = async function sendOtp(email, otp) {
//   await transporter.sendMail({
//     from: '"Chat App" <your-email@gmail.com>',
//     to: email,
//     subject: "Your OTP Code",
//     text: `Your OTP is ${otp}. It expires in 5 minutes.`,
//   });
// };

module.exports = async function sendOtp(email, otp) {
  const htmlTemplate = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
      
      <!-- Header -->
      <div style="background-color: #4a90e2; padding: 20px; text-align: center;">
        <img src="https://res.cloudinary.com/dw5rla8ha/image/upload/v1748502530/hkuunaoi1dpujbeyjick.png" alt="Chat App" style="max-height: 50px;">
      </div>
      
      <!-- Body -->
      <div style="padding: 30px;">
        <h2 style="color: #333;">🔐 One-Time Password (OTP)</h2>
        <p style="font-size: 16px; color: #555;">
          Hello, <br /><br />
          Use the OTP below to verify your email. This OTP is valid for <strong>5 minutes</strong>.
        </p>

        <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 30px 0; color: #4a90e2;">
          ${otp}
        </div>

        <!-- <a href="#" style="display: inline-block; text-align: center; background-color: #4a90e2; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold;">
          Verify Now
        </a> -->

        <p style="font-size: 14px; color: #888; margin-top: 30px;">
          If you did not request this OTP, please ignore this email or contact support.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 13px; color: #999;">
        © ${new Date().getFullYear()} Chat App. All rights reserved.
      </div>
    </div>
  </div>
`;

  await transporter.sendMail({
    from: '"Chat App" <your-email@gmail.com>',
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    html: htmlTemplate,
  });
};
