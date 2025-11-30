# Shopify Integration Service

A multi-tenant service to ingest Shopify data and visualize it on a dashboard.

## Tech Stack
-   **Framework**: Next.js 14 (App Router)
-   **Language**: TypeScript
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Styling**: Tailwind CSS + Shadcn/UI
-   **Auth**: NextAuth.js (v5)

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Database Setup**:
    -   Create a PostgreSQL database.
    -   Copy `.env.local.example` to `.env.local` and add your `DATABASE_URL`.
    ```bash
    cp .env.local.example .env.local
    ```

3.  **Run Migrations**:
    ```bash
    npx drizzle-kit push
    ```

4.  **Start Development Server**:
    ```bash
    npm run dev
    ```

## Features
-   **Data Ingestion**: Syncs Customers, Products, and Orders from Shopify.
-   **Dashboard**: Visualizes revenue, order trends, and top customers.
-   **Multi-tenancy**: Supports multiple stores via `tenantId`.
