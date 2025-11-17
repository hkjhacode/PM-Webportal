/**
 * Notifications Service - Simplified (Email/SMS removed)
 * Traceability: FR-12 (deadlines), FR-13 (alerts), FR-14 (escalations)
 * 
 * NOTE: External notification services removed for simplicity.
 * Notifications now use in-app toast system only.
 */

export async function sendEmail(to: string, subject: string, text: string) {
  console.log(`[Email Mock] To: ${to}, Subject: ${subject}, Body: ${text}`);
  return { skipped: true, message: 'Email service not configured - using in-app notifications only' };
}