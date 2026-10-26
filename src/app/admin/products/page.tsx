import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import ProductsClient from "./ProductsClient";
import s from "./products.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products — VELORA Admin", robots: { index: false, follow: false } };

/** Server-side guard. The API routes check the admin role again, so this page is a convenience, not the only lock. */
export default async function AdminProductsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin/products");

  if (user.role !== "ADMIN") {
    return (
      <main className={s.denied}>
        <h1>Not allowed</h1>
        <p>{user.email} does not have access to the store dashboard.</p>
        <a href="/">Back to the store</a>
      </main>
    );
  }

  return <ProductsClient adminEmail={user.email} />;
}
