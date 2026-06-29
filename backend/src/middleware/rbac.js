// backend/src/middleware/rbac.js
// Role-Based Access Control middleware.
// Role hierarchy (numeric): OWNER(3) > SENIOR_ADMIN(2) > MODERATOR(1) > USER(0)
// Use after requireAuth.

/** Maps role enum string to numeric level */
const ROLE_LEVELS = {
  USER:         0,
  MODERATOR:    1,
  SENIOR_ADMIN: 2,
  OWNER:        3,
};

/**
 * Factory: require the requesting user to have at least the given role level.
 * @param {keyof ROLE_LEVELS} minRole - Minimum required role
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/ban', requireAuth, requireRole('SENIOR_ADMIN'), banHandler);
 */
function requireRole(minRole) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const userLevel = ROLE_LEVELS[user.role] ?? 0;
    const requiredLevel = ROLE_LEVELS[minRole] ?? 99;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error:    'Insufficient permissions',
        required: minRole,
        current:  user.role,
      });
    }

    next();
  };
}

/** Shorthand middlewares */
const requireModerator   = requireRole('MODERATOR');
const requireSeniorAdmin = requireRole('SENIOR_ADMIN');
const requireOwner       = requireRole('OWNER');

/**
 * Check if a user has at least the given role (non-middleware version).
 * @param {object} user   - Prisma User object
 * @param {string} minRole
 * @returns {boolean}
 */
function hasRole(user, minRole) {
  return (ROLE_LEVELS[user?.role] ?? 0) >= (ROLE_LEVELS[minRole] ?? 99);
}

module.exports = {
  ROLE_LEVELS,
  requireRole,
  requireModerator,
  requireSeniorAdmin,
  requireOwner,
  hasRole,
};
