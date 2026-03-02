import crypto from 'crypto';
import { User, UserCredentials } from '../storage/mongodb.adapter';
import { SystemUser } from '../users/user.model';
import { sendPasswordResetLinkEmail } from '../email/email.service';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: string;
  pageAccess?: string[];
}

const PASSWORD_RESET_TTL_MINUTES = 15;

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export async function findUserByUsername(username: string): Promise<any | null> {
  try {
    const user = await User.findOne({ username });
    return user;
  } catch (error) {
    console.error('[Auth] Error finding user:', error);
    return null;
  }
}

export async function findUserById(id: string): Promise<any | null> {
  try {
    const user = await User.findOne({ id });
    if (user) return user;
    
    const systemUser = await SystemUser.findOne({ id, isActive: true });
    if (systemUser) {
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[Auth] Error finding user by id:', error);
    return null;
  }
}

export async function createUser(username: string, password: string, name: string, email?: string): Promise<AuthUser | null> {
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return null;
    }

    const id = crypto.randomUUID();
    const hashedPassword = hashPassword(password);
    
    const user = await User.create({
      id,
      username,
      password: hashedPassword,
      name,
      email: email || '',
      role: 'user',
      createdAt: new Date().toISOString(),
    });

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('[Auth] Error creating user:', error);
    return null;
  }
}

export async function updateUserProfile(
  userId: string, 
  updates: { name?: string; email?: string; phone?: string }
): Promise<AuthUser | null> {
  try {
    const user = await User.findOne({ id: userId });
    if (user) {
      if (updates.name) user.name = updates.name;
      if (updates.email) user.email = updates.email;
      await user.save();
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }

    const systemUser = await SystemUser.findOne({ id: userId });
    if (systemUser) {
      if (updates.name) systemUser.name = updates.name;
      if (updates.email) systemUser.email = updates.email;
      await systemUser.save();
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess,
      };
    }

    return null;
  } catch (error) {
    console.error('[Auth] Error updating profile:', error);
    return null;
  }
}

export async function validateLogin(username: string, password: string): Promise<AuthUser | null> {
  try {
    const user = await findUserByUsername(username);
    if (user) {
      if (!verifyPassword(password, user.password)) {
        return null;
      }
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }

    const systemUser = await SystemUser.findOne({ 
      $or: [{ username }, { email: username }],
      isActive: true 
    });
    if (systemUser) {
      if (!verifyPassword(password, systemUser.password)) {
        return null;
      }
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess,
      };
    }

    return null;
  } catch (error) {
    console.error('[Auth] Error validating login:', error);
    return null;
  }
}

export async function requestPasswordReset(
  identifier: string,
  appUrl: string
): Promise<{ delivered: boolean; debugResetUrl?: string }> {
  try {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      return { delivered: false };
    }

    const user = await User.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }],
    });

    if (!user) {
      return { delivered: false };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashResetToken(resetToken);
    const resetTokenExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000
    );

    user.resetPasswordTokenHash = resetTokenHash;
    user.resetPasswordExpiresAt = resetTokenExpiresAt;
    await user.save();

    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    let delivered = false;

    if (user.email) {
      delivered = await sendPasswordResetLinkEmail(
        user.email,
        user.name || user.username,
        resetUrl,
        PASSWORD_RESET_TTL_MINUTES
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      return { delivered, debugResetUrl: resetUrl };
    }

    return { delivered };
  } catch (error) {
    console.error('[Auth] Error requesting password reset:', error);
    return { delivered: false };
  }
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) {
      return { success: false, error: 'Invalid reset token' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    const tokenHash = hashResetToken(cleanToken);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return { success: false, error: 'Reset token is invalid or has expired' };
    }

    user.password = hashPassword(newPassword);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    return { success: true };
  } catch (error) {
    console.error('[Auth] Error resetting password:', error);
    return { success: false, error: 'Failed to reset password' };
  }
}

export async function ensureDefaultAdmin(): Promise<void> {
  if (!process.env.MONGODB_URL) {
    console.warn('[Auth] Skipping default admin setup: MONGODB_URL is not configured');
    return;
  }

  try {
    const adminExists = await User.findOne({ username: 'admin@whatsapp.com' });
    if (!adminExists) {
      console.log('[Auth] Creating default admin user...');
      await createUser('admin@whatsapp.com', 'admin123', 'Admin', 'admin@whatsapp.com');
      console.log('[Auth] Default admin user created (admin@whatsapp.com / admin123)');
    }
    
    const admin = await User.findOne({ username: 'admin@whatsapp.com' });
    if (admin) {
      if (admin.role !== 'super_admin') {
        admin.role = 'super_admin';
        await admin.save();
        console.log('[Auth] Admin role updated to super_admin');
      }
      await seedAdminCredentials(admin.id);
    }
  } catch (error) {
    console.error('[Auth] Error ensuring default admin:', error);
  }
}

async function seedAdminCredentials(adminUserId: string): Promise<void> {
  try {
    const existingCreds = await UserCredentials.findOne({ userId: adminUserId });
    if (existingCreds) {
      console.log('[Auth] Admin credentials already exist in database');
      return;
    }

    const whatsappToken = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN || '';
    const phoneNumberId = process.env.PHONE_NUMBER_ID || '';
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    const webhookVerifyToken = process.env.WEBHOOK_VERIFY_TOKEN || '';
    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const facebookAccessToken = process.env.FB_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || '';
    const facebookPageId = process.env.FACEBOOK_PAGE_ID || '';
    const appId = process.env.FACEBOOK_APP_ID || '';
    const appSecret = process.env.FACEBOOK_APP_SECRET || '';

    const hasAnyCreds = whatsappToken || openaiApiKey || facebookAccessToken;
    if (!hasAnyCreds) {
      console.log('[Auth] No environment credentials to seed');
      return;
    }

    const now = new Date().toISOString();
    await UserCredentials.create({
      id: crypto.randomUUID(),
      userId: adminUserId,
      whatsappToken: whatsappToken || '',
      phoneNumberId: phoneNumberId || '',
      businessAccountId: businessAccountId || '',
      webhookVerifyToken: webhookVerifyToken || '',
      openaiApiKey: openaiApiKey || '',
      facebookAccessToken: facebookAccessToken || '',
      facebookPageId: facebookPageId || '',
      appId: appId || '',
      appSecret: appSecret || '',
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log('[Auth] Seeded admin credentials from environment variables');
  } catch (error) {
    console.error('[Auth] Error seeding admin credentials:', error);
  }
}
