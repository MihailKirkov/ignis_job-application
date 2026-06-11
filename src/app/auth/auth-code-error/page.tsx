import Link from 'next/link';
import { Button, Card, CardBody } from '@/components/ui';

export default function AuthCodeError() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-4 text-center">
          <h1 className="text-base font-semibold text-fg">Sign-in link invalid</h1>
          <p className="text-sm text-muted">
            That link was expired or already used. Request a fresh magic link to
            try again.
          </p>
          <Link href="/login">
            <Button variant="primary" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </CardBody>
      </Card>
    </main>
  );
}
