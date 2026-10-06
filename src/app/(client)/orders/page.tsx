import { redirect } from "next/navigation";

export default function OrdersRedirectPage() {
  redirect("/dashboard/client?tab=orders");
}
