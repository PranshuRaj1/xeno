import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { compare } from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
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
            // In a real app, you'd hash passwords. For this demo, we'll do simple comparison 
            // or assume the user is created with a plain password for simplicity (NOT RECOMMENDED FOR PROD)
            // But since I can't easily seed hashed passwords without a script, I'll assume plain text for now
            // OR better: create a seed script.
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
  pages: {
    signIn: '/login', // We'll need to create this page or let NextAuth use default
  },
})
