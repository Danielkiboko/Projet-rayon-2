import { redirect } from "next/navigation";

export default function HelpRedirectPage() {
  redirect("/dashboard/client?tab=tickets");
}
