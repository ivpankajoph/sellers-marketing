import { Router, Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { findUserById } from './auth.service';
import { OTP } from '../storage/mongodb.adapter';
import axios from 'axios';
import passport from '../auth/passport';
import jwt from 'jsonwebtoken';

const router = Router();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
}

export function getUserId(req: Request): string | null {
  return (req.headers['x-user-id'] as string) || null;
}

export function getUser(req: Request): authService.AuthUser | null {
  const userHeader = req.headers['x-user'] as string;
  if (!userHeader) return null;
  try {
    return JSON.parse(userHeader);
  } catch {
    return null;
  }
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await authService.validateLogin(username, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        pageAccess: user.pageAccess,
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, name, email,phone } = req.body;

    if ( !password || !name) {
      return res.status(400).json({ error: 'Username, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await authService.createUser(username, password, name, email,phone);

    if (!user) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    console.log(userId, "asdddadasdassdasddsaa")
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await findUserById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Convert mongoose doc → plain object
    const userObj = user.toObject ? user.toObject() : user;

    // Remove sensitive fields
    delete userObj.password;
    delete userObj.__v;

    res.json({ user: userObj });
  } catch (error) {
    console.error('[Auth] /me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});


router.get('/check', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.json({ authenticated: false, user: null });
  }

  const user = await findUserById(userId);
  res.json({
    authenticated: !!user,
    user: user ? {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      pageAccess: user.pageAccess,
    } : null
  });
});

router.put('/update-profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { name, email, phone } = req.body;

    const updatedUser = await authService.updateUserProfile(userId, { name, email, phone });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        pageAccess: updatedUser.pageAccess,
      }
    });
  } catch (error) {
    console.error('[Auth] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save OTP to database
    await OTP.findOneAndDelete({ phone });
    await OTP.create({
      phone,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    
    // Send via WhatsApp Business API
  await axios.post(
  `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`,
  {
    messaging_product: "whatsapp",
    to: phone, // 919911064724
    type: "template",
    template: {
      name: "life_changing_networks_auth",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otp
            }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: otp
            }
          ]
        }
      ]
    }
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.SYSTEM_USER_TOKEN_META}`,
      "Content-Type": "application/json"
    }
  }
);

    
    res.json({ message: 'OTP sent successfully' });
  } catch (error:any) {
    console.error('OTP Send Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    const otpRecord = await OTP.findOne({ phone, otp });
    
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }
    
    otpRecord.verified = true;
    await otpRecord.save();
    
    res.json({ message: 'OTP verified successfully' });
  } catch (error:any) {
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login' }),
  (req, res) => {
    if (!req.user) {
      return res.redirect('http://localhost:5173/login');
    }
    const token = jwt.sign({ id: (req.user as any)._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
    res.redirect(`http://localhost:5173/auth/success?token=${token}`);
  }
);


export default router;
