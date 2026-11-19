import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

function getTransporter() {
  if (!env.emailUser || !env.emailPass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.emailUser, pass: env.emailPass },
    });
  }

  return transporter;
}

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function sendRentalCompletedEmails(booking) {
  const mailer = getTransporter();
  if (!mailer) return;

  const summary = [
    `Equipment: ${booking.equipmentName}`,
    `Dates: ${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}`,
    `Quantity: ${booking.quantity}`,
    `Total: $${booking.totalAmount}`,
  ].join("\n");

  const messages = [
    {
      to: booking.customer?.email,
      subject: `Rental completed: ${booking.equipmentName}`,
      text: `Hi ${booking.customer?.name || "there"},\n\nYour rental has been completed.\n\n${summary}\n\nThank you for renting with us.`,
    },
    {
      to: booking.ownerEmail,
      subject: `Your equipment was returned: ${booking.equipmentName}`,
      text: `Hello,\n\nThe rental of your equipment is now completed.\n\n${summary}\n\nCustomer: ${booking.customer?.name || ""} (${booking.customer?.email || ""})`,
    },
  ];

  const results = await Promise.allSettled(
    messages
      .filter((message) => Boolean(message.to))
      .map((message) => mailer.sendMail({ from: env.emailUser, ...message })),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[email] Failed to send notification: ${reason}`);
    }
  });
}
