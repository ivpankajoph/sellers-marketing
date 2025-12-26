import { Router, Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { findUserById } from './auth.service';

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
    const { username, password, name, email } = req.body;
    
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await authService.createUser(username, password, name, email);
    
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
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = await findUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      pageAccess: user.pageAccess,
    }
  });
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
        pageAccess: updatedUser.pageAccess,
      }
    });
  } catch (error) {
    console.error('[Auth] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
