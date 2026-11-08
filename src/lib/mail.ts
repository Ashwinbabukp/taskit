import nodemailer from "nodemailer";

interface SendVerificationEmailOptions {
  to: string;
  code: string;
}

interface SendMailResult {
  success: boolean;
  delivered: boolean;
  message: string;
  provider?: string;
  error?: string;
}

export async function sendVerificationEmail({
  to,
  code,
}: SendVerificationEmailOptions): Promise<SendMailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;
  const emailFrom = process.env.EMAIL_FROM || "taskit <onboarding@resend.dev>";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px; color: #111827; }
          .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .badge { width: 44px; height: 44px; background: #0ea5e9; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; }
          .badge svg { width: 24px; height: 24px; stroke: #ffffff; fill: none; stroke-width: 2.2; }
          h1 { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px; }
          p { font-size: 14px; line-height: 1.5; color: #4b5563; margin: 0 0 24px; }
          .code-box { background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px; }
          .code { font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; }
          .footer { font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">
            <svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M8 12l3 3 5-6"/></svg>
          </div>
          <h1>Your verification code</h1>
          <p>Use the 6-digit code below to log in to your <strong>taskit</strong> account. This code is valid for 10 minutes.</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p style="font-size: 12px; color: #6b7280; margin-bottom: 0;">If you didn't request this code, you can safely ignore this email.</p>
          <div class="footer">
            © ${new Date().getFullYear()} taskit. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. Try Resend if RESEND_API_KEY is configured
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          subject: `${code} is your taskit verification code`,
          html: emailHtml,
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[Mail] Resend API error:", resData);
        return {
          success: false,
          delivered: false,
          provider: "resend",
          message: resData.message || `Resend error: ${res.status}`,
          error: resData.message || `Resend error: ${res.status}`,
        };
      }

      console.log(`[Mail] Real email sent to ${to} via Resend. Email ID: ${resData.id}`);
      return {
        success: true,
        delivered: true,
        provider: "resend",
        message: `Verification code sent to ${to}`,
      };
    } catch (err: any) {
      console.error("[Mail] Resend error:", err.message);
      return {
        success: false,
        delivered: false,
        provider: "resend",
        message: err.message,
        error: err.message,
      };
    }
  }

  // 2. Try SMTP (Nodemailer) if SMTP_HOST or SMTP_USER & SMTP_PASS are provided
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || "smtp.gmail.com",
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: emailFrom,
        to,
        subject: `${code} is your taskit verification code`,
        text: `Your taskit verification code is: ${code}. It expires in 10 minutes.`,
        html: emailHtml,
      });

      console.log(`[Mail] Real email delivered to ${to} via SMTP (${smtpHost || "smtp.gmail.com"})`);
      return {
        success: true,
        delivered: true,
        provider: "smtp",
        message: `Verification code sent to ${to}`,
      };
    } catch (err: any) {
      console.error("[Mail] SMTP error:", err.message);
      return {
        success: false,
        delivered: false,
        provider: "smtp",
        message: err.message,
        error: err.message,
      };
    }
  }

  // 3. Fallback when credentials are not configured yet
  console.log(`[Mail] Verification code for ${to}: ${code}`);

  return {
    success: true,
    delivered: false,
    provider: "local-simulation",
    message: `Verification code generated for ${to}`,
  };
}
