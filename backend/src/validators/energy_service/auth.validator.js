const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');
const { normalizePhone } = require('../../utils/energy_service/phone');

const emailSchema = z.string().trim().max(255).email('Enter a valid email address.')
  .transform((value) => value.toLowerCase());

const passwordSchema = z.string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[0-9]/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.');

const fullNameSchema = z.string()
  .trim()
  .min(2, 'Name must be at least 2 characters.')
  .max(120, 'Name must be at most 120 characters.')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, 'Name contains unsupported characters.');

const opaqueTokenSchema = z.string().trim().min(20).max(512);

const phoneSchema = z.string().trim().min(10).max(20).transform((value, ctx) => {
  try {
    return normalizePhone(value);
  } catch (_err) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid phone number.' });
    return z.NEVER;
  }
});

const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.');

const deviceIdSchema = z.string().trim().min(1).max(128).optional();
const deviceNameSchema = z.string().trim().min(1).max(120).optional();

const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    fullName: fullNameSchema,
    deviceId: deviceIdSchema,
    deviceName: deviceNameSchema,
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required.').max(128),
    deviceId: deviceIdSchema,
    deviceName: deviceNameSchema,
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: opaqueTokenSchema,
    deviceId: deviceIdSchema,
    deviceName: deviceNameSchema,
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const emailOnlySchema = requestSchema(z.object({
  email: emailSchema,
}).strict());

const forgotPasswordSchema = z.object({
  body: z.union([
    z.object({ email: emailSchema }).strict(),
    z.object({ phone: phoneSchema }).strict(),
  ]),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const resetPasswordSchema = z.object({
  body: z.union([
    z.object({
      token: opaqueTokenSchema,
      password: passwordSchema,
    }).strict(),
    z.object({
      phone: phoneSchema,
      otp: otpCodeSchema,
      password: passwordSchema,
    }).strict(),
  ]),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required.').max(128),
    newPassword: passwordSchema,
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const profileSchema = z.object({
  body: z.object({
    fullName: fullNameSchema,
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const verifyEmailSchema = z.object({
  body: z.object({
    token: opaqueTokenSchema,
  }).strict(),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

function otpIdentifierSchema(includeOtp) {
  const schema = z.object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    purpose: z.enum(['login', 'signup']).optional(),
    fullName: fullNameSchema.optional(),
    ...(includeOtp ? { otp: otpCodeSchema } : {}),
    deviceId: deviceIdSchema,
    deviceName: deviceNameSchema,
  }).strict().superRefine((body, ctx) => {
    if (Boolean(body.email) === Boolean(body.phone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an email address or phone number.' });
    }
    if (body.purpose === 'signup' && body.fullName && !body.fullName.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid name, or leave it for the profile step.' });
    }
  });
  return requestSchema(schema);
}

const sendOtpSchema = otpIdentifierSchema(false);
const verifyOtpSchema = otpIdentifierSchema(true);

const setPasswordSchema = requestSchema(z.object({
  password: passwordSchema,
}).strict());

const sessionIdSchema = requestSchema(z.object({}).strict(), uuidParam('id'));

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  emailOnlySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
  verifyEmailSchema,
  sendOtpSchema,
  verifyOtpSchema,
  setPasswordSchema,
  sessionIdSchema,
  phoneSchema,
  otpCodeSchema,
  passwordSchema,
  fullNameSchema,
  emailSchema,
};
