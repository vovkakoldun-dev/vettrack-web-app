/**
 * PortalGuard — validates the current URL portal against the user's role.
 *
 * On every navigation:
 * 1. Resolves the user's allowed portal from their role (profiles table / JWT).
 * 2. Resolves which portal the current URL belongs to.
 * 3. If mismatch → force redirect to the correct portal (or logout if no role).
 * 4. Updates the server-side session with the active portal_id.
 * 5. Logs security events for unauthorized portal access attempts.
 *
 * Wrap this around protected routes — it must be inside AuthProvider and TenantProvider.
 */
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import {
  validatePortalAccess,
  setSessionPortal,
  portalFromPath,
  type PortalId,
} from '../../lib/portal';
import { logSecurityEvent } from '../../lib/tenant';

interface PortalGuardProps {
  children: ReactNode;
  /** The portal this guard protects (derived from route structure). */
  portal: PortalId;
}

export function PortalGuard({ children, portal }: PortalGuardProps) {
  const { user } = useAuth();
  const { identity } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const lastPortalRef = useRef<PortalId | null>(null);

  // Compute access synchronously — don't rely only on async navigate
  const role = identity?.role || '';
  const { allowed, userPortal, urlPortal, redirectTo } = validatePortalAccess(role, location.pathname);

  useEffect(() => {
    if (!user || !identity) return;

    if (!allowed) {
      // Log the unauthorized access attempt
      logSecurityEvent(identity, 'PORTAL_MISMATCH',
        `User with role "${role}" (portal: ${userPortal}) attempted to access ${urlPortal} portal at ${location.pathname}`
      );

      // Force redirect to the user's correct portal
      navigate(redirectTo, { replace: true });
      return;
    }

    // Update server-side session with active portal (only when portal changes)
    if (lastPortalRef.current !== portal) {
      lastPortalRef.current = portal;
      setSessionPortal(user.id, portal);
    }
  }, [user, identity, location.pathname, portal, navigate, allowed, redirectTo, role, userPortal, urlPortal]);

  // Block rendering until identity is loaded
  if (!user || !identity) return null;

  // Block rendering if access is denied (redirect will happen via effect)
  if (!allowed) return null;

  return <>{children}</>;
}

/**
 * AutoPortalGuard — automatically determines portal from the current URL path.
 * Use this when you don't want to manually specify the portal per route.
 */
export function AutoPortalGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const portal = portalFromPath(location.pathname);
  return <PortalGuard portal={portal}>{children}</PortalGuard>;
}
