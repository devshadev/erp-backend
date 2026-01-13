import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: config.emailUser,
    pass: config.emailPass,
  },
});

export const sendEmail = async (to, subject, htmlFilePath, replacements) => {
  let htmlContent = fs.readFileSync(path.resolve(htmlFilePath), "utf-8");
  Object.keys(replacements).forEach((key) => {
    const placeholder = `{{${key}}}`;
    htmlContent = htmlContent.replace(
      new RegExp(placeholder, "g"),
      replacements[key]
    );
  });

  await transporter.sendMail({
    from: `"DotWork" <${config.emailUser}>`,
    to,
    subject,
    html: htmlContent,
  });
};
