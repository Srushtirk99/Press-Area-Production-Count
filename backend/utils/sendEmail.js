const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"PressBoard" <${process.env.EMAIL}>`, //  Branding here
      to,
      subject,
      html
    });

    console.log("Email sent successfully");
  } catch (error) {
    console.error("Email error:", error);
  }
};

module.exports = sendEmail;