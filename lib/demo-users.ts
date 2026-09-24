/**
 * Public demo accounts used by the login page's "demo" quick-fill buttons.
 *
 * These are intentionally PUBLIC demo credentials (they grant access only to
 * seeded demo data) and are recreated idempotently with `npm run seed:demo`.
 * They are NOT secrets.
 */
export interface DemoUser {
  role: "admin" | "researcher";
  label: string;
  description: string;
  email: string;
  password: string;
  fullName: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    role: "admin",
    label: "Admin",
    description: "Manage users and roles",
    email: "admin@koya.demo",
    password: "KoyaDemo-Admin-2026!",
    fullName: "Demo Admin",
  },
  {
    role: "researcher",
    label: "Researcher",
    description: "Create and run research",
    email: "researcher@koya.demo",
    password: "KoyaDemo-Researcher-2026!",
    fullName: "Demo Researcher",
  },
];