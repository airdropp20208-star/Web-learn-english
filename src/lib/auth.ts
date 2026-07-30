// NextAuth configuration — CredentialsProvider with username + password
// Handles both login and signup in one form (mode field in credentials)

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;
// Username: letters, numbers, underscore, hyphen only
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Account",
      credentials: {
        username: {
          label: "Username",
          type: "text",
          placeholder: "your_username",
        },
        password: { label: "Password", type: "password" },
        mode: { label: "Mode", type: "text" }, // "login" | "signup"
      },
      async authorize(credentials) {
        try {
          console.log("[auth] authorize called with mode:", credentials?.mode, "username:", credentials?.username);

          if (!credentials?.username || !credentials?.password) {
            throw new Error("Missing username or password");
          }

          const username = credentials.username.trim();
          const password = credentials.password;
          const mode = credentials.mode === "signup" ? "signup" : "login";

          // Validate username format
          if (username.length < MIN_USERNAME_LENGTH) {
            throw new Error(
              `Username must be at least ${MIN_USERNAME_LENGTH} characters`
            );
          }
          if (username.length > MAX_USERNAME_LENGTH) {
            throw new Error(
              `Username must be at most ${MAX_USERNAME_LENGTH} characters`
            );
          }
          if (!USERNAME_REGEX.test(username)) {
            throw new Error(
              "Username can only contain letters, numbers, underscore, and hyphen"
            );
          }

          // Validate password length
          if (password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(
              `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
            );
          }

          if (mode === "signup") {
            // Check if username already taken
            const existing = await db.user.findUnique({
              where: { username },
            });
            if (existing) {
              throw new Error("Username already taken");
            }

            // Create new user
            const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            const user = await db.user.create({
              data: {
                username,
                passwordHash,
                name: username,
              },
            });
            console.log("[auth] created user:", user.id, user.username);

            // Ensure UserProgress exists
            const progress = await db.userProgress.findUnique({
              where: { userId: user.id },
            });
            if (!progress) {
              await db.userProgress.create({
                data: { userId: user.id, currentTier: "A2" },
              });
            }

            return {
              id: user.id,
              name: user.name ?? user.username,
              username: user.username,
            };
          }

          // mode === "login"
          const user = await db.user.findUnique({
            where: { username },
          });
          if (!user) {
            throw new Error("User not found. Sign up first.");
          }

          const passwordMatch = await bcrypt.compare(password, user.passwordHash);
          if (!passwordMatch) {
            throw new Error("Incorrect password");
          }

          console.log("[auth] login success:", user.id, user.username);
          return {
            id: user.id,
            name: user.name ?? user.username,
            username: user.username,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err instanceof Error ? err.message : err);
          // Returning null → 401 CredentialsSignin
          // Throwing → also 401 but error swallowed by NextAuth
          // Either way, the user sees "invalid credentials" message
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      // @ts-expect-error — username is custom field
      if (user?.username) {
        // @ts-expect-error — username is custom field
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // @ts-expect-error — augment session.user with id + username
        session.user.id = token.id as string;
      }
      if (session.user && token.username) {
        // @ts-expect-error — augment session.user with username
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
