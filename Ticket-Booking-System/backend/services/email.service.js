'use strict';

const nodemailer = require('nodemailer');

// ─── Transporter (lazy-init, SMTP App Password only) ─────────────────────────
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS must be set in environment variables.');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Reset cached transporter on connection errors so next call retries fresh
  transporter.on('error', (err) => {
    console.error('❌ SMTP transporter error — resetting:', err.message);
    transporter = null;
  });

  // Verify connection on first init (non-blocking, logs only)
  transporter.verify((err) => {
    if (err) {
      console.error('❌ SMTP connection verify failed:', err.message);
      transporter = null;
    } else {
      console.log('✅ Email Service: SMTP connection verified (App Password)');
    }
  });

  return transporter;
};

// ─── Shared sender address ────────────────────────────────────────────────────
const FROM_VDESK   = () => `"VDart VDesk" <${process.env.SMTP_USER}>`;
const FROM_SUPPORT = () => `"IT Support"  <${process.env.SMTP_USER}>`;

// ─── 1. OTP Email ─────────────────────────────────────────────────────────────
const sendOtpEmail = async ({ to, otp }) => {
  const transport = getTransporter();
  await transport.sendMail({
    from: FROM_VDESK(),
    to,
    subject: `🔐 ${otp} is your VDesk Verification Code`,
    html: `
      <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:500px;margin:0 auto;background:#f4f7f9;padding:40px 20px;">
        <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.05);border:1px solid #e1e8ed;">
          <div style="background:#1E40AF;padding:30px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:1px;">VDesk</h1>
            <p style="color:#bfdbfe;margin:10px 0 0;font-size:14px;">Technical Support Portal</p>
          </div>
          <div style="padding:40px 30px;">
            <h2 style="color:#111827;margin:0 0 16px;font-size:20px;font-weight:700;text-align:center;">Verification Code</h2>
            <p style="color:#4b5563;margin:0 0 32px;font-size:16px;line-height:1.6;text-align:center;">
              Enter the 6-digit code below to securely sign in. This code is valid for <strong>5 minutes</strong>.
            </p>
            <div style="text-align:center;margin-bottom:32px;">
              <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:24px;display:inline-block;">
                <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#1E40AF;font-family:'Courier New',monospace;">${otp}</span>
              </div>
            </div>
            <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;margin-bottom:32px;">
              <p style="color:#92400e;margin:0;font-size:13px;line-height:1.5;">
                <strong>Security Tip:</strong> Never share this code with anyone. VDesk Support will never ask for your verification code.
              </p>
            </div>
            <p style="color:#9ca3af;margin:0;font-size:12px;text-align:center;">
              If you didn't request this code, please ignore this email or contact support if concerned.
            </p>
          </div>
          <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="color:#6b7280;margin:0;font-size:12px;">© ${new Date().getFullYear()} VDart Inc. Technical Support Division</p>
          </div>
        </div>
      </div>
    `,
  });
  console.log(`📧 OTP email sent to ${to}`);
};

// ─── 2. Ticket Confirmation ───────────────────────────────────────────────────
const sendTicketConfirmation = async ({ to, name, ticket }) => {
  try {
    const transport = getTransporter();
    const mailOptions = {
      from: FROM_SUPPORT(),
      to,
      subject: `[${ticket.ticketId}] Ticket Received: ${ticket.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">🎫 Ticket Received</h2>
          </div>
          <div style="background:#f8f9fa;padding:30px;border-radius:0 0 8px 8px;border:1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your ticket has been successfully created and is being reviewed by our support team.</p>
            <div style="background:white;border:1px solid #dee2e6;border-radius:6px;padding:20px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin:0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
              <p style="margin:0 0 8px;"><strong>Priority:</strong> ${ticket.priority.toUpperCase()}</p>
              <p style="margin:0 0 8px;"><strong>Category:</strong> ${ticket.category}</p>
              <p style="margin:0;"><strong>SLA Deadline:</strong> ${ticket.sla?.deadline ? new Date(ticket.sla.deadline).toLocaleString() : 'N/A'}</p>
            </div>
            <p>You will receive updates as your ticket progresses. Track your ticket by logging into the support portal.</p>
            <p style="color:#6c757d;font-size:13px;margin-top:30px;">This is an automated message. Please do not reply.</p>
          </div>
        </div>
      `,
    };

    if (ticket.emailSource?.messageId) {
      mailOptions.inReplyTo  = ticket.emailSource.messageId;
      mailOptions.references = [ticket.emailSource.messageId];
    }

    await transport.sendMail(mailOptions);
    console.log(`📧 Ticket confirmation sent to ${to}`);
  } catch (err) {
    console.error('❌ Ticket confirmation email error:', err.message);
  }
};

