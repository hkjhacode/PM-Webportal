/**
 * User Credential Generator
 * Generates auto-generated credentials for new users
 */

export interface GeneratedCredentials {
  email: string;
  password: string;
  displayText: string;
}

export function generateUserCredentials(fullName: string): GeneratedCredentials {
  const raw = (fullName || '').trim();
  const ascii = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const clean = ascii.toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = clean.split(' ').filter(Boolean);
  const connectors = new Set(['de','del','della','la','van','von','bin','al','da','dos','di','le','du']);
  const first = tokens[0] || 'user';
  let last = '';
  if (tokens.length > 1) {
    for (let i = tokens.length - 1; i >= 1; i--) {
      if (!connectors.has(tokens[i])) { last = tokens[i]; break; }
    }
    if (!last) last = tokens[tokens.length - 1];
  }
  let local = last ? `${first}.${last}` : first;
  local = local.replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  local = local.replace(/[^a-z0-9.-]/g, '');
  if (!local || local.length < 1) local = `user${Date.now().toString().slice(-4)}`;
  if (local.length < 2) local = `${local}${Math.floor(Math.random()*90+10)}`;
  if (local.length > 32) local = local.slice(0, 32);
  const domain = process.env.EMAIL_DOMAIN || 'gov.in';
  const email = `${local}@${domain}`;
  const capitalizedFirstName = (tokens[0] || 'User').charAt(0).toUpperCase() + (tokens[0] || 'User').slice(1);
  const password = `${capitalizedFirstName}@1234`;
  return { email, password, displayText: `Email: ${email} | Password: ${password}` };
}

function slugify(value?: string) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function generateRoleScopedCredentials(fullName: string, role: { role: string; state?: string; branch?: string }): GeneratedCredentials {
  const base = generateUserCredentials(fullName);
  const email = base.email;
  return { email, password: base.password, displayText: `Email: ${email} | Password: ${base.password}` };
}

export function generateUniqueUserCredentials(fullName: string, existingEmails: string[]): GeneratedCredentials {
  let credentials = generateUserCredentials(fullName);
  let counter = 1;
  while (existingEmails.includes(credentials.email)) {
    const local = credentials.email.split('@')[0];
  const domain = process.env.EMAIL_DOMAIN || 'gov.in';
    const email = `${local}${counter}@${domain}`;
    credentials = { email, password: credentials.password, displayText: `Email: ${email} | Password: ${credentials.password}` };
    counter++;
  }
  return credentials;
}

export function maskCredentialsAfterTimeout(credentials: GeneratedCredentials, timeoutMs: number = 30000): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Clear sensitive data after timeout
      (credentials as any).email = null;
      (credentials as any).password = null;
      (credentials as any).displayText = 'Credentials have been hidden for security';
      resolve(null);
    }, timeoutMs);
  });
}

export function generateSecurePassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}