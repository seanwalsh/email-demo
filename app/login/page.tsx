import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/mail/INBOX" });
        }}
      >
        <button className="rounded bg-zinc-900 px-5 py-2.5 text-white dark:bg-white dark:text-black">
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