// ─── 3. Acknowledgement Email ─────────────────────────────────────────────────
const sendAckEmail = async ({ to, name, ticket }) => {
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: FROM_SUPPORT(),
      to,
      subject: `[${ticket.ticketId}] We've received your request`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">✅ Request Acknowledged</h2>
          </div>
          <div style="background:#f8f9fa;padding:30px;border-radius:0 0 8px 8px;border:1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We have received your support request and our team is now working on it.</p>
            <div style="background:white;border:1px solid #dee2e6;border-radius:6px;padding:20px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin:0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
              <p style="margin:0;"><strong>Priority:</strong> ${ticket.priority.toUpperCase()}</p>
            </div>
            <p style="color:#6c757d;font-size:13px;margin-top:30px;">This is an automated message. Please do not reply.</p>
          </div>
        </div>
      `,
    });
    console.log(`📧 Ack email sent to ${to}`);
  } catch (err) {
    console.error('❌ Ack email error:', err.message);
  }
};

// ─── 4. Resolve Email ─────────────────────────────────────────────────────────
const sendResolveEmail = async ({ to, name, ticket }) => {
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: FROM_SUPPORT(),
      to,
      subject: `[${ticket.ticketId}] Your request has been resolved`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#198754;color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">✅ Issue Officially Resolved</h2>
          </div>
          <div style="background:#f8f9fa;padding:30px;border-radius:0 0 8px 8px;border:1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your support ticket has been officially closed following your confirmation.</p>
            <div style="background:white;border:1px solid #dee2e6;border-radius:6px;padding:20px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin:0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
              <p style="margin:0;"><strong>Final Status:</strong> COMPLETED / CLOSED</p>
            </div>
            <p>Thank you for your feedback and for helping us maintain high support standards.</p>
            <p style="color:#6c757d;font-size:13px;margin-top:30px;">This is an automated message. Please do not reply.</p>
          </div>
        </div>
      `,
    });
    console.log(`📧 Resolve email sent to ${to}`);
  } catch (err) {
    console.error('❌ Resolve email error:', err.message);
  }
};

// ─── 5. Status Change Email (single unified function) ─────────────────────────
const sendStatusChangeEmail = async ({ to, name, ticket, newStatus }) => {
  try {
    const transport = getTransporter();

    const statusMap = {
      assigned:        { label: '👤 Ticket Assigned',              color: '#6366F1', message: 'Your ticket has been assigned to a support agent who will begin working on it shortly.' },
      in_progress:     { label: '🔧 We are working on it',         color: '#2563EB', message: 'Good news! Our team has started working on your problem. We will keep you updated.' },
      almost_complete: { label: '🏁 Almost done!',                 color: '#7C3AED', message: 'We are almost finished fixing your issue. It should be resolved very soon.' },
      resolved:        { label: '🔍 Fix Verification Requested',   color: '#059669', message: 'The agent has finished their work and marked the issue as fixed. Please log in to verify the solution so we can officially close this ticket.' },
      pending_info:    { label: '❓ We need more info',            color: '#D97706', message: 'We need a bit more information from you to continue. Please check your ticket and reply.' },
      reopened:        { label: '🔄 Ticket Reopened',              color: '#EF4444', message: 'Your ticket has been reopened and is back in our queue.' },
      closed:          { label: '🔒 Ticket Closed',                color: '#64748B', message: 'Your ticket has been closed. If the problem comes back, you can always open a new one.' },
    };

    const s = statusMap[newStatus] || {
      label: 'Update on your ticket',
      color: '#1a1a2e',
      message: `Your ticket status has been updated to ${newStatus.replace(/_/g, ' ')}.`,
    };

    const mailOptions = {
      from: FROM_SUPPORT(),
      to,
      subject: `[${ticket.ticketId}] ${s.label}: ${ticket.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:${s.color};color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">${s.label}</h2>
          </div>
          <div style="background:#f8f9fa;padding:30px;border-radius:0 0 8px 8px;border:1px solid #e9ecef;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>${s.message}</p>
            <div style="background:white;border:1px solid #dee2e6;border-radius:6px;padding:20px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin:0 0 8px;"><strong>Problem:</strong> ${ticket.title}</p>
              <p style="margin:0;"><strong>Current Status:</strong> ${newStatus.replace(/_/g, ' ').toUpperCase()}</p>
            </div>
            <p>You can check your ticket anytime by logging into the support portal.</p>
            <p style="color:#6c757d;font-size:13px;margin-top:30px;">This is an automatic update. Please do not reply.</p>
          </div>
        </div>
      `,
    };

    if (ticket.emailSource?.messageId) {
      mailOptions.inReplyTo  = ticket.emailSource.messageId;
      mailOptions.references = [ticket.emailSource.messageId];
    }

    await transport.sendMail(mailOptions);
    console.log(`📧 Status change email (${newStatus}) sent to ${to}`);
  } catch (err) {
    console.error('❌ Status change email error:', err.message);
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────
// NOTE: sendVerificationEmail, sendPasswordSetEmail, sendStatusUpdate removed —
// they are dead code per v1.2 (no-registration flow, no-email onboarding).
module.exports = {
  sendOtpEmail,
  sendTicketConfirmation,
  sendAckEmail,
  sendResolveEmail,
  sendStatusChangeEmail,
};