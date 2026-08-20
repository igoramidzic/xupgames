import { UserButton, useClerk, useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Home</h1>
        <div className="flex items-center gap-3">
          <UserButton />
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Welcome, {user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</p>
      </main>
    </div>
  );
}
