import "server-only";

import { getAppUrl } from "@/lib/email";
import { getSiteSettings } from "@/lib/site-data";

export type EmailBranding = {
  siteName: string;
  logoUrl: string;
  loginUrl: string;
  resetPasswordUrl: string;
};

export async function getEmailBranding(): Promise<EmailBranding> {
  const s = await getSiteSettings();
  const siteName = s?.siteName?.trim() || "Romaria Fluvial Muiraquitã";
  const logoUrl = s?.logoUrl?.trim() || getAppUrl("/images/logo.png");
  return {
    siteName,
    logoUrl,
    loginUrl: getAppUrl("/login"),
    resetPasswordUrl: getAppUrl("/esqueci-senha"),
  };
}

export function wrapBrandedEmail(params: { logoUrl: string; siteName: string; bodyHtml: string }): string {
  const { logoUrl, siteName, bodyHtml } = params;
  const safeSiteName = escapeHtml(siteName);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #111827; margin: 0; padding: 0; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; margin: 0 auto; background: #fff;">
    <tr>
      <td style="padding: 22px 24px 14px; text-align: center; border-bottom: 1px solid #e5e7eb;">
        <img src="${escapeHtmlAttr(logoUrl)}" alt="${safeSiteName}" width="140" style="display:block; margin: 0 auto 10px;" />
        <div style="font-size: 16px; font-weight: 700; color: #111827;">${safeSiteName}</div>
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; margin: 0 auto; background: #fff;">
    <tr>
      <td style="padding: 22px 24px;">
        ${bodyHtml}
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; margin: 0 auto;">
    <tr>
      <td style="padding: 18px 24px; text-align: center; font-size: 12px; color: #6b7280;">
        Esta mensagem foi enviada por ${safeSiteName}.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlAttr(s: string): string {
  // suficiente para atributo src/href
  return escapeHtml(s).replace(/`/g, "&#096;");
}

