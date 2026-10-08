import { SignIn } from "@clerk/nextjs";
export const dynamic = "force-dynamic";
export default function SignInPage() {
  return <main className="login-shell">
    <section className="login-intro"><div className="login-mark">SC</div><p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h1>CSE Scholarship<br /><span>Command Center</span></h1><p>Official opportunities. Clear deadlines. One place to prepare your future.</p><div className="login-privacy">Private by design · Owner &amp; invited accounts only</div><p className="preview-disclosure">Online preview · Clerk development authentication. A custom domain and production authentication are still needed for permanent launch.</p></section>
    <section className="login-form" aria-label="Sign in"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/" /></section>
  </main>;
}
