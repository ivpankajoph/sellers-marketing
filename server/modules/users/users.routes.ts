import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { 
  SystemUser, 
  AVAILABLE_PAGES, 
  ROLE_LABELS,
  generateUsername, 
  generatePassword 
} from './user.model';
import { hashPassword } from '../auth/auth.service';
import { requireAuth, getUser } from '../auth/auth.routes';
import { sendCredentialsEmail, sendPasswordResetEmail } from '../email/email.service';

function generateId(): string {
  return crypto.randomUUID();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const isMainUser = !user.pageAccess || user.pageAccess.length === 0;
  const isAdmin = user.role === 'super_admin' || user.role === 'sub_admin';
  if (!isMainUser && !isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

const router = Router();

router.get('/pages', async (_req: Request, res: Response) => {
  try {
    res.json(AVAILABLE_PAGES);
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

router.get('/roles', async (_req: Request, res: Response) => {
  try {
    const roles = Object.entries(ROLE_LABELS).map(([id, name]) => ({ id, name }));
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.get('/', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await SystemUser.find({ role: { $ne: 'super_admin' } })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await SystemUser.findOne({ id: req.params.id }).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, name, role, pageAccess, createdBy } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    const existingUser = await SystemUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const username = generateUsername(name);
    const plainPassword = generatePassword();
    const hashedPassword = hashPassword(plainPassword);

    const user = new SystemUser({
      id: generateId(),
      email,
      name,
      username,
      password: hashedPassword,
      role: role || 'user',
      pageAccess: pageAccess || ['dashboard'],
      isActive: true,
      createdBy: createdBy || 'system'
    });

    await user.save();

    const emailSent = await sendCredentialsEmail(email, name, username, plainPassword);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        pageAccess: user.pageAccess,
        isActive: user.isActive
      },
      credentials: {
        username,
        password: plainPassword
      },
      emailSent
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, email, role, pageAccess, isActive } = req.body;

    const user = await SystemUser.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (email && email !== user.email) {
      const existingUser = await SystemUser.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (pageAccess) user.pageAccess = pageAccess;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      pageAccess: user.pageAccess,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/:id/reset-password', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await SystemUser.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plainPassword = generatePassword();
    user.password = hashPassword(plainPassword);
    await user.save();

    const emailSent = await sendPasswordResetEmail(user.email, user.name, user.username, plainPassword);

    res.json({
      username: user.username,
      password: plainPassword,
      emailSent
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await SystemUser.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    await SystemUser.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.get('/me/permissions', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.json({ 
        role: 'super_admin', 
        pageAccess: AVAILABLE_PAGES.map(p => p.id) 
      });
    }

    const user = await SystemUser.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      role: user.role,
      pageAccess: user.pageAccess
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

export default router;
