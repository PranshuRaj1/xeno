import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { compare } from "bcryptjs"

import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
            return null;
        }

        const user = await db.query.users.findFirst({
            where: eq(users.email, credentials.email as string),
        });

        if (!user) {
            return null; 
        }

        // Verify password
        const passwordsMatch = await compare(credentials.password as string, user.password as string);

        if (!passwordsMatch) {
            return null;
        }

        return {
            id: String(user.id),
            email: user.email,
            name: user.name,
        };
      },
    }),
  ],
})
