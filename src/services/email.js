import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;
let warned = false;

function getTransporter() {
  if (!env.emailUser || !env.emailPass) {
    if (!warned) {
      warned = true;
      console.warn("[email] EMAIL_USER/EMAIL_PASS not set, notifications are disabled");
    }
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

/**
 * Sends the "rental completed" emails to the customer and the owner.
 * Notification failures are logged and never propagate to the caller,
 * so a broken mail server can never fail the main request.
 */
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

  await Promise.allSettled(
    messages
      .filter((message) => Boolean(message.to))
      .map((message) => mailer.sendMail({ from: env.emailUser, ...message })),
  );
}
