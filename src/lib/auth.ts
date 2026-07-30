// NextAuth configuration — GitHub OAuth (real) + Prisma adapter for user sync

import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { db } from "./db";

// GitHub OAuth is enabled only when both env vars are set.
// Otherwise, sign-in will fail with a clear error message.
const enableGithub = !!process.env.GITHUB_ID && !!process.env.GITHUB_SECRET;

// NEXTAUTH_SECRET is required for JWT signing in production.
if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
  console.warn(
    "[auth] NEXTAUTH_SECRET is not set. JWT signing will be insecure in production."
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(enableGithub
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
            // Request user:email scope to get private emails
            authorization: {
              params: { scope: "read:user user:email" },
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Initial sign-in: store user id + image
      if (user?.id) {
        token.id = user.id;
      }
      if (user?.image) {
        token.image = user.image;
      }
      // Store GitHub username for display
      if (account?.provider === "github" && profile) {
        const ghProfile = profile as { login?: string; avatar_url?: string };
        if (ghProfile.login) token.username = ghProfile.login;
        if (ghProfile.avatar_url && !token.image) {
          token.image = ghProfile.avatar_url;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // @ts-expect-error — augment session.user with id
        session.user.id = token.id as string;
      }
      if (session.user && token.image) {
        session.user.image = token.image as string;
      }
      if (session.user && token.username) {
        // @ts-expect-error — augment session.user with username
        session.user.username = token.username as string;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // For GitHub OAuth: create or update user in Prisma DB
      if (account?.provider === "github" && user.email) {
        try {
          const ghProfile = profile as {
            login?: string;
            name?: string | null;
            avatar_url?: string;
          };

          // Upsert user by email
          const existing = await db.user.findUnique({
            where: { email: user.email },
          });

          if (!existing) {
            await db.user.create({
              data: {
                email: user.email,
                name: user.name ?? ghProfile.login ?? null,
                image: user.image ?? ghProfile.avatar_url ?? null,
              },
            });
          } else {
            // Update name/image if changed
            await db.user.update({
              where: { id: existing.id },
              data: {
                name: user.name ?? existing.name,
                image: user.image ?? existing.image,
              },
            });
          }

          // Ensure UserProgress exists
          const dbUser = await db.user.findUnique({
            where: { email: user.email },
          });
          if (dbUser) {
            const progress = await db.userProgress.findUnique({
              where: { userId: dbUser.id },
            });
            if (!progress) {
              await db.userProgress.create({
                data: { userId: dbUser.id, currentTier: "A2" },
              });
            }

            // Inject the DB user id into the user object so JWT callback can use it
            user.id = dbUser.id;
          }
        } catch (err) {
          console.error("[auth] Failed to upsert user:", err);
          return false; // block sign-in on DB error
        }
      }
      return true;
    },
  },
  pages: {
    // Use custom sign-in page at root
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
