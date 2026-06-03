import { redirect } from "next/navigation";

// Sign-up and sign-in are the same flow (GitHub OAuth creates or logs in).
export default function SignUpPage() {
  redirect("/sign-in");
}
