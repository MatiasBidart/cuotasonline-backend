import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import { HttpError } from "../errors/http-error";

type SmtpFailure = Error & {
  code?: string;
  command?: string;
  responseCode?: number;
};

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD;
  const mailFrom = process.env.SMTP_FROM?.trim();
  const missing = Object.entries({
    SMTP_HOST: smtpHost,
    SMTP_USER: smtpUser,
    SMTP_PASSWORD: smtpPassword,
    SMTP_FROM: mailFrom,
  })
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  if (!smtpHost || !smtpUser || !smtpPassword || !mailFrom) {
    console.error("[email] Configuración SMTP incompleta", { missing });
    throw new HttpError(`Falta configurar ${missing.join(", ")} para enviar correos.`, 503);
  }

  const smtpPortValue = process.env.SMTP_PORT?.trim();
  const smtpPort = smtpPortValue ? Number(smtpPortValue) : 587;
  if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
    console.error("[email] Configuración SMTP inválida", { field: "SMTP_PORT" });
    throw new HttpError("SMTP_PORT debe ser un puerto válido.", 503);
  }

  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (secureValue && secureValue !== "true" && secureValue !== "false") {
    console.error("[email] Configuración SMTP inválida", { field: "SMTP_SECURE" });
    throw new HttpError("SMTP_SECURE debe ser true o false.", 503);
  }

  return {
    mailFrom,
    transporter: nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: secureValue === "true",
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    }),
  };
}

function getSmtpFailure(error: unknown) {
  const failure = error instanceof Error ? error as SmtpFailure : null;
  const code = failure?.code;
  const responseCode = failure?.responseCode;

  if (code === "EAUTH" || responseCode === 535) {
    return {
      category: "authentication",
      message: "El servidor SMTP rechazó las credenciales. Revisá SMTP_USER, SMTP_PASSWORD y SMTP_SECURE.",
    };
  }
  if (
    code === "ECONNECTION"
    || code === "ECONNREFUSED"
    || code === "ECONNRESET"
    || code === "ETIMEDOUT"
    || code === "ESOCKET"
    || code === "ENOTFOUND"
    || failure?.message.toLowerCase().includes("connection closed unexpectedly")
  ) {
    return {
      category: "connection",
      message: "El servidor SMTP cerró la conexión. Revisá SMTP_HOST, SMTP_PORT, SMTP_SECURE y la disponibilidad del proveedor.",
    };
  }
  if (code === "EENVELOPE" || responseCode === 550 || responseCode === 553) {
    return {
      category: "sender_or_recipient",
      message: "El servidor SMTP rechazó el remitente o destinatario. Revisá SMTP_FROM y que el remitente esté autorizado.",
    };
  }
  return {
    category: "delivery",
    message: "El servidor SMTP no pudo enviar el correo. Revisá la configuración y disponibilidad del proveedor.",
  };
}

async function sendWithSmtp(options: SendMailOptions, purpose: "invitation" | "email_confirmation") {
  const { mailFrom, transporter } = createTransporter();
  try {
    await transporter.sendMail({ ...options, from: mailFrom });
    console.info("[email] SMTP accepted message", { purpose });
  } catch (error) {
    const failure = getSmtpFailure(error);
    const details = error instanceof Error ? error as SmtpFailure : null;
    console.error("[email] Envío SMTP fallido", {
      purpose,
      category: failure.category,
      code: details?.code,
      command: details?.command,
      responseCode: details?.responseCode,
    });
    throw new HttpError(failure.message, 502);
  } finally {
    transporter.close();
  }
}

export async function sendAccountInvitationEmail(input: {
  email: string;
  role: "admin" | "seller" | "client";
  link: string;
}) {
  const roleLabel = {
    admin: "administrador",
    seller: "vendedor",
    client: "cliente",
  }[input.role];

  await sendWithSmtp({
    to: input.email,
    subject: "Completá tu registro en CuotasOnline",
    text: [
      `Te invitaron a crear una cuenta de ${roleLabel} en CuotasOnline.`,
      "Completá tus datos desde este enlace:",
      input.link,
      "El enlace vence en 20 minutos y solo se puede usar una vez.",
    ].join("\n\n"),
    html: `<p>Te invitaron a crear una cuenta de ${roleLabel} en CuotasOnline.</p><p><a href="${input.link}">Completar mis datos</a></p><p>El enlace vence en 20 minutos y solo se puede usar una vez.</p>`,
  }, "invitation");
}

export async function sendEmailConfirmation(input: {
  email: string;
  link: string;
}) {
  await sendWithSmtp({
    to: input.email,
    subject: "Verificá tu correo de CuotasOnline",
    text: `Confirmá este correo para activar tu cuenta de CuotasOnline:\n\n${input.link}`,
    html: `<p>Confirmá este correo para activar tu cuenta de CuotasOnline:</p><p><a href="${input.link}">Verificar correo</a></p>`,
  }, "email_confirmation");
}
