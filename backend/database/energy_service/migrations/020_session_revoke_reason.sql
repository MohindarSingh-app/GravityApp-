-- Restore a revocation reason so refresh-token reuse detection can tell a
-- superseded (rotated) token apart from a dead logout / password-change token.
-- Without this, presenting any revoked refresh token revoked EVERY session for
-- the user (including the device that just changed the password).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoke_reason VARCHAR(64);
