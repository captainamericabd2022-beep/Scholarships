import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default function SignUpPage() {
  return <main className="login-shell"><section className="login-intro"><div className="login-mark">SC</div><p className="eyebrow">CSE SCHOLARSHIP COMMAND CENTER</p><h1>Create your<br /><span>secure account.</span></h1><p>Creating an account does not grant dashboard access. Only the owner and explicitly invited verified emails can enter.</p><Link href="/sign-in">Already have an account? Sign in</Link><p className="preview-disclosure">Online preview · Clerk development authentication.</p></section><section className="login-form" aria-label="Create account"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/" /></section></main>;
}
