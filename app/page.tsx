import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4">Proactive AI Wizard of Oz</h1>
        <p className="text-xl text-gray-600 max-w-xl">
          A research platform for testing proactive AI assistance in real-time writing
        </p>
      </header>

      <main className="flex gap-6">
        <Link
          href="/user"
          className="p-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center w-64 shadow-lg transition-colors"
        >
          <div className="text-2xl font-bold mb-2">User Interface</div>
          <p className="text-blue-100">
            Text editor with AI suggestions
          </p>
        </Link>

        <Link
          href="/wizard"
          className="p-8 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-center w-64 shadow-lg transition-colors"
        >
          <div className="text-2xl font-bold mb-2">Wizard Interface</div>
          <p className="text-purple-100">
            Control panel for managing AI suggestions
          </p>
        </Link>
      </main>

      <footer className="mt-16 text-gray-500 text-sm">
        <p>© 2023 Proactive AI Research Team</p>
      </footer>
    </div>
  );
}
