import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { ac, roles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // users are created by admins only
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/username": { window: 60, max: 10 }, // per IP
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          const impersonatedBy = typeof session.impersonatedBy === "string" ? session.impersonatedBy : null;
          await prisma.systemAuditLog.create({
            data: {
              action: impersonatedBy ? "IMPERSONATE_START" : "LOGIN",
              module: "auth",
              userId: session.userId,
              impersonatedBy,
              ip: session.ipAddress ?? null,
              userAgent: session.userAgent ?? null,
            },
          });
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-out" && ctx.path !== "/admin/stop-impersonating") return;
      const current = await getSessionFromCtx(ctx);
      if (!current) return;
      await prisma.systemAuditLog.create({
        data: {
          action: ctx.path === "/sign-out" ? "LOGOUT" : "IMPERSONATE_STOP",
          module: "auth",
          userId: current.user.id,
          impersonatedBy: current.session.impersonatedBy ?? null,
          ip: current.session.ipAddress ?? null,
          userAgent: current.session.userAgent ?? null,
        },
      });
    }),
  },
  plugins: [
    username(),
    admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
