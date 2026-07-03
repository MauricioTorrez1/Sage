import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "auth.errors.invalidEmail" }));

export const passwordSchema = z
  .string()
  .min(8, { error: "auth.errors.passwordTooShort" });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "auth.errors.passwordRequired" }),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "auth.errors.passwordsDontMatch",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, { error: "auth.errors.invalidCode" }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "auth.errors.passwordsDontMatch",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
