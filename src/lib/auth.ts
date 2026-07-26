// NextAuth configuration
// Uses CredentialsProvider for MVP demo (no real auth needed locally)
// GitHub OAuth ready: set GITHUB_ID + GITHUB_SECRET env vars to enable

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { db } from "./db";

const enableGithub =
  process.env.GITHUB_ID &&
  process.env.GITHUB_SECRET &&
  process.env.GITHUB_ID.length > 0;

export const authOptions: NextAuthOptions = {
  providers: [
    // Credentials provider — for demo / local dev
    // Creates or finds a user by email
    CredentialsProvider({
      name: "Demo Login",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "you@example.com",
        },
        name: { label: "Name", type: "text", placeholder: "Your name" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = credentials.email.trim().toLowerCase();
        const name = credentials.name?.trim() || email.split("@")[0];

        // Find or create user
        let user = await db.user.findUnique({ where: { email } });
        if (!user) {
          user = await db.user.create({ data: { email, name } });
        }

        // Ensure UserProgress exists
        const progress = await db.userProgress.findUnique({
          where: { userId: user.id },
        });
        if (!progress) {
          await db.userProgress.create({
            data: { userId: user.id, currentTier: "A2" },
          });
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // GitHub OAuth — enable by setting env vars
    ...(enableGithub
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // @ts-expect-error — augment session.user with id
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    // We'll handle sign-in inline in the page; default API route stays
    signIn: "/",
  },
};
